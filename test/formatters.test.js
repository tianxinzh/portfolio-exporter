import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/formatters.js';

const rows = [
  { symbol: 'AAPL', account: 'rh-main', type: 'equity', direction: 'long', quantity: 10, avg_cost: 140, last_price: 150, market_value: 1500, unrealized_pnl: 100, multiplier: 1, instrument_id: 'aapl-id' },
  { symbol: 'SPY 2026-07-17 C500', account: 'rh-main', type: 'option', direction: 'long', quantity: 1, avg_cost: 5, last_price: 6, market_value: 600, unrealized_pnl: 100, multiplier: 100, underlying: 'SPY', expiry: '2026-07-17', strike: 500, right: 'C', option_id: 'opt1' },
  { symbol: 'BTC', account: 'rh-main', type: 'crypto', direction: 'long', quantity: 0.1, avg_cost: 40000, last_price: 50000, market_value: 5000, unrealized_pnl: 1000, multiplier: 1, currency_pair_id: 'pair-btc' },
];
const A = '2026-06-01T00:00:00Z';

test('csv tracker: header + populated price columns', () => {
  const { text, filename, mime } = render(rows, { format: 'csv', preset: 'tracker', asOf: A });
  const L = text.trimEnd().split('\n');
  assert.equal(L[0], 'as_of,account,symbol,type,direction,quantity,avg_cost,last_price,market_value,unrealized_pnl,multiplier,underlying,expiry,strike,right');
  assert.equal(L[1], '2026-06-01T00:00:00Z,rh-main,AAPL,equity,long,10,140,150,1500,100,1,,,,');
  assert.match(filename, /\.csv$/);
  assert.equal(mime, 'text/csv');
});

test('csv fidelity: Fidelity-ish headers + computed cost basis / gain%', () => {
  const L = render(rows, { format: 'csv', preset: 'fidelity', asOf: A }).text.trimEnd().split('\n');
  assert.equal(L[0], 'Account,Symbol,Description,Type,Quantity,Last Price,Average Cost Basis,Cost Basis Total,Current Value,Total Gain/Loss,Total Gain/Loss %');
  assert.equal(L[1], 'rh-main,AAPL,,equity,10,150,140,1400,1500,100,7.14');
});

test('csv raw: includes source ids', () => {
  const L = render(rows, { format: 'csv', preset: 'raw', asOf: A }).text.trimEnd().split('\n');
  assert.ok(L[0].includes('instrument_id') && L[0].includes('option_id') && L[0].includes('currency_pair_id'));
});

test('json: canonical structure', () => {
  const j = JSON.parse(render(rows, { format: 'json', asOf: A }).text);
  assert.equal(j.source, 'robinhood');
  assert.equal(j.positions.length, 3);
  assert.equal(j.positions[1].underlying, 'SPY');
});

test('yaml: positions.yaml shape', () => {
  const { text } = render(rows, { format: 'yaml', asOf: A });
  assert.ok(text.startsWith('as_of: 2026-06-01T00:00:00Z\nsource: robinhood\npositions:\n'));
  assert.ok(text.includes('  - symbol: AAPL'));
});

test('fidelity: short position shows negative quantity, value, cost basis', () => {
  const short = [{ symbol: 'MSFT 2026-07-17 C400', account: 'rh-main', type: 'option', direction: 'short', quantity: 2, avg_cost: 4, last_price: 7, market_value: -1400, unrealized_pnl: -600, multiplier: 100, underlying: 'MSFT', expiry: '2026-07-17', strike: 400, right: 'C', option_id: 'opt2' }];
  const L = render(short, { format: 'csv', preset: 'fidelity', asOf: A }).text.trimEnd().split('\n');
  assert.equal(L[1], 'rh-main,MSFT 2026-07-17 C400,MSFT,option,-2,7,4,-800,-1400,-600,-75');
});

test('filters: type toggle + account relabel + dust', () => {
  const { text } = render(rows, { format: 'csv', preset: 'tracker', account: 'rh-roth', filters: { types: { crypto: false }, dust: 1000 }, asOf: A });
  assert.ok(text.includes('rh-roth'));
  assert.ok(!text.includes('BTC'));
});
