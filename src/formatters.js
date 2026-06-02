// Pure: filter canonical rows then render to a chosen format/preset. No chrome/DOM.
// Tested in test/formatters.test.js.
const round2 = (n) => Math.round(n * 100) / 100;
const dirSign = (r) => (r.direction === 'short' ? -1 : 1); // shorts are signed negative
const costBasis = (r) => (r.avg_cost == null ? null : round2(dirSign(r) * r.quantity * r.avg_cost * (r.multiplier || 1)));
const glPct = (r) => { const cb = costBasis(r); return cb && r.unrealized_pnl != null ? round2((r.unrealized_pnl / Math.abs(cb)) * 100) : null; };

const TRACKER = ['as_of', 'account', 'symbol', 'type', 'direction', 'quantity', 'avg_cost',
  'last_price', 'market_value', 'unrealized_pnl', 'multiplier', 'underlying', 'expiry', 'strike', 'right'];
const RAW_ORDER = [...TRACKER, 'instrument_id', 'option_id', 'currency_pair_id'];

// Fidelity-ish: [header, value(row)]. Computed fields where we have the inputs.
const FIDELITY = [
  ['Account', (r) => r.account],
  ['Symbol', (r) => r.symbol],
  ['Description', (r) => r.underlying || ''],
  ['Type', (r) => r.type],
  ['Quantity', (r) => dirSign(r) * r.quantity],
  ['Last Price', (r) => r.last_price],
  ['Average Cost Basis', (r) => r.avg_cost],
  ['Cost Basis Total', (r) => costBasis(r)],
  ['Current Value', (r) => r.market_value],
  ['Total Gain/Loss', (r) => r.unrealized_pnl],
  ['Total Gain/Loss %', (r) => glPct(r)],
];

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

function applyFilters(rows, { types, dust, account }) {
  let out = rows;
  if (types) out = out.filter((r) => types[r.type] !== false);
  if (dust && dust > 0) out = out.filter((r) => {
    const v = r.market_value != null ? Math.abs(r.market_value) : Math.abs((r.quantity || 0) * (r.avg_cost || 0) * (r.multiplier || 1));
    return v >= dust;
  });
  if (account) out = out.map((r) => ({ ...r, account }));
  return out;
}

function rawColumns(rows) {
  const keys = new Set(['as_of']);
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  const cols = RAW_ORDER.filter((k) => keys.has(k));
  for (const k of keys) if (!cols.includes(k)) cols.push(k);
  return cols;
}

function toCsv(rows, preset, asOf) {
  if (preset === 'fidelity') {
    const lines = [FIDELITY.map((c) => csvCell(c[0])).join(',')];
    for (const r of rows) lines.push(FIDELITY.map((c) => csvCell(c[1](r))).join(','));
    return lines.join('\n') + '\n';
  }
  const cols = preset === 'raw' ? rawColumns(rows) : TRACKER;
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map((c) => csvCell(c === 'as_of' ? asOf : r[c])).join(','));
  return lines.join('\n') + '\n';
}

// JSON/YAML always emit the canonical (tracker-shaped) structure.
function canonical(rows) {
  return rows.map((r) => ({
    symbol: r.symbol, account: r.account, type: r.type, direction: r.direction,
    quantity: r.quantity, avg_cost: r.avg_cost, last_price: r.last_price,
    market_value: r.market_value, unrealized_pnl: r.unrealized_pnl, multiplier: r.multiplier,
    ...(r.type === 'option' ? { underlying: r.underlying, expiry: r.expiry, strike: r.strike, right: r.right } : {}),
  }));
}

function toJson(rows, asOf) {
  return JSON.stringify({ as_of: asOf, source: 'robinhood', positions: canonical(rows) }, null, 2) + '\n';
}

const yamlScalar = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  const unsafe = s === '' ||
    /^[\s\-?:,\[\]{}#&*!|>'"%@`]/.test(s) ||   // leading indicator or space
    /\s$/.test(s) ||                            // trailing space
    s.includes(': ') || s.includes(' #') ||     // value/comment separators
    /^(true|false|null|yes|no|~)$/i.test(s) ||  // reserved words
    /^[+-]?\d+(\.\d+)?$/.test(s);               // would parse as a number
  return unsafe ? JSON.stringify(s) : s;
};
function toYaml(rows, asOf) {
  const lines = [`as_of: ${yamlScalar(asOf)}`, 'source: robinhood', 'positions:'];
  for (const r of canonical(rows)) {
    const entries = Object.entries(r).filter(([, v]) => v !== null && v !== undefined);
    entries.forEach(([k, v], i) => lines.push(`${i === 0 ? '  - ' : '    '}${k}: ${yamlScalar(v)}`));
  }
  return lines.join('\n') + '\n';
}

export function render(rows, opts = {}) {
  const { format = 'csv', preset = 'tracker', filters = {}, account, asOf } = opts;
  const stamp = asOf || new Date().toISOString();
  const filtered = applyFilters(rows, { ...filters, account });
  const date = stamp.slice(0, 10);
  if (format === 'json') return { text: toJson(filtered, stamp), filename: `rh-holdings-${date}.json`, mime: 'application/json' };
  if (format === 'yaml') return { text: toYaml(filtered, stamp), filename: `rh-holdings-${date}.yaml`, mime: 'text/yaml' };
  return { text: toCsv(filtered, preset, stamp), filename: `rh-holdings-${date}.csv`, mime: 'text/csv' };
}
