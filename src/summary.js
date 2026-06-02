// Pure: summarize enriched rows → per-type counts/values + total. No chrome/DOM.
// Tested in test/summary.test.js.
const TYPES = ['equity', 'option', 'crypto', 'cash'];
const round2 = (n) => Math.round(n * 100) / 100;

export function summarize(rows) {
  const byType = {};
  for (const t of TYPES) byType[t] = { count: 0, value: 0 };
  let total = 0, priced = 0, unpriced = 0;
  for (const r of rows) {
    const b = byType[r.type] || (byType[r.type] = { count: 0, value: 0 });
    b.count += 1;
    if (r.market_value != null) { b.value += r.market_value; total += r.market_value; priced += 1; }
    else unpriced += 1;
  }
  for (const t in byType) byType[t].value = round2(byType[t].value);
  return { total: round2(total), priced, unpriced, byType };
}
