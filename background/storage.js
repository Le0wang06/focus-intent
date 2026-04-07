import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../shared/storage-keys.js';

export async function getSettings() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) };
}

export async function patchSettings(partial) {
  const cur = await getSettings();
  const next = { ...cur, ...partial };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: next });
  return next;
}

export async function getSession() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SESSION);
  return data[STORAGE_KEYS.SESSION] || null;
}

export async function setSession(session) {
  if (!session) {
    await chrome.storage.local.remove(STORAGE_KEYS.SESSION);
    return null;
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: session });
  return session;
}

export async function getOneShotAllow() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.ONE_SHOT_ALLOW);
  return data[STORAGE_KEYS.ONE_SHOT_ALLOW] || null;
}

export async function setOneShotAllow(entry) {
  if (!entry) {
    await chrome.storage.local.remove(STORAGE_KEYS.ONE_SHOT_ALLOW);
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.ONE_SHOT_ALLOW]: entry });
}

export async function getTempUnlock() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TEMP_UNLOCK);
  return data[STORAGE_KEYS.TEMP_UNLOCK] || null;
}

export async function setTempUnlock(entry) {
  if (!entry) {
    await chrome.storage.local.remove(STORAGE_KEYS.TEMP_UNLOCK);
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.TEMP_UNLOCK]: entry });
}

export async function getStreak() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.STREAK);
  return data[STORAGE_KEYS.STREAK] || null;
}

export async function setStreak(streak) {
  await chrome.storage.local.set({ [STORAGE_KEYS.STREAK]: streak });
}

export async function ensureDefaultSettings() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  if (!data[STORAGE_KEYS.SETTINGS]) {
    await patchSettings({ ...DEFAULT_SETTINGS });
  }
}
