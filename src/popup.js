import { normalize } from './normalizer.js';
import { enrich } from './enrich.js';
import { render } from './formatters.js';
import { summarize } from './summary.js';
import { loadSettings, saveSettings } from './settings.js';

const $ = (id) => document.getElementById(id);
const fmtUsd = (n) => (n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }));
const TYPE_LABEL = { equity: 'Equities', option: 'Options', crypto: 'Crypto', cash: 'Cash' };

let rows = [];

function showEmpty(msg) {
  $('dash').style.display = 'none';
  $('empty').style.display = 'block';
  $('empty').textContent = msg;
}

async function init() {
  const settings = await loadSettings();
  for (const b of $('seg').querySelectorAll('button')) b.classList.toggle('active', b.dataset.f === settings.format);

  let captures;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'rh-get-captures' });
    captures = (resp && resp.captures) || [];
  } catch {
    showEmpty('Open your Robinhood tab, reload it, then reopen this popup.');
    return;
  }

  const result = normalize(captures);
  rows = enrich(result.rows, captures);
  if (rows.length === 0) {
    showEmpty('No holdings captured yet — open Portfolio / Options / Crypto, then reopen.');
    return;
  }

  const s = summarize(rows);
  $('total').textContent = fmtUsd(s.total);
  const rowsEl = $('rows');
  rowsEl.innerHTML = '';
  for (const t of ['equity', 'option', 'crypto', 'cash']) {
    const b = s.byType[t];
    if (!b || b.count === 0) continue;
    const div = document.createElement('div');
    div.className = 'pe-row';
    const label = t === 'cash' ? TYPE_LABEL[t] : `${TYPE_LABEL[t]} · ${b.count}`;
    const val = (t !== 'cash' && b.value === 0 && s.unpriced) ? '—' : fmtUsd(b.value);
    const left = document.createElement('span');
    left.textContent = label;
    const right = document.createElement('span');
    right.className = 'v';
    right.textContent = val;
    div.append(left, right);
    rowsEl.appendChild(div);
  }
  $('download').disabled = false;
  if (result.unresolved.length) {
    $('status').textContent = `${result.unresolved.length} item(s) unresolved — visit that view and reload.`;
  }
}

$('seg').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  for (const x of $('seg').querySelectorAll('button')) x.classList.toggle('active', x === b);
  const s = await loadSettings();
  await saveSettings({ ...s, format: b.dataset.f });
});

$('download').addEventListener('click', async () => {
  const s = await loadSettings();
  const out = render(rows, {
    format: s.format, preset: s.preset, account: s.account,
    filters: { types: s.types, dust: s.dust }, asOf: new Date().toISOString(),
  });
  const url = URL.createObjectURL(new Blob([out.text], { type: out.mime }));
  await chrome.downloads.download({ url, filename: out.filename, saveAs: false });
});

$('options').addEventListener('click', () => chrome.runtime.openOptionsPage());

init();
