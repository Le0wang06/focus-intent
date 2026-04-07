import {
  normalizeDomainInput,
  hostnameMatches,
  hostnameFromUrl,
  isExtensionUrl,
  uniqueDomains,
  domainInList
} from '../shared/domains.js';
import { frictionStageForVisit } from './friction.js';
import * as storage from './storage.js';
import { isSessionActive, reconcileExpiredSession } from './session.js';

function blockedPageUrl() {
  return chrome.runtime.getURL('blocked.html');
}

function buildBlockedUrl({ targetUrl, domain, stage, tabId }) {
  const params = new URLSearchParams({
    target: targetUrl,
    domain,
    stage: String(stage),
    tabId: String(tabId)
  });
  return `${blockedPageUrl()}?${params.toString()}`;
}

async function touchProductive(tabId, url, session) {
  if (!session?.active) return;
  const hostname = hostnameFromUrl(url);
  if (!hostname || isExtensionUrl(url)) return;

  const settings = await storage.getSettings();
  const blocked = uniqueDomains(settings.blockedDomains);
  if (domainInList(hostname, blocked)) return;

  await storage.setSession({
    ...session,
    lastProductiveUrl: url,
    lastProductiveTabId: tabId,
    lastProductiveAt: Date.now()
  });
}

export async function maybeInterceptNavigation(tabId, url) {
  const settings = await storage.getSettings();
  if (!settings.extensionEnabled) return;

  let session = await storage.getSession();
  session = await reconcileExpiredSession(session);
  if (!isSessionActive(session)) return;
  if (session.paused) return;

  if (!url || !url.startsWith('http')) return;
  if (isExtensionUrl(url)) return;

  const hostname = hostnameFromUrl(url);
  if (!hostname) return;

  const blocked = uniqueDomains(settings.blockedDomains);
  if (!blocked.length) return;

  if (domainInList(hostname, session.sessionAllowlist || [])) {
    await touchProductive(tabId, url, session);
    return;
  }

  const tu = await storage.getTempUnlock();
  if (tu && tu.expires > Date.now() && hostnameMatches(hostname, tu.domain)) {
    await touchProductive(tabId, url, session);
    return;
  }

  const shot = await storage.getOneShotAllow();
  if (
    shot &&
    shot.tabId === tabId &&
    shot.expires > Date.now() &&
    hostnameMatches(hostname, shot.domain)
  ) {
    await storage.setOneShotAllow(null);
    await touchProductive(tabId, url, session);
    return;
  }

  if (!domainInList(hostname, blocked)) {
    await touchProductive(tabId, url, session);
    return;
  }

  const visitKey = normalizeDomainInput(hostname);
  const visitCounts = { ...(session.visitCounts || {}) };
  visitCounts[visitKey] = (visitCounts[visitKey] || 0) + 1;
  const visitCount = visitCounts[visitKey];
  const stage = frictionStageForVisit(visitCount, settings.frictionStyle);

  await storage.setSession({
    ...session,
    visitCounts,
    lastInterceptDomain: visitKey,
    lastInterceptAt: Date.now()
  });

  const nextUrl = buildBlockedUrl({
    targetUrl: url,
    domain: visitKey,
    stage,
    tabId
  });

  try {
    await chrome.tabs.update(tabId, { url: nextUrl });
  } catch {
    /* tab may have closed */
  }
}
