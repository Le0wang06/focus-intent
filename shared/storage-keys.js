/** Single source of truth for `chrome.storage.local` keys and defaults. */

export const STORAGE_KEYS = Object.freeze({
  SETTINGS: 'fi_settings',
  SESSION: 'fi_session',
  ONE_SHOT_ALLOW: 'fi_one_shot_allow',
  TEMP_UNLOCK: 'fi_temp_unlock',
  STREAK: 'fi_streak'
});

export const DEFAULT_SETTINGS = Object.freeze({
  blockedDomains: [],
  defaultDurationMinutes: 25,
  frictionStyle: 'balanced',
  extensionEnabled: true,
  lastTaskLabel: '',
  lastTaskType: 'coding'
});

export const SESSION_ALARM_NAME = 'focus_session_end';

export const ONE_SHOT_TTL_MS = 12_000;
