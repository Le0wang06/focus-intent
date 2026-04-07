import { SESSION_ALARM_NAME } from '../shared/storage-keys.js';
import { parseAllowlistInput, normalizeDomainInput } from '../shared/domains.js';
import * as storage from './storage.js';
import { bumpSessionStreak } from './streak.js';

export function isSessionActive(session, atMs = Date.now()) {
  if (!session || !session.active) return false;
  if (session.endsAt && atMs >= session.endsAt) return false;
  return true;
}

/**
 * If the session clock has passed, tear it down and count streak once. Returns null when expired.
 */
export async function reconcileExpiredSession(session) {
  if (!session?.endsAt || Date.now() < session.endsAt) return session;
  await teardownSession();
  await bumpSessionStreak();
  return null;
}

export async function teardownSession() {
  await storage.setSession(null);
  await storage.setOneShotAllow(null);
  await storage.setTempUnlock(null);
  try {
    await chrome.alarms.clear(SESSION_ALARM_NAME);
  } catch {
    /* ignore */
  }
}

export async function startSessionFromMessage(message, settings) {
  const minutes = Math.max(5, Math.min(480, Number(message.durationMinutes) || settings.defaultDurationMinutes));
  const endsAt = Date.now() + minutes * 60 * 1000;
  const sessionAllowlist = parseAllowlistInput(message.sessionAllowlist || []);

  const session = {
    active: true,
    taskLabel: (message.taskLabel || 'Focused work').slice(0, 120),
    taskType: message.taskType || settings.lastTaskType || 'coding',
    startedAt: Date.now(),
    endsAt,
    sessionAllowlist,
    visitCounts: {},
    paused: false,
    lastProductiveUrl: null,
    lastProductiveTabId: null
  };

  await storage.setSession(session);
  await storage.setOneShotAllow(null);
  await storage.setTempUnlock(null);
  await storage.patchSettings({
    lastTaskLabel: session.taskLabel,
    lastTaskType: session.taskType
  });
  await chrome.alarms.create(SESSION_ALARM_NAME, { when: endsAt });
  return session;
}

export async function toggleSessionPause() {
  let session = await storage.getSession();
  session = await reconcileExpiredSession(session);
  if (!session?.active || !isSessionActive(session)) {
    return { ok: false, error: 'no_session' };
  }
  session.paused = !session.paused;
  await storage.setSession(session);
  return { ok: true, session };
}
