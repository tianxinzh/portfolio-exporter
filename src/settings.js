// Settings persisted in chrome.storage.sync. DEFAULTS + merge() are pure (tested);
// load/save are thin chrome wrappers.
export const DEFAULTS = {
  format: 'csv',          // csv | json | yaml
  preset: 'tracker',      // tracker | fidelity | raw
  account: 'rh-main',
  types: { equity: true, option: true, crypto: true, cash: true },
  dust: 0,                // drop |market_value| below this (0 = keep everything)
};

export function merge(saved) {
  const s = saved || {};
  return { ...DEFAULTS, ...s, types: { ...DEFAULTS.types, ...(s.types || {}) } };
}

const KEY = 'portfolioExporterSettings';

export async function loadSettings() {
  try { const o = await chrome.storage.sync.get(KEY); return merge(o[KEY]); } catch { return merge(); }
}

export async function saveSettings(s) {
  try { await chrome.storage.sync.set({ [KEY]: s }); } catch {}
}
