import { normalize } from './normalizer.js';
import { enrich } from './enrich.js';
import { render } from './formatters.js';
import { loadSettings, saveSettings, DEFAULTS } from './settings.js';

const els = {
  format: document.getElementById('format'),
  preset: document.getElementById('preset'),
  account: document.getElementById('account'),
  equity: document.getElementById('t-equity'),
  option: document.getElementById('t-option'),
  crypto: document.getElementById('t-crypto'),
  cash: document.getElementById('t-cash'),
  dust: document.getElementById('dust'),
  preview: document.getElementById('preview'),
  previewStatus: document.getElementById('preview-status'),
};

function currentSettings() {
  return {
    format: els.format.value,
    preset: els.preset.value,
    account: els.account.value.trim() || DEFAULTS.account,
    types: { equity: els.equity.checked, option: els.option.checked, crypto: els.crypto.checked, cash: els.cash.checked },
    dust: Number(els.dust.value) || 0,
  };
}

function fill(s) {
  els.format.value = s.format;
  els.preset.value = s.preset;
  els.account.value = s.account;
  els.equity.checked = s.types.equity;
  els.option.checked = s.types.option;
  els.crypto.checked = s.types.crypto;
  els.cash.checked = s.types.cash;
  els.dust.value = s.dust;
}

async function captureRows() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'rh-get-captures' });
    const captures = (resp && resp.captures) || [];
    return enrich(normalize(captures).rows, captures);
  } catch {
    return null;
  }
}

async function refresh() {
  const s = currentSettings();
  await saveSettings(s);
  const rows = await captureRows();
  if (!rows) {
    els.previewStatus.textContent = 'No Robinhood tab found — open robinhood.com (and reload it) to preview your real data.';
    els.preview.textContent = '';
    return;
  }
  els.previewStatus.textContent = `${rows.length} positions captured`;
  const out = render(rows, {
    format: s.format, preset: s.preset, account: s.account,
    filters: { types: s.types, dust: s.dust }, asOf: new Date().toISOString(),
  });
  els.preview.textContent = out.text;
}

for (const el of [els.format, els.preset, els.account, els.equity, els.option, els.crypto, els.cash, els.dust]) {
  el.addEventListener('change', refresh);
  el.addEventListener('input', refresh);
}

(async () => { fill(await loadSettings()); refresh(); })();
