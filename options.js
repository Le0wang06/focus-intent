import { normalizeDomainInput, uniqueDomains } from './shared/domains.js';
import { FRICTION_STYLES, SITE_PRESETS } from './shared/constants.js';

const STORAGE_KEY = 'fi_settings';

const DEFAULT_SETTINGS = {
  blockedDomains: [],
  defaultDurationMinutes: 25,
  frictionStyle: 'balanced',
  extensionEnabled: true,
  lastTaskLabel: '',
  lastTaskType: 'coding'
};

async function loadSettings() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEY] || {}) };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

function sendMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, resolve);
  });
}

function renderDomainList(domains) {
  const ul = document.getElementById('domain-list');
  const hint = document.getElementById('empty-hint');
  ul.innerHTML = '';
  const sorted = [...domains].sort((a, b) => a.localeCompare(b));
  for (const d of sorted) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(d)}</span>`;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn btn-ghost';
    rm.textContent = 'Remove';
    rm.addEventListener('click', async () => {
      const cur = await loadSettings();
      cur.blockedDomains = cur.blockedDomains.filter((x) => normalizeDomainInput(x) !== d);
      await saveSettings(cur);
      await paint();
    });
    li.appendChild(rm);
    ul.appendChild(li);
  }
  hint.hidden = sorted.length > 0;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function setupFrictionSelect() {
  const sel = document.getElementById('friction-style');
  const desc = document.getElementById('friction-desc');
  sel.innerHTML = '';
  for (const f of FRICTION_STYLES) {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.label;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    const f = FRICTION_STYLES.find((x) => x.id === sel.value);
    desc.textContent = f?.description || '';
  });
}

function setupPresets() {
  const wrap = document.getElementById('preset-buttons');
  wrap.innerHTML = '';
  for (const [key, pack] of Object.entries(SITE_PRESETS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost';
    btn.textContent = pack.label;
    btn.addEventListener('click', async () => {
      const cur = await loadSettings();
      const merged = uniqueDomains([...cur.blockedDomains, ...pack.domains]);
      cur.blockedDomains = merged;
      await saveSettings(cur);
      await paint();
    });
    wrap.appendChild(btn);
  }
}

async function paint() {
  const s = await loadSettings();
  renderDomainList(uniqueDomains(s.blockedDomains));
  document.getElementById('default-duration').value = String(s.defaultDurationMinutes);
  document.getElementById('friction-style').value = s.frictionStyle;
  document.getElementById('friction-style').dispatchEvent(new Event('change'));
  document.getElementById('extension-enabled').checked = !!s.extensionEnabled;
}

document.getElementById('add-domain').addEventListener('click', async () => {
  const input = document.getElementById('new-domain');
  const d = normalizeDomainInput(input.value);
  if (!d) return;
  const cur = await loadSettings();
  cur.blockedDomains = uniqueDomains([...cur.blockedDomains, d]);
  await saveSettings(cur);
  input.value = '';
  await paint();
});

document.getElementById('new-domain').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('add-domain').click();
});

document.getElementById('default-duration').addEventListener('change', async () => {
  const cur = await loadSettings();
  let v = Number(document.getElementById('default-duration').value);
  v = Math.max(5, Math.min(480, v || 25));
  cur.defaultDurationMinutes = v;
  document.getElementById('default-duration').value = String(v);
  await saveSettings(cur);
});

document.getElementById('friction-style').addEventListener('change', async () => {
  const cur = await loadSettings();
  cur.frictionStyle = document.getElementById('friction-style').value;
  await saveSettings(cur);
});

document.getElementById('extension-enabled').addEventListener('change', async () => {
  const cur = await loadSettings();
  cur.extensionEnabled = document.getElementById('extension-enabled').checked;
  await saveSettings(cur);
});

document.getElementById('reset-all').addEventListener('click', async () => {
  if (!confirm('Reset all Focus Intent settings to defaults? Your blocked list will be cleared.')) return;
  await saveSettings({ ...DEFAULT_SETTINGS });
  await paint();
});

setupFrictionSelect();
setupPresets();
paint();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) paint();
});
