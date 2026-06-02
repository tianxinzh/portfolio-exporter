// Pure: join live prices from marketdata captures onto canonical rows, then derive
// market_value + unrealized_pnl. No chrome/DOM. Tested in test/enrich.test.js.
const isEquityQuotes = (u) => u.includes('/marketdata/quotes');
const isOptionQuotes = (u) => u.includes('/marketdata/options');
const isForexQuotes = (u) => u.includes('/marketdata/forex/quotes');
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const pick = (...xs) => { for (const x of xs) if (x != null) return x; return null; };
const idFromUrl = (u) => (typeof u === 'string' ? u.replace(/\/+$/, '').split('/').pop() : null);
const round2 = (n) => Math.round(n * 100) / 100;

function results(captures, pred) {
  const out = [];
  for (const c of captures) {
    const b = c && c.body;
    if (pred(c.url) && b && Array.isArray(b.results)) for (const r of b.results) if (r) out.push(r);
  }
  return out;
}

export function priceTables(captures) {
  const equity = new Map(), option = new Map(), crypto = new Map();
  for (const q of results(captures, isEquityQuotes)) {
    const p = pick(num(q.last_trade_price), num(q.last_extended_hours_trade_price));
    if (q.symbol && p != null) equity.set(q.symbol, p);
  }
  for (const q of results(captures, isOptionQuotes)) {
    const id = q.instrument_id || idFromUrl(q.instrument);
    const p = pick(num(q.adjusted_mark_price), num(q.last_trade_price), num(q.mark_price));
    if (id && p != null) option.set(id, p);
  }
  for (const q of results(captures, isForexQuotes)) {
    const p = pick(num(q.mark_price), num(q.bid_price));
    if (q.id && p != null) crypto.set(q.id, p);
  }
  return { equity, option, crypto };
}

export function enrich(rows, captures) {
  const t = priceTables(captures);
  return rows.map((r) => {
    let price = null;
    if (r.type === 'equity') price = t.equity.get(r.symbol) ?? null;
    else if (r.type === 'option') price = r.option_id != null ? (t.option.get(r.option_id) ?? null) : null;
    else if (r.type === 'crypto') price = r.currency_pair_id != null ? (t.crypto.get(r.currency_pair_id) ?? null) : null;
    if (price == null) return { ...r };
    const mult = r.multiplier || 1;
    const sq = (r.direction === 'short' ? -1 : 1) * r.quantity; // signed — shorts are liabilities
    const mv = round2(sq * price * mult);
    const cost = r.avg_cost == null ? null : sq * r.avg_cost * mult;
    return { ...r, last_price: price, market_value: mv, unrealized_pnl: cost == null ? null : round2(mv - cost) };
  });
}
