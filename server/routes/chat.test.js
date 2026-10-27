import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidMessage, toGeminiContents } from './chat.js';

test('agent turns send aiText (without the pricing note) when present', () => {
  const contents = toGeminiContents([
    { role: 'retailer', text: 'Price of coconut oil?' },
    { role: 'agent', text: 'It is Rs 178. Total: Rs 1,780.', aiText: 'It is Rs 178.' },
    { role: 'retailer', text: 'Thanks' },
  ]);
  assert.deepEqual(contents, [
    { role: 'user', parts: [{ text: 'Price of coconut oil?' }] },
    { role: 'model', parts: [{ text: 'It is Rs 178.' }] },
    { role: 'user', parts: [{ text: 'Thanks' }] },
  ]);
});

test('empty messages are skipped and contents start with a user turn', () => {
  const contents = toGeminiContents([
    { role: 'agent', text: 'Namaste, how can I help?' },
    { role: 'retailer', text: 'Hi' },
    { role: 'agent', text: '  ' },
    { role: 'retailer', text: 'Any schemes?' },
  ]);
  assert.deepEqual(
    contents.map((c) => [c.role, c.parts[0].text]),
    [
      ['user', 'Hi'],
      ['user', 'Any schemes?'],
    ],
  );
});

test('isValidMessage accepts an optional string aiText only', () => {
  assert.equal(isValidMessage({ role: 'agent', text: 'Hi', aiText: 'Hi' }), true);
  assert.equal(isValidMessage({ role: 'agent', text: 'Hi' }), true);
  assert.equal(isValidMessage({ role: 'agent', text: 'Hi', aiText: 5 }), false);
});
