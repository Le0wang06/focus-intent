import { Msg } from '../shared/messaging-types.js';
import { normalizeDomainInput } from '../shared/domains.js';
import { ONE_SHOT_TTL_MS } from '../shared/storage-keys.js';
import * as storage from './storage.js';
import { reconcileExpiredSession, teardownSession, startSessionFromMessage, toggleSessionPause } from './session.js';
import { bumpSessionStreak } from './streak.js';

export async function handleMessage(message) {
  switch (message.type) {
    case Msg.GET_STATE: {
      const settings = await storage.getSettings();
      let session = await storage.getSession();
      session = await reconcileExpiredSession(session);
      const streak = await storage.getStreak();
      return { ok: true, settings, session, streak };
    }

    case Msg.START_SESSION: {
      const settings = await storage.getSettings();
      const session = await startSessionFromMessage(message, settings);
      return { ok: true, session };
    }

    case Msg.END_SESSION: {
      await teardownSession();
      await bumpSessionStreak();
      return { ok: true };
    }

    case Msg.TOGGLE_SESSION_PAUSE:
      return toggleSessionPause();

    case Msg.GRANT_ONE_SHOT: {
      const { tabId, domain, targetUrl } = message;
      await storage.setOneShotAllow({
        tabId,
        domain: normalizeDomainInput(domain),
        targetUrl,
        expires: Date.now() + ONE_SHOT_TTL_MS
      });
      try {
        await chrome.tabs.update(tabId, { url: targetUrl });
      } catch {
        /* ignore */
      }
      return { ok: true };
    }

    case Msg.GRANT_TEMP_UNLOCK: {
      const m = Math.max(1, Math.min(30, Number(message.minutes) || 2));
      await storage.setTempUnlock({
        domain: normalizeDomainInput(message.domain),
        expires: Date.now() + m * 60 * 1000
      });
      try {
        if (message.tabId && message.targetUrl) {
          await chrome.tabs.update(message.tabId, { url: message.targetUrl });
        }
      } catch {
        /* ignore */
      }
      return { ok: true };
    }

    case Msg.OPEN_OPTIONS: {
      chrome.runtime.openOptionsPage();
      return { ok: true };
    }

    case Msg.RETURN_TO_WORK: {
      const session = await storage.getSession();
      const { tabId } = message;
      if (session?.lastProductiveUrl) {
        try {
          await chrome.tabs.update(tabId, { url: session.lastProductiveUrl });
          return { ok: true };
        } catch {
          /* fall through */
        }
      }
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        /* ignore */
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: 'unknown_message' };
  }
}
