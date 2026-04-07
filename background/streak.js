import { STORAGE_KEYS } from '../shared/storage-keys.js';

function previousCalendarDay(yyyyMmDd) {
  const d = new Date(`${yyyyMmDd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function bumpSessionStreak() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.STREAK);
  const streakData = data[STORAGE_KEYS.STREAK] || { count: 0, lastDay: '' };
  const day = new Date().toISOString().slice(0, 10);
  let count = streakData.count || 0;
  if (streakData.lastDay === day) return;
  if (streakData.lastDay === previousCalendarDay(day)) {
    count += 1;
  } else {
    count = 1;
  }
  await chrome.storage.local.set({
    [STORAGE_KEYS.STREAK]: { count, lastDay: day }
  });
}
