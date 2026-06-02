import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../src/normalizer.js';
import { equityCaptures, optionCaptures, legendOptionCaptures, cryptoCaptures, accountCaptures } from './fixtures.js';

test('equities: merge pages, inline symbol, skip zero, carry instrument_id', () => {
  const { rows, counts } = normalize(equityCaptures);
  assert.equal(counts.equities, 2);
  assert.deepEqual(rows.find((r) => r.symbol === 'AAPL'), {
    symbol: 'AAPL', account: 'rh-main', type: 'equity', direction: 'long',
    quantity: 10, avg_cost: 150,
    last_price: null, market_value: null, unrealized_pnl: null, multiplier: 1,
    instrument_id: 'aapl-id',
  });
  assert.equal(rows.find((r) => r.symbol === 'MSFT').instrument_id, 'msft-id');
});

test('options (aggregate fallback): label, per-share avg, option_id', () => {
  const { rows, counts } = normalize(optionCaptures);
  assert.equal(counts.options, 2);
  assert.deepEqual(rows.find((r) => r.underlying === 'AAPL'), {
    symbol: 'AAPL 2027-01-15 C200', account: 'rh-main', type: 'option', direction: 'long',
    quantity: 1, avg_cost: 5,
    last_price: null, market_value: null, unrealized_pnl: null, multiplier: 100,
    underlying: 'AAPL', expiry: '2027-01-15', strike: 200, right: 'C', option_id: 'aapl-c',
  });
  const msft = rows.find((r) => r.underlying === 'MSFT');
  assert.equal(msft.direction, 'short');
  assert.equal(msft.avg_cost, 3);
  assert.equal(msft.symbol, 'MSFT 2026-07-17 C400');
});

test('options (Legend per-leg): resolve via instruments, dedupe, carry option_id', () => {
  const { rows, counts } = normalize(legendOptionCaptures);
  assert.equal(counts.options, 2);
  assert.deepEqual(rows.find((r) => r.underlying === 'SPY'), {
    symbol: 'SPY 2026-07-17 C500', account: 'rh-main', type: 'option', direction: 'long',
    quantity: 4, avg_cost: 3,
    last_price: null, market_value: null, unrealized_pnl: null, multiplier: 100,
    underlying: 'SPY', expiry: '2026-07-17', strike: 500, right: 'C', option_id: 'spy-c',
  });
  assert.equal(rows.find((r) => r.underlying === 'MSFT').symbol, 'MSFT 2026-07-17 C350');
});

test('crypto: merge, ignore empty response, carry currency_pair_id', () => {
  const { rows, counts } = normalize(cryptoCaptures);
  assert.equal(counts.crypto, 2);
  assert.deepEqual(rows.find((r) => r.symbol === 'BTC'), {
    symbol: 'BTC', account: 'rh-main', type: 'crypto', direction: 'long',
    quantity: 0.1, avg_cost: 100000,
    last_price: null, market_value: null, unrealized_pnl: null, multiplier: 1,
    currency_pair_id: 'pair-btc',
  });
  assert.equal(rows.find((r) => r.symbol === 'ETH').avg_cost, 2000);
});

test('cash: settled cash from accounts/ becomes a CASH position (amount @ $1)', () => {
  const { rows, counts } = normalize(accountCaptures);
  assert.equal(counts.cash, 1);
  assert.deepEqual(rows.find((r) => r.type === 'cash'), {
    symbol: 'CASH', account: 'rh-main', type: 'cash', direction: 'long',
    quantity: 5000, avg_cost: 1, last_price: 1, market_value: 5000, unrealized_pnl: 0, multiplier: 1,
  });
});

test('empty captures → zero', () => {
  const { rows, counts } = normalize([]);
  assert.equal(rows.length, 0);
  assert.deepEqual(counts, { equities: 0, options: 0, crypto: 0, cash: 0 });
});

test('equity with no inline symbol → unresolved', () => {
  const caps = [{ url: 'https://api.robinhood.com/positions/?nonzero=true',
    body: { results: [{ instrument_id: 'no-sym', quantity: '3', average_buy_price: '10' }] } }];
  const { rows, counts, unresolved } = normalize(caps);
  assert.equal(counts.equities, 0);
  assert.equal(rows.length, 0);
  assert.equal(unresolved.length, 1);
});

test('multi-leg flagged unresolved (aggregate fallback)', () => {
  const caps = [{ url: 'https://api.robinhood.com/options/aggregate_positions/?nonzero=true',
    body: { results: [{ id: 'm1', symbol: 'SPY', quantity: '2', average_open_price: '300', legs: [
      { position_type: 'long', option: 'x', expiration_date: '2026-07-17', strike_price: '500', option_type: 'call' },
      { position_type: 'short', option: 'y', expiration_date: '2026-07-17', strike_price: '510', option_type: 'call' },
    ] }] } }];
  const { rows, counts, unresolved } = normalize(caps);
  assert.equal(counts.options, 0);
  assert.ok(unresolved.some((u) => u.includes('multi-leg')));
});
