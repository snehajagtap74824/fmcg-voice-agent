import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideOutcome } from './outcome.js';

test('captured items always give order_enquiry, whatever Gemini says', () => {
  assert.equal(decideOutcome({ itemCount: 2, followUpCount: 1, aiOutcome: 'no_interest' }), 'order_enquiry');
});

test('follow-ups without items give follow_up_required', () => {
  assert.equal(decideOutcome({ itemCount: 0, followUpCount: 1, aiOutcome: 'info_only' }), 'follow_up_required');
});

test('nothing captured: Gemini may choose no_interest', () => {
  assert.equal(decideOutcome({ itemCount: 0, followUpCount: 0, aiOutcome: 'no_interest' }), 'no_interest');
});

test('nothing captured: any other or missing Gemini value gives info_only', () => {
  assert.equal(decideOutcome({ itemCount: 0, followUpCount: 0, aiOutcome: 'order_enquiry' }), 'info_only');
  assert.equal(decideOutcome({ itemCount: 0, followUpCount: 0, aiOutcome: 'garbage' }), 'info_only');
  assert.equal(decideOutcome({ itemCount: 0, followUpCount: 0 }), 'info_only');
});
