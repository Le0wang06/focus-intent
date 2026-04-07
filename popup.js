import { TASK_TYPES } from './shared/constants.js';
import { Msg } from './shared/messaging-types.js';
import { sendToBackground } from './shared/messaging.js';
import { formatCountdownClock } from './shared/time.js';

let wasSessionActive = null;

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

async function refresh() {
  const res = await sendToBackground({ type: Msg.GET_STATE });
  if (!res?.ok) return;

  const { settings, session, streak } = res;
  const active = !!(session?.active && session.endsAt > Date.now());

  const startPanel = document.getElementById('start-panel');
  const activePanel = document.getElementById('active-panel');

  if (active) {
    startPanel.hidden = true;
    activePanel.hidden = false;

    document.getElementById('current-task').textContent = session.taskLabel || 'Focused work';
    const left = session.endsAt - Date.now();
    document.getElementById('time-remaining').textContent = formatCountdownClock(left);

    const typeLabel = TASK_TYPES.find((x) => x.id === session.taskType)?.label || session.taskType;
    document.getElementById('session-meta').textContent = session.paused
      ? 'Interventions paused — sites open normally until you resume.'
      : `${typeLabel} · Friction active on your distracting list`;

    document.getElementById('session-badge').textContent = session.paused ? 'Paused' : 'Focus on';
    document.getElementById('session-badge').classList.toggle('badge-warn', !!session.paused);

    const pauseBtn = document.getElementById('toggle-pause');
    pauseBtn.textContent = session.paused ? 'Resume checks' : 'Pause checks';
  } else {
    startPanel.hidden = false;
    activePanel.hidden = true;

    // Only hydrate defaults when entering the start panel,
    // so the 1s refresh loop doesn't wipe what the user is typing.
    if (wasSessionActive !== false) {
      document.getElementById('task-label').value = settings.lastTaskLabel || '';
      document.getElementById('task-type').value = settings.lastTaskType || 'coding';
      document.getElementById('duration').value = String(settings.defaultDurationMinutes || 25);
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

document.getElementById('open-settings').addEventListener('click', () => {
  sendToBackground({ type: Msg.OPEN_OPTIONS });
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
refresh();
setInterval(refresh, 1000);
