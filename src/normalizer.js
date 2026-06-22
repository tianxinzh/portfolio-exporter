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
const pick = (...xs) => {
  for (const x of xs) if (x !== null && x !== undefined && x !== '') return x;
  return null;
};

function refKeys(...refs) {
  const keys = [];
  for (const ref of refs) {
    if (!ref) continue;
    if (typeof ref === 'string') {
      keys.push(ref);
      const id = idFromUrl(ref);
      if (id) keys.push(id);
    } else if (typeof ref === 'object') {
      for (const k of ['id', 'url', 'option_id', 'instrument_id', 'option', 'instrument']) {
        keys.push(...refKeys(ref[k]));
      }
    }
  }
  return [...new Set(keys)];
}

function lookupByRef(map, ...refs) {
  for (const k of refKeys(...refs)) {
    const v = map.get(k);
    if (v) return v;
  }
  return {};
}

const directionFrom = (v) => String(v || '').toLowerCase().includes('short') ? 'short' : 'long';
const optionTypeFrom = (...xs) => String(pick(...xs) || '').toLowerCase();
const optionCandidateComplete = (c) =>
  !c.multileg && c.underlying && c.expiry && c.strikeRaw != null && c.otype && c.qty;

function optionCandidateKey(c) {
  return c.option_id ? `${c.option_id}|${c.direction}` : null;
}

function mergeOptionCandidate(primary, fallback) {
  return {
    underlying: pick(primary.underlying, fallback.underlying),
    expiry: pick(primary.expiry, fallback.expiry),
    strikeRaw: pick(primary.strikeRaw, fallback.strikeRaw),
    otype: pick(primary.otype, fallback.otype),
    direction: pick(primary.direction, fallback.direction),
    qty: pick(primary.qty, fallback.qty),
    perContract: pick(primary.perContract, fallback.perContract),
    mult: pick(primary.mult, fallback.mult),
    multileg: primary.multileg && fallback.multileg,
    option_id: pick(primary.option_id, fallback.option_id),
  };
}

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
      for (const k of refKeys(it)) m.set(k, it);
    }
  }
  return m;
}

function optionLegCandidates(captures) {
  const imap = optionInstrumentMap(captures);
  return gather(captures, isOptionLegs, (p) => p.id).map((p) => {
    const meta = lookupByRef(imap, p.option, p.option_id, p.instrument_id, p.instrument);
    return {
      underlying: pick(p.chain_symbol, p.symbol, meta.chain_symbol, meta.symbol),
      expiry: pick(p.expiration_date, meta.expiration_date),
      strikeRaw: pick(p.strike_price, meta.strike_price),
      otype: optionTypeFrom(p.option_type, p.right, meta.option_type, meta.type, meta.right),
      direction: directionFrom(p.position_type || p.type),
      qty: num(p.quantity), perContract: num(p.average_price),
      mult: num(p.trade_value_multiplier) || num(meta.trade_value_multiplier) || 100, multileg: false,
      option_id: pick(p.option_id, p.instrument_id, idFromUrl(p.option), idFromUrl(p.instrument), meta.id, idFromUrl(meta.url)),
    };
  });
}

function aggregateOptionCandidates(captures) {
  const out = [];
  for (const a of gather(captures, isOptionAggregate, (a) => a.id)) {
    if (!Array.isArray(a.legs) || a.legs.length === 0) {
      out.push({ multileg: true, underlying: a.symbol, qty: num(a.quantity) });
      continue;
    }
    const strategyQty = num(a.quantity);
    const strategyPrice = a.legs.length === 1 ? num(a.average_open_price) : null;
    for (const leg of a.legs) {
      const ratio = num(leg.ratio_quantity) || 1;
      const legPrice = pick(num(leg.average_open_price), num(leg.average_price), strategyPrice);
      out.push({
        underlying: pick(a.symbol, a.chain_symbol, leg.chain_symbol),
        expiry: leg.expiration_date,
        strikeRaw: pick(leg.strike_price, leg.strike),
        otype: optionTypeFrom(leg.option_type, leg.right, leg.type),
        direction: directionFrom(leg.position_type || a.strategy),
        qty: strategyQty == null ? null : strategyQty * ratio,
        perContract: legPrice,
        mult: num(a.trade_value_multiplier) || num(leg.trade_value_multiplier) || 100, multileg: false,
        option_id: leg.option_id || idFromUrl(leg.option),
      });
    }
  }
  return out;
}

// Prefer per-leg rows when complete, but use aggregate rows to backfill thin
// per-leg captures. Robinhood frequently loads both shapes in different orders.
function optionCandidates(captures) {
  const legs = optionLegCandidates(captures);
  const aggregate = aggregateOptionCandidates(captures);
  if (!legs.length) return aggregate;
  if (!aggregate.length) return legs;

  const keyed = new Map(), unkeyed = [];
  for (const c of legs) {
    const k = optionCandidateKey(c);
    if (k) keyed.set(k, c);
    else unkeyed.push(c);
  }
  for (const c of aggregate) {
    const k = optionCandidateKey(c);
    if (!k || !keyed.has(k)) {
      unkeyed.push(c);
      continue;
    }
    const existing = keyed.get(k);
    if (!optionCandidateComplete(existing)) keyed.set(k, mergeOptionCandidate(existing, c));
  }
  return [...keyed.values(), ...unkeyed];
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
  // accounts/ is fetched repeatedly; dedupe by account so cash isn't multiplied.
  // Keep the latest value seen per account, then sum distinct accounts.
  const byAccount = new Map();
  for (const c of captures) {
    if (!isAccounts(c.url) || !c || !c.body || !Array.isArray(c.body.results)) continue;
    for (const a of c.body.results) {
      // portfolio_cash = total account cash (settled + unsettled) — what RH shows as "Cash".
      const v = num(a.portfolio_cash != null ? a.portfolio_cash : a.cash);
      if (v == null) continue;
      byAccount.set(a.account_number || a.account_id || a.url || 'default', v);
    }
  }
  if (byAccount.size === 0) return { rows: [] };
  let cash = 0;
  for (const v of byAccount.values()) cash += v;
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
