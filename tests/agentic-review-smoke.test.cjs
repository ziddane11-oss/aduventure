'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Deliberate failure for a temporary CI/AI-review test PR. Do not merge.
test('agentic-review smoke: intentional failure', () => {
  assert.equal(1, 2, 'Intentional failure: verify the AI reports test evidence');
});
