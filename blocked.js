import { randomGroundingMessage } from './shared/constants.js';

function sendMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, resolve);
  });
}

function formatRemaining(ms) {
  if (ms <= 0) return 'Session ending…';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s left`;
}

function qs(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

async function main() {
  const targetUrl = qs('target');
  const domain = qs('domain') || 'this site';
  const stage = Number(qs('stage')) || 1;
  const tabId = Number(qs('tabId')) || null;

  if (!targetUrl || !tabId) {
    document.getElementById('headline').textContent = 'Something went wrong';
    document.getElementById('site-line').textContent = 'Close this tab and try again.';
    return;
  }

  document.getElementById('grounding').textContent = randomGroundingMessage();
  document.getElementById('site-line').textContent = `You asked to open ${domain}.`;

  const state = await sendMessage('GET_STATE');
  const session = state?.session;
  if (session?.active) {
    document.getElementById('task-title').textContent = session.taskLabel || 'Focused work';
    const left = session.endsAt - Date.now();
    document.getElementById('session-remaining').textContent = formatRemaining(left);
  } else {
    document.getElementById('task-title').textContent = 'No active session';
    document.getElementById('session-remaining').textContent = '';
  }

  const recoverRow = document.getElementById('recovery-row');
  const btnRecover = document.getElementById('btn-recover');
  if (session?.lastProductiveUrl) {
    recoverRow.hidden = false;
    btnRecover.addEventListener('click', () => {
      sendMessage('RETURN_TO_WORK', { tabId });
    });
  }

  const bindWork = (id) => {
    document.getElementById(id).addEventListener('click', () => {
      sendMessage('RETURN_TO_WORK', { tabId });
    });
  };

  if (stage === 1) {
    document.getElementById('stage-badge').textContent = 'First nudge';
    document.getElementById('headline').textContent = 'Do you really want to open this?';
    document.getElementById('controls-1').hidden = false;

    const overlay = document.getElementById('pause-overlay');
    const btnOpen = document.getElementById('btn-open-1');
    overlay.hidden = false;
    let n = 3;
    const el = document.getElementById('pause-count');
    el.textContent = String(n);
    const t = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(t);
        overlay.hidden = true;
        btnOpen.disabled = false;
        return;
      }
      el.textContent = String(n);
    }, 1000);

    bindWork('btn-work-1');
    btnOpen.addEventListener('click', () => {
      sendMessage('GRANT_ONE_SHOT', { tabId, domain, targetUrl });
    });
  } else if (stage === 2) {
    document.getElementById('stage-badge').textContent = 'Second check';
    document.getElementById('headline').textContent = 'Stronger confirmation';
    document.getElementById('controls-2').hidden = false;
    const ack = document.getElementById('ack-2');
    const btnOpen = document.getElementById('btn-open-2');
    ack.addEventListener('change', () => {
      btnOpen.disabled = !ack.checked;
    });
    bindWork('btn-work-2');
    btnOpen.addEventListener('click', () => {
      sendMessage('GRANT_ONE_SHOT', { tabId, domain, targetUrl });
    });
  } else {
    document.getElementById('stage-badge').textContent = 'Strong limit';
    document.getElementById('headline').textContent = 'Protecting your focus';
    document.getElementById('controls-3').hidden = false;
    bindWork('btn-work-3');

    const btnOpen = document.getElementById('btn-open-3');
    const waitEl = document.getElementById('unlock-wait');
    let wait = 45;
    waitEl.textContent = `Unlock available in ${wait}s`;
    const id = setInterval(() => {
      wait -= 1;
      if (wait <= 0) {
        clearInterval(id);
        waitEl.textContent = 'You can open a short window if you still need to.';
        btnOpen.disabled = false;
        return;
      }
      waitEl.textContent = `Unlock available in ${wait}s`;
    }, 1000);

    btnOpen.addEventListener('click', () => {
      sendMessage('GRANT_TEMP_UNLOCK', { tabId, domain, targetUrl, minutes: 2 });
    });
  }
}

main();
