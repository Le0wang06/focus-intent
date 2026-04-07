import {
  normalizeDomainInput,
  hostnameMatches,
  hostnameFromUrl,
  isExtensionUrl,
  uniqueDomains
} from './shared/domains.js';

const STORAGE_KEYS = {
  SETTINGS: 'fi_settings',
  SESSION: 'fi_session',
  ONE_SHOT: 'fi_one_shot_allow',
  TEMP_UNLOCK: 'fi_temp_unlock',
  STREAK: 'fi_streak'
};

const DEFAULT_SETTINGS = {
  blockedDomains: [],
  defaultDurationMinutes: 25,
  frictionStyle: 'balanced',
  extensionEnabled: true,
  lastTaskLabel: '',
  lastTaskType: 'coding'
};

function now() {
  return Date.now();
}

async function loadSettings() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) };
}

async function saveSettings(partial) {
  const cur = await loadSettings();
  const next = { ...cur, ...partial };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: next });
  return next;
}

async function loadSession() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SESSION);
  return data[STORAGE_KEYS.SESSION] || null;
}

async function saveSession(session) {
  if (!session) {
    await chrome.storage.local.remove(STORAGE_KEYS.SESSION);
    return null;
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: session });
  return session;
}

function isSessionActive(session) {
  if (!session || !session.active) return false;
  if (session.endsAt && now() >= session.endsAt) return false;
  return true;
}

function domainInList(hostname, list) {
  if (!hostname || !list?.length) return false;
  return list.some((d) => hostnameMatches(hostname, d));
}

function frictionStageForVisit(visitCount, frictionStyle) {
  if (frictionStyle === 'firm') {
    if (visitCount <= 1) return 1;
    return 3;
  }
  if (visitCount <= 1) return 1;
  if (visitCount === 2) return 2;
  return 3;
}

async function clearOneShot() {
  await chrome.storage.local.remove(STORAGE_KEYS.ONE_SHOT);
}

async function getOneShot() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.ONE_SHOT);
  return data[STORAGE_KEYS.ONE_SHOT] || null;
}

async function setOneShot(allow) {
  if (!allow) await clearOneShot();
  else await chrome.storage.local.set({ [STORAGE_KEYS.ONE_SHOT]: allow });
}

async function getTempUnlock() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TEMP_UNLOCK);
  return data[STORAGE_KEYS.TEMP_UNLOCK] || null;
}

async function setTempUnlock(entry) {
  if (!entry) await chrome.storage.local.remove(STORAGE_KEYS.TEMP_UNLOCK);
  else await chrome.storage.local.set({ [STORAGE_KEYS.TEMP_UNLOCK]: entry });
}

function extensionBlockedPageUrl() {
  return chrome.runtime.getURL('blocked.html');
}

function buildBlockedUrl({ targetUrl, domain, stage, tabId }) {
  const base = extensionBlockedPageUrl();
  const params = new URLSearchParams({
    target: targetUrl,
    domain,
    stage: String(stage),
    tabId: String(tabId)
  });
  return `${base}?${params.toString()}`;
}

async function maybeInterceptNavigation(tabId, url) {
  const settings = await loadSettings();
  if (!settings.extensionEnabled) return;

  const session = await loadSession();
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

  const tu = await getTempUnlock();
  if (tu && tu.expires > now() && hostnameMatches(hostname, tu.domain)) {
    await touchProductive(tabId, url, session);
    return;
  }

  const shot = await getOneShot();
  if (
    shot &&
    shot.tabId === tabId &&
    shot.expires > now() &&
    hostnameMatches(hostname, shot.domain)
  ) {
    await clearOneShot();
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

  const nextSession = {
    ...session,
    visitCounts,
    lastInterceptDomain: visitKey,
    lastInterceptAt: now()
  };
  await saveSession(nextSession);

  const blockedPage = buildBlockedUrl({
    targetUrl: url,
    domain: visitKey,
    stage,
    tabId
  });

  try {
    await chrome.tabs.update(tabId, { url: blockedPage });
  } catch {
    /* tab may have closed */
  }
}

async function touchProductive(tabId, url, session) {
  if (!session?.active) return;
  const hostname = hostnameFromUrl(url);
  if (!hostname || isExtensionUrl(url)) return;

  const settings = await loadSettings();
  const blocked = uniqueDomains(settings.blockedDomains);
  if (domainInList(hostname, blocked)) return;

  const next = {
    ...session,
    lastProductiveUrl: url,
    lastProductiveTabId: tabId,
    lastProductiveAt: now()
  };
  await saveSession(next);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  const url = changeInfo.url;
  if (!url) return;
  maybeInterceptNavigation(tabId, url);
});

async function bumpSessionStreak() {
  const streakData = (await chrome.storage.local.get(STORAGE_KEYS.STREAK))[STORAGE_KEYS.STREAK] || {
    count: 0,
    lastDay: ''
  };
  const day = new Date().toISOString().slice(0, 10);
  let count = streakData.count || 0;
  if (streakData.lastDay === day) {
    return;
  }
  if (streakData.lastDay === previousCalendarDay(day)) {
    count += 1;
  } else {
    count = 1;
  }
  await chrome.storage.local.set({
    [STORAGE_KEYS.STREAK]: { count, lastDay: day }
  });
}

async function teardownSession() {
  await saveSession(null);
  await chrome.storage.local.remove(STORAGE_KEYS.ONE_SHOT);
  await setTempUnlock(null);
  try {
    await chrome.alarms.clear('focus_session_end');
  } catch {
    /* ignore */
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'focus_session_end') return;
  const session = await loadSession();
  if (!session?.active) return;

  await teardownSession();
  await bumpSessionStreak();
});

function previousCalendarDay(yyyyMmDd) {
  const d = new Date(yyyyMmDd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'GET_STATE') {
        const settings = await loadSettings();
        let session = await loadSession();
        if (session && session.endsAt && now() >= session.endsAt) {
          await teardownSession();
          await bumpSessionStreak();
          session = null;
        }
        const streak = (await chrome.storage.local.get(STORAGE_KEYS.STREAK))[STORAGE_KEYS.STREAK] || null;
        sendResponse({ ok: true, settings, session, streak });
        return;
      }

      if (message.type === 'START_SESSION') {
        const settings = await loadSettings();
        const minutes = Math.max(5, Math.min(480, Number(message.durationMinutes) || settings.defaultDurationMinutes));
        const endsAt = now() + minutes * 60 * 1000;
        const allowRaw = message.sessionAllowlist || [];
        const sessionAllowlist = uniqueDomains(
          typeof allowRaw === 'string' ? allowRaw.split(/[\n,]+/) : allowRaw
        );

        const session = {
          active: true,
          taskLabel: (message.taskLabel || 'Focused work').slice(0, 120),
          taskType: message.taskType || settings.lastTaskType || 'coding',
          startedAt: now(),
          endsAt,
          sessionAllowlist,
          visitCounts: {},
          paused: false,
          lastProductiveUrl: null,
          lastProductiveTabId: null
        };
        await saveSession(session);
        await clearOneShot();
        await setTempUnlock(null);
        await saveSettings({
          lastTaskLabel: session.taskLabel,
          lastTaskType: session.taskType
        });
        chrome.alarms.create('focus_session_end', { when: endsAt });
        sendResponse({ ok: true, session });
        return;
      }

      if (message.type === 'END_SESSION') {
        await teardownSession();
        await bumpSessionStreak();
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'TOGGLE_SESSION_PAUSE') {
        const session = await loadSession();
        if (!session?.active) {
          sendResponse({ ok: false, error: 'no_session' });
          return;
        }
        session.paused = !session.paused;
        await saveSession(session);
        sendResponse({ ok: true, session });
        return;
      }

      if (message.type === 'GRANT_ONE_SHOT') {
        const { tabId, domain, targetUrl } = message;
        const ttlMs = 12_000;
        await setOneShot({
          tabId,
          domain: normalizeDomainInput(domain),
          targetUrl,
          expires: now() + ttlMs
        });
        try {
          await chrome.tabs.update(tabId, { url: targetUrl });
        } catch {
          /* ignore */
        }
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'GRANT_TEMP_UNLOCK') {
        const { domain, minutes } = message;
        const m = Math.max(1, Math.min(30, Number(minutes) || 2));
        await setTempUnlock({
          domain: normalizeDomainInput(domain),
          expires: now() + m * 60 * 1000
        });
        const tabId = message.tabId;
        const targetUrl = message.targetUrl;
        try {
          if (tabId && targetUrl) await chrome.tabs.update(tabId, { url: targetUrl });
        } catch {
          /* ignore */
        }
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'OPEN_OPTIONS') {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'RETURN_TO_WORK') {
        const session = await loadSession();
        const tabId = message.tabId;
        if (session?.lastProductiveUrl) {
          try {
            await chrome.tabs.update(tabId, { url: session.lastProductiveUrl });
            sendResponse({ ok: true });
            return;
          } catch {
            /* fall through */
          }
        }
        try {
          await chrome.tabs.remove(tabId);
        } catch {
          /* ignore */
        }
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: 'unknown_message' });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  if (!data[STORAGE_KEYS.SETTINGS]) {
    await saveSettings({ ...DEFAULT_SETTINGS });
  }
});
