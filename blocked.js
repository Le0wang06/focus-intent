import { randomGroundingMessage } from './shared/constants.js';
import { Msg } from './shared/messaging-types.js';
import { domainInList, isHttpUrl, normalizeDomainInput } from './shared/domains.js';
import { sendToBackground } from './shared/messaging.js';
import { formatSessionRemainingPhrase } from './shared/time.js';

function qs(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function parseTabId() {
  const raw = Number.parseInt(qs('tabId') ?? '', 10);
  return Number.isInteger(raw) && raw >= 0 ? raw : null;
}

function parseStage() {
  const raw = Number.parseInt(qs('stage') ?? '', 10);
  return raw >= 1 && raw <= 3 ? raw : 1;
}

function bindOneClickAction(button, createMessage) {
  let sent = false;
  button.addEventListener('click', () => {
    if (sent) return;
    sent = true;
    button.disabled = true;
    sendToBackground(createMessage()).catch(() => {
      sent = false;
      button.disabled = false;
    });
  });
}

async function main() {
  const targetUrl = qs('target');
  const domain = qs('domain') || 'this site';
  const stage = parseStage();
  const tabId = parseTabId();

  if (!targetUrl || tabId === null || !isHttpUrl(targetUrl)) {
    document.getElementById('headline').textContent = 'Something went wrong';
    document.getElementById('site-line').textContent = 'Close this tab and try again.';
    return;
  }

  document.getElementById('grounding').textContent = randomGroundingMessage();
  document.getElementById('site-line').textContent = `You asked to open ${domain}.`;

  const state = await sendToBackground({ type: Msg.GET_STATE });
  const session = state?.session;
  if (session?.active) {
    document.getElementById('task-title').textContent = session.taskLabel || 'Focused work';
    const left = session.endsAt - Date.now();
    document.getElementById('session-remaining').textContent = formatSessionRemainingPhrase(left);
  } else {
    document.getElementById('task-title').textContent = 'No active session';
    document.getElementById('session-remaining').textContent = '';
  }

  const recoverRow = document.getElementById('recovery-row');
  const btnAllowSession = document.getElementById('btn-allow-session');
  const btnRecover = document.getElementById('btn-recover');
  const normalizedDomain = normalizeDomainInput(domain);
  const canAllowForSession =
    !!session?.active &&
    !!normalizedDomain &&
    !domainInList(normalizedDomain, session.sessionAllowlist || []);
  if (session?.lastProductiveUrl || canAllowForSession) {
    recoverRow.hidden = false;
  }
  if (canAllowForSession) {
    btnAllowSession.hidden = false;
    bindOneClickAction(btnAllowSession, () => ({
      type: Msg.ALLOW_DOMAIN_FOR_SESSION,
      tabId,
      domain: normalizedDomain,
      targetUrl
    }));
  }
  if (session?.lastProductiveUrl) {
    btnRecover.addEventListener('click', () => {
      sendToBackground({ type: Msg.RETURN_TO_WORK, tabId });
    });
  }

  const bindWork = (id) => {
    document.getElementById(id).addEventListener('click', () => {
      sendToBackground({ type: Msg.RETURN_TO_WORK, tabId });
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
    bindOneClickAction(btnOpen, () => ({ type: Msg.GRANT_ONE_SHOT, tabId, domain, targetUrl }));
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
    bindOneClickAction(btnOpen, () => ({ type: Msg.GRANT_ONE_SHOT, tabId, domain, targetUrl }));
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

    bindOneClickAction(btnOpen, () => ({
      type: Msg.GRANT_TEMP_UNLOCK,
      tabId,
      domain,
      targetUrl,
      minutes: 2
    }));
  }
}

main();
