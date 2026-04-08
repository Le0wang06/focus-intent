import { TASK_TYPES } from './shared/constants.js';
import { uniqueDomains } from './shared/domains.js';
import { Msg } from './shared/messaging-types.js';
import { sendToBackground } from './shared/messaging.js';
import { formatCountdownClock } from './shared/time.js';

let wasSessionActive = null;
let activeTab = 'session';
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function setupProgressRing() {
  const ring = document.getElementById('time-progress-ring');
  if (!ring) return;
  ring.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
  ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeDuration(value) {
  const n = Number(value) || 25;
  const stepped = Math.round(n / 5) * 5;
  return clamp(stepped, 5, 480);
}

function setDuration(value) {
  document.getElementById('duration').value = String(normalizeDuration(value));
}

function ringColorForTimeFraction(timeLeftFraction) {
  const f = clamp(timeLeftFraction, 0, 1);
  const hue = Math.round(8 + f * 236);
  return `hsl(${hue} 86% 66%)`;
}

function updateProgressRing(msLeft, msTotal) {
  const ring = document.getElementById('time-progress-ring');
  if (!ring) return;

  const total = Math.max(1, msTotal);
  const fraction = clamp(msLeft / total, 0, 1);
  const offset = RING_CIRCUMFERENCE * (1 - fraction);

  ring.style.stroke = ringColorForTimeFraction(fraction);
  ring.style.strokeDashoffset = String(offset);
}

function populateTaskTypes() {
  const sel = document.getElementById('task-type');
  sel.innerHTML = '';
  for (const t of TASK_TYPES) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    sel.appendChild(opt);
  }
}

function setTab(tabId) {
  activeTab = tabId;
  const ids = ['session', 'sites', 'settings'];
  for (const id of ids) {
    const tabBtn = document.getElementById(`tab-${id}`);
    const view = document.getElementById(`view-${id}`);
    const isActive = id === tabId;
    tabBtn.classList.toggle('active', isActive);
    tabBtn.setAttribute('aria-selected', String(isActive));
    view.hidden = !isActive;
  }
}

function renderSites(blockedDomains) {
  const list = document.getElementById('sites-list');
  const empty = document.getElementById('sites-empty');
  list.innerHTML = '';
  const domains = uniqueDomains(blockedDomains || []).sort((a, b) => a.localeCompare(b));

  if (!domains.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const domain of domains) {
    const li = document.createElement('li');
    li.className = 'site-row';
    li.innerHTML = `
      <span class="site-domain">${domain}</span>
      <span class="site-dot" aria-hidden="true"></span>
    `;
    list.appendChild(li);
  }
}

async function refresh() {
  const res = await sendToBackground({ type: Msg.GET_STATE });
  if (!res?.ok) return;

  const { settings, session, streak } = res;
  renderSites(settings.blockedDomains);
  const active = !!(session?.active && session.endsAt > Date.now());

  const startPanel = document.getElementById('start-panel');
  const activePanel = document.getElementById('active-panel');

  if (active) {
    startPanel.hidden = true;
    activePanel.hidden = false;

    const typeLabel = TASK_TYPES.find((x) => x.id === session.taskType)?.label || session.taskType;
    document.getElementById('current-task').textContent = session.taskLabel || typeLabel || 'Focus session';
    const left = session.endsAt - Date.now();
    document.getElementById('time-remaining').textContent = formatCountdownClock(left);
    const total = session.endsAt - (session.startedAt || Date.now());
    updateProgressRing(left, total);

    document.getElementById('session-meta').textContent = session.paused
      ? 'Interventions paused — sites open normally until you resume.'
      : `${typeLabel} · Friction active on your distracting list`;

    const stateDot = document.getElementById('session-state-dot');
    const stateText = document.getElementById('session-badge');
    stateText.textContent = session.paused ? 'Paused' : 'Active';
    stateText.style.color = session.paused ? '#b86a00' : '#22a954';
    stateDot.style.background = session.paused ? '#b86a00' : '#22c55e';
    stateDot.style.boxShadow = session.paused ? '0 0 0 3px rgba(184, 106, 0, 0.14)' : '0 0 0 3px rgba(34, 197, 94, 0.14)';

    const pauseBtn = document.getElementById('toggle-pause');
    pauseBtn.textContent = session.paused ? 'Resume focus checks' : 'Session running';
  } else {
    startPanel.hidden = false;
    activePanel.hidden = true;

    // Only hydrate defaults when entering the start panel,
    // so the 1s refresh loop doesn't wipe what the user is typing.
    if (wasSessionActive !== false) {
      document.getElementById('task-label').value = settings.lastTaskLabel || '';
      document.getElementById('task-type').value = settings.lastTaskType || 'coding';
      setDuration(settings.defaultDurationMinutes || 25);
    }
  }

  const streakEl = document.getElementById('streak-line');
  if (streak?.count > 0) {
    streakEl.textContent = `Session streak: ${streak.count} day${streak.count === 1 ? '' : 's'}`;
  } else {
    streakEl.textContent = '';
  }

  const startBtn = document.getElementById('start-session');
  const disabledHint = document.getElementById('disabled-hint');
  if (!settings.extensionEnabled) {
    startBtn.disabled = true;
    disabledHint.hidden = false;
  } else {
    startBtn.disabled = false;
    disabledHint.hidden = true;
  }

  wasSessionActive = active;
}

function openSettings() {
  sendToBackground({ type: Msg.OPEN_OPTIONS });
}

document.getElementById('open-settings').addEventListener('click', () => {
  openSettings();
});

document.getElementById('open-settings-secondary').addEventListener('click', () => {
  openSettings();
});

document.getElementById('tab-session').addEventListener('click', () => setTab('session'));
document.getElementById('tab-sites').addEventListener('click', () => setTab('sites'));
document.getElementById('tab-settings').addEventListener('click', () => setTab('settings'));

document.getElementById('duration-minus').addEventListener('click', () => {
  const current = Number(document.getElementById('duration').value) || 25;
  setDuration(current - 5);
});

document.getElementById('duration-plus').addEventListener('click', () => {
  const current = Number(document.getElementById('duration').value) || 25;
  setDuration(current + 5);
});

for (const btn of document.querySelectorAll('.quick-add')) {
  btn.addEventListener('click', () => {
    setDuration(Number(btn.dataset.minutes));
  });
}

document.getElementById('duration').addEventListener('change', () => {
  setDuration(document.getElementById('duration').value);
});

document.getElementById('start-session').addEventListener('click', async () => {
  const taskType = document.getElementById('task-type').value;
  const taskLabel = document.getElementById('task-label').value.trim() || 'Focused work';
  const durationMinutes = Number(document.getElementById('duration').value) || 25;
  const allowlist = document.getElementById('allowlist').value;

  const res = await sendToBackground({
    type: Msg.START_SESSION,
    taskType,
    taskLabel,
    durationMinutes,
    sessionAllowlist: allowlist
  });
  if (res?.ok) await refresh();
});

document.getElementById('end-session').addEventListener('click', async () => {
  await sendToBackground({ type: Msg.END_SESSION });
  await refresh();
});

document.getElementById('toggle-pause').addEventListener('click', async () => {
  await sendToBackground({ type: Msg.TOGGLE_SESSION_PAUSE });
  await refresh();
});

populateTaskTypes();
setupProgressRing();
setTab(activeTab);
refresh();
setInterval(refresh, 1000);
