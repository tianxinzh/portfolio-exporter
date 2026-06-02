import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../src/summary.js';

test('summarize: per-type counts/values + total, excludes null prices', () => {
  const s = summarize([
    { type: 'equity', market_value: 1500 },
    { type: 'equity', market_value: 500 },
    { type: 'option', market_value: -200 },
    { type: 'crypto', market_value: null },
    { type: 'cash', market_value: 5000 },
  ]);
  assert.equal(s.byType.equity.count, 2);
  assert.equal(s.byType.equity.value, 2000);
  assert.equal(s.byType.option.value, -200);
  assert.equal(s.byType.crypto.count, 1);
  assert.equal(s.byType.crypto.value, 0); // null excluded
  assert.equal(s.byType.cash.value, 5000);
  assert.equal(s.total, 6800); // 1500 + 500 - 200 + 5000
  assert.equal(s.unpriced, 1);
  assert.equal(s.priced, 4);
});

test('summarize: empty → zeros', () => {
  const s = summarize([]);
  assert.equal(s.total, 0);
  assert.deepEqual(s.byType.equity, { count: 0, value: 0 });
});
