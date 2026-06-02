import { normalize } from './normalizer.js';
import { enrich } from './enrich.js';
import { render } from './formatters.js';
import { loadSettings, saveSettings } from './settings.js';

const countsEl = document.getElementById('counts');
const statusEl = document.getElementById('status');
const button = document.getElementById('download');
const formatEl = document.getElementById('format');
const optionsLink = document.getElementById('options');

let rows = [];

async function getCaptures() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const resp = await chrome.tabs.sendMessage(tab.id, { type: 'rh-get-captures' });
  return (resp && resp.captures) || [];
}

async function init() {
  const settings = await loadSettings();
  formatEl.value = settings.format;
  let captures;
  try {
    captures = await getCaptures();
  } catch {
    statusEl.textContent = 'Open your Robinhood tab, reload it, then reopen this popup.';
    countsEl.textContent = '';
    return;
  }
  const result = normalize(captures);
  rows = enrich(result.rows, captures);
  const { equities, options, crypto } = result.counts;
  const cashRow = rows.find((r) => r.type === 'cash');
  countsEl.textContent = `${equities} equities · ${options} options · ${crypto} crypto`
    + (cashRow ? ` · $${Math.round(cashRow.market_value).toLocaleString()} cash` : '');
  if (result.unresolved.length) {
    statusEl.textContent = `${result.unresolved.length} item(s) unresolved (e.g. multi-leg) — visit that view and reload.`;
  }
  button.disabled = rows.length === 0;
  if (rows.length === 0 && !statusEl.textContent) {
    statusEl.textContent = 'No holdings captured yet — open Portfolio / Options / Crypto, then reopen.';
  }
}

formatEl.addEventListener('change', async () => {
  const s = await loadSettings();
  await saveSettings({ ...s, format: formatEl.value });
});

button.addEventListener('click', async () => {
  const s = await loadSettings();
  const out = render(rows, {
    format: s.format, preset: s.preset, account: s.account,
    filters: { types: s.types, dust: s.dust }, asOf: new Date().toISOString(),
  });
  const url = URL.createObjectURL(new Blob([out.text], { type: out.mime }));
  await chrome.downloads.download({ url, filename: out.filename, saveAs: false });
});

optionsLink.addEventListener('click', () => chrome.runtime.openOptionsPage());

init();
