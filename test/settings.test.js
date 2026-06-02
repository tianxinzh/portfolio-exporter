import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, merge } from '../src/settings.js';

test('merge fills defaults and deep-merges types', () => {
  assert.deepEqual(merge(undefined), DEFAULTS);
  const m = merge({ format: 'yaml', types: { crypto: false } });
  assert.equal(m.format, 'yaml');
  assert.deepEqual(m.types, { equity: true, option: true, crypto: false, cash: true });
  assert.equal(m.preset, 'tracker');
});
