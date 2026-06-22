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

test('options: fills per-leg details from instrument metadata when the position row is thin', () => {
  const caps = [
    { url: 'https://api.robinhood.com/options/positions/?nonzero=true', body: { results: [
      { id: 'thin1', type: 'long', quantity: '3.0000', average_price: '125.0000', trade_value_multiplier: '100.0000', option: 'https://api.robinhood.com/options/instruments/tsla-p/' },
    ] } },
    { url: 'https://api.robinhood.com/options/instruments/tsla-p/', body: {
      id: 'tsla-p', url: 'https://api.robinhood.com/options/instruments/tsla-p/', chain_symbol: 'TSLA', expiration_date: '2026-09-18', strike_price: '250.0000', type: 'put',
    } },
  ];
  const { rows, counts, unresolved } = normalize(caps);
  assert.equal(counts.options, 1);
  assert.equal(unresolved.length, 0);
  assert.deepEqual(rows.find((r) => r.underlying === 'TSLA'), {
    symbol: 'TSLA 2026-09-18 P250', account: 'rh-main', type: 'option', direction: 'long',
    quantity: 3, avg_cost: 1.25,
    last_price: null, market_value: null, unrealized_pnl: null, multiplier: 100,
    underlying: 'TSLA', expiry: '2026-09-18', strike: 250, right: 'P', option_id: 'tsla-p',
  });
});

test('options: aggregate capture backfills incomplete per-leg captures', () => {
  const caps = [
    { url: 'https://api.robinhood.com/options/positions/?nonzero=true', body: { results: [
      { id: 'p-nvda', type: 'long', quantity: '1.0000', average_price: '450.0000', trade_value_multiplier: '100.0000', option: 'https://api.robinhood.com/options/instruments/nvda-c/' },
    ] } },
    { url: 'https://api.robinhood.com/options/aggregate_positions/?nonzero=True', body: { results: [
      { id: 'agg-nvda', symbol: 'NVDA', average_open_price: '450.0000', quantity: '1.0000', trade_value_multiplier: '100.0000',
        legs: [{ position_type: 'long', option: 'https://api.robinhood.com/options/instruments/nvda-c/', expiration_date: '2026-08-21', strike_price: '150.0000', option_type: 'call', ratio_quantity: 1 }] },
    ] } },
  ];
  const { rows, counts, unresolved } = normalize(caps);
  assert.equal(counts.options, 1);
  assert.equal(unresolved.length, 0);
  assert.equal(rows[0].symbol, 'NVDA 2026-08-21 C150');
  assert.equal(rows[0].option_id, 'nvda-c');
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

test('cash: uses portfolio_cash (total, incl unsettled) — not settled `cash` — as a CASH position @ $1', () => {
  const { rows, counts } = normalize(accountCaptures);
  assert.equal(counts.cash, 1);
  // fixture: cash 4000 (settled) vs portfolio_cash 5000 (total). Must pick 5000.
  assert.deepEqual(rows.find((r) => r.type === 'cash'), {
    symbol: 'CASH', account: 'rh-main', type: 'cash', direction: 'long',
    quantity: 5000, avg_cost: 1, last_price: 1, market_value: 5000, unrealized_pnl: 0, multiplier: 1,
  });
});

test('cash: same account captured repeatedly is counted once (not summed)', () => {
  const cap = { url: 'https://api.robinhood.com/accounts/?x', body: { results: [{ account_number: 'A1', cash: '2000.00' }] } };
  const { rows } = normalize([cap, cap, cap]); // RH refetches accounts/ several times
  assert.equal(rows.find((r) => r.type === 'cash').market_value, 2000);
});

test('cash: distinct accounts are summed once each', () => {
  const caps = [
    { url: 'https://api.robinhood.com/accounts/?a', body: { results: [{ account_number: 'A1', cash: '1000.00' }] } },
    { url: 'https://api.robinhood.com/accounts/?a', body: { results: [{ account_number: 'A1', cash: '1000.00' }] } },
    { url: 'https://api.robinhood.com/accounts/?b', body: { results: [{ account_number: 'A2', cash: '250.00' }] } },
  ];
  assert.equal(normalize(caps).rows.find((r) => r.type === 'cash').market_value, 1250);
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

test('multi-leg aggregate exports individual option legs', () => {
  const caps = [{ url: 'https://api.robinhood.com/options/aggregate_positions/?nonzero=true',
    body: { results: [{ id: 'm1', symbol: 'SPY', quantity: '2', average_open_price: '300', legs: [
      { position_type: 'long', option: 'https://api.robinhood.com/options/instruments/spy-c500/', expiration_date: '2026-07-17', strike_price: '500', option_type: 'call', ratio_quantity: 1 },
      { position_type: 'short', option: 'https://api.robinhood.com/options/instruments/spy-c510/', expiration_date: '2026-07-17', strike_price: '510', option_type: 'call', ratio_quantity: 1 },
    ] }] } }];
  const { rows, counts, unresolved } = normalize(caps);
  assert.equal(counts.options, 2);
  assert.equal(unresolved.length, 0);
  assert.deepEqual(rows.map((r) => ({
    symbol: r.symbol,
    direction: r.direction,
    quantity: r.quantity,
    avg_cost: r.avg_cost,
    option_id: r.option_id,
  })), [
    { symbol: 'SPY 2026-07-17 C500', direction: 'long', quantity: 2, avg_cost: null, option_id: 'spy-c500' },
    { symbol: 'SPY 2026-07-17 C510', direction: 'short', quantity: 2, avg_cost: null, option_id: 'spy-c510' },
  ]);
});
