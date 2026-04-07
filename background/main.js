/**
 * Service worker entry: registers listeners and delegates logic to small modules.
 */
import { SESSION_ALARM_NAME } from '../shared/storage-keys.js';
import * as storage from './storage.js';
import { maybeInterceptNavigation } from './intercept.js';
import { teardownSession } from './session.js';
import { bumpSessionStreak } from './streak.js';
import { handleMessage } from './handlers.js';

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  maybeInterceptNavigation(tabId, changeInfo.url);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== SESSION_ALARM_NAME) return;
  const session = await storage.getSession();
  if (!session?.active) return;
  await teardownSession();
  await bumpSessionStreak();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      const out = await handleMessage(message);
      sendResponse(out);
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void storage.ensureDefaultSettings();
});
