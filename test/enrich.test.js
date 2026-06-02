import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enrich } from '../src/enrich.js';

const quoteCaptures = [
  { url: 'https://api.robinhood.com/marketdata/quotes/?ids=x', body: { results: [{ symbol: 'AAPL', last_trade_price: '150.00' }] } },
  { url: 'https://api.robinhood.com/marketdata/options/?ids=y', body: { results: [{ instrument_id: 'opt1', adjusted_mark_price: '6.00' }, { instrument_id: 'opt2', adjusted_mark_price: '8.00' }] } },
  { url: 'https://api.robinhood.com/marketdata/forex/quotes/?ids=z', body: { results: [{ id: 'pair-btc', mark_price: '50000.00' }] } },
];

test('equity: join by symbol → price + value + pnl', () => {
  const [r] = enrich([{ symbol: 'AAPL', type: 'equity', quantity: 10, avg_cost: 140, multiplier: 1, last_price: null, market_value: null, unrealized_pnl: null }], quoteCaptures);
  assert.equal(r.last_price, 150);
  assert.equal(r.market_value, 1500);
  assert.equal(r.unrealized_pnl, 100);
});

test('option (long): join by option_id, value uses multiplier', () => {
  const [r] = enrich([{ symbol: 'SPY C500', type: 'option', direction: 'long', option_id: 'opt1', quantity: 2, avg_cost: 5, multiplier: 100, last_price: null }], quoteCaptures);
  assert.equal(r.last_price, 6);
  assert.equal(r.market_value, 1200);
  assert.equal(r.unrealized_pnl, 200);
});

test('option (short): negative market value (liability) + loss when price rises', () => {
  const [r] = enrich([{ symbol: 'MSFT C400', type: 'option', direction: 'short', option_id: 'opt2', quantity: 2, avg_cost: 5, multiplier: 100, last_price: null }], quoteCaptures);
  assert.equal(r.last_price, 8);
  assert.equal(r.market_value, -1600);
  assert.equal(r.unrealized_pnl, -600);
});

test('crypto: join by currency_pair_id', () => {
  const [r] = enrich([{ symbol: 'BTC', type: 'crypto', currency_pair_id: 'pair-btc', quantity: 0.1, avg_cost: 40000, multiplier: 1, last_price: null }], quoteCaptures);
  assert.equal(r.last_price, 50000);
  assert.equal(r.market_value, 5000);
  assert.equal(r.unrealized_pnl, 1000);
});

test('no matching quote → fields stay null', () => {
  const [r] = enrich([{ symbol: 'ZZZZ', type: 'equity', quantity: 1, avg_cost: 1, multiplier: 1, last_price: null, market_value: null, unrealized_pnl: null }], quoteCaptures);
  assert.equal(r.last_price, null);
  assert.equal(r.market_value, null);
});
