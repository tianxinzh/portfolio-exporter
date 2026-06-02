// Pure module — no chrome/DOM. RH captured payloads → canonical position rows.
// Calibrated against live Classic + Legend payloads; both interfaces hit the same
// REST endpoints. Rows carry source ids (instrument_id / option_id /
// currency_pair_id) so enrich.js can join live prices. Rendering lives in
// formatters.js. Tested in test/normalizer.test.js.

const isOptionAggregate = (u) => u.includes('/options/aggregate_positions');
const isOptionLegs = (u) => u.includes('/options/positions');
const isOptionInstrument = (u) => u.includes('/options/instruments');
const isCrypto = (u) => u.includes('nummus.robinhood.com') && u.includes('/holdings');
const isEquityPositions = (u) =>
  u.includes('api.robinhood.com') && /\/positions\/?(?:\?|$)/.test(u) && !u.includes('/options/');
const isAccounts = (u) => u.includes('api.robinhood.com') && /\/accounts\/(?:\?|$)/.test(u);

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const fmtStrike = (s) => String(Number(s));
const idFromUrl = (u) => (typeof u === 'string' ? u.replace(/\/+$/, '').split('/').pop() : null);

// Concatenate `results` across every matching capture (handles pagination +
// duplicate/empty responses), deduped by a stable key (prefer nonzero quantity).
function gather(captures, pred, keyFn) {
  const seen = new Map();
  for (const c of captures) {
    const b = c && c.body;
    if (!pred(c.url) || !b || !Array.isArray(b.results)) continue;
    for (const row of b.results) {
      const k = keyFn(row);
      if (k == null) seen.set(Symbol(), row);
      else if (!seen.has(k) || num(row.quantity)) seen.set(k, row);
    }
  }
  return [...seen.values()];
}

function normalizeEquities(captures) {
  const raw = gather(captures, isEquityPositions, (p) => p.instrument_id || p.url || p.symbol);
  const rows = [], unresolved = [];
  for (const p of raw) {
    const qty = num(p.quantity);
    if (!qty) continue;
    const symbol = p.symbol; // RH provides the ticker inline
    if (!symbol) { unresolved.push(p.instrument || p.instrument_id || 'equity'); continue; }
    const dir = String(p.type || '').toLowerCase() === 'short' || qty < 0 ? 'short' : 'long';
    rows.push({
      symbol, account: 'rh-main', type: 'equity', direction: dir, quantity: Math.abs(qty),
      avg_cost: num(p.average_buy_price),
      last_price: null, market_value: null, unrealized_pnl: null, multiplier: 1,
      instrument_id: p.instrument_id || idFromUrl(p.instrument),
    });
  }
  return { rows, unresolved };
}

function optionInstrumentMap(captures) {
  const m = new Map();
  for (const c of captures) {
    if (!isOptionInstrument(c.url) || !c || !c.body) continue;
    const items = Array.isArray(c.body.results) ? c.body.results : (c.body.id ? [c.body] : []);
    for (const it of items) {
      if (it.url) m.set(it.url, it);
      if (it.id) m.set(it.id, it);
    }
  }
  return m;
}

// Prefer the per-leg endpoint (present on both UIs); fall back to aggregate.
function optionCandidates(captures) {
  const legs = gather(captures, isOptionLegs, (p) => p.id);
  if (legs.length) {
    const imap = optionInstrumentMap(captures);
    return legs.map((p) => {
      const meta = imap.get(p.option) || imap.get(p.option_id) || {};
      return {
        underlying: p.chain_symbol, expiry: p.expiration_date || meta.expiration_date,
        strikeRaw: meta.strike_price, otype: String(meta.type || '').toLowerCase(),
        direction: String(p.type || '').toLowerCase() === 'short' ? 'short' : 'long',
        qty: num(p.quantity), perContract: num(p.average_price),
        mult: num(p.trade_value_multiplier) || 100, multileg: false,
        option_id: p.option_id || idFromUrl(p.option),
      };
    });
  }
  return gather(captures, isOptionAggregate, (a) => a.id).map((a) => {
    if (!Array.isArray(a.legs) || a.legs.length !== 1) return { multileg: true, underlying: a.symbol, qty: num(a.quantity) };
    const leg = a.legs[0];
    return {
      underlying: a.symbol, expiry: leg.expiration_date, strikeRaw: leg.strike_price,
      otype: String(leg.option_type || '').toLowerCase(),
      direction: String(leg.position_type || '').toLowerCase() === 'short' ? 'short' : 'long',
      qty: num(a.quantity), perContract: num(a.average_open_price),
      mult: num(a.trade_value_multiplier) || 100, multileg: false,
      option_id: leg.option_id || idFromUrl(leg.option),
    };
  });
}

function normalizeOptions(captures) {
  const rows = [], unresolved = [], seen = new Set();
  for (const c of optionCandidates(captures)) {
    if (!c.qty) continue;
    if (c.multileg) { unresolved.push((c.underlying || '?') + ' (multi-leg)'); continue; }
    if (!c.underlying || !c.expiry || c.strikeRaw == null || !c.otype) {
      unresolved.push((c.underlying || '?') + ' option'); continue;
    }
    const right = c.otype.startsWith('c') ? 'C' : 'P';
    const symbol = `${c.underlying} ${c.expiry} ${right}${fmtStrike(c.strikeRaw)}`;
    const key = `${symbol}|${c.direction}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      symbol, account: 'rh-main', type: 'option', direction: c.direction,
      quantity: Math.abs(c.qty),
      avg_cost: c.perContract == null ? null : Math.abs(c.perContract) / c.mult,
      last_price: null, market_value: null, unrealized_pnl: null, multiplier: c.mult,
      underlying: c.underlying, expiry: c.expiry, strike: Number(c.strikeRaw), right,
      option_id: c.option_id,
    });
  }
  return { rows, unresolved };
}

function normalizeCrypto(captures) {
  const raw = gather(captures, isCrypto, (h) => h.id || (h.currency && h.currency.code));
  const rows = [];
  for (const h of raw) {
    const qty = num(h.quantity);
    if (!qty) continue;
    const code = h.currency && h.currency.code;
    if (!code) continue;
    const cb = Array.isArray(h.cost_bases) ? h.cost_bases[0] : null;
    const basis = cb ? num(cb.direct_cost_basis) : null;
    const dqty = cb ? num(cb.direct_quantity) : null;
    rows.push({
      symbol: code, account: 'rh-main', type: 'crypto', direction: 'long',
      quantity: Math.abs(qty),
      avg_cost: basis != null && dqty ? basis / dqty : null,
      last_price: null, market_value: null, unrealized_pnl: null, multiplier: 1,
      currency_pair_id: h.currency_pair_id || null,
    });
  }
  return { rows, unresolved: [] };
}

// Settled cash from api.robinhood.com/accounts/ → one CASH row (amount @ $1, so
// market_value = the cash balance). Summed across accounts if more than one.
function normalizeCash(captures) {
  let cash = null;
  for (const c of captures) {
    if (!isAccounts(c.url) || !c || !c.body || !Array.isArray(c.body.results)) continue;
    for (const a of c.body.results) {
      const v = num(a.cash != null ? a.cash : a.portfolio_cash);
      if (v != null) cash = (cash || 0) + v;
    }
  }
  if (cash == null) return { rows: [] };
  const amt = Math.round(cash * 100) / 100;
  return { rows: [{
    symbol: 'CASH', account: 'rh-main', type: 'cash', direction: 'long',
    quantity: amt, avg_cost: 1, last_price: 1, market_value: amt, unrealized_pnl: 0, multiplier: 1,
  }] };
}

export function normalize(captures) {
  const e = normalizeEquities(captures);
  const o = normalizeOptions(captures);
  const c = normalizeCrypto(captures);
  const cash = normalizeCash(captures);
  return {
    rows: [...e.rows, ...o.rows, ...c.rows, ...cash.rows],
    counts: { equities: e.rows.length, options: o.rows.length, crypto: c.rows.length, cash: cash.rows.length },
    unresolved: [...e.unresolved, ...o.unresolved, ...c.unresolved],
  };
}
