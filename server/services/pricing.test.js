import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPricingNote, formatRupees, priceEnquiry, priceItem } from './pricing.js';

const catalogue = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'));
const product = (id) => catalogue.find((p) => p.id === id);
const TODAY = '2026-10-26';

test('P001 x20: buy 10 get 1 gives 2 free bottles', () => {
  const item = priceItem(product('P001'), 20, TODAY);
  assert.equal(item.grossValue, 3560);
  assert.equal(item.freeUnits, 2);
  assert.equal(item.discountAmount, 0);
  assert.equal(item.netValue, 3560);
  assert.equal(item.schemeApplied, 'Buy 10 get 1 free');
  assert.equal(item.schemeHint, null);
  assert.equal(item.belowMinOrder, false);
  assert.equal(item.backorder, false);
});

test('P010 x20: free gift of 2 x Grainora iodised salt 1 kg', () => {
  const item = priceItem(product('P010'), 20, TODAY);
  assert.equal(item.grossValue, 5160);
  assert.deepEqual(item.freeGift, { item: 'Grainora iodised salt 1 kg', quantity: 2 });
  assert.equal(item.freeUnits, 0);
  assert.equal(item.netValue, 5160);
});

test('P003 x24: 5% off and flagged as backorder', () => {
  const item = priceItem(product('P003'), 24, TODAY);
  assert.equal(item.grossValue, 2832);
  assert.equal(item.discountAmount, 141.6);
  assert.equal(item.netValue, 2690.4);
  assert.equal(item.backorder, true);
  assert.equal(item.stockStatus, 'out_of_stock');
});

test('P006 x5: flat 25 off per can, low stock', () => {
  const item = priceItem(product('P006'), 5, TODAY);
  assert.equal(item.grossValue, 4725);
  assert.equal(item.discountAmount, 125);
  assert.equal(item.netValue, 4600);
  assert.equal(item.stockStatus, 'low_stock');
  assert.equal(item.backorder, false);
});

test('P011 x10: below scheme threshold and below minimum order', () => {
  const item = priceItem(product('P011'), 10, TODAY);
  assert.equal(item.grossValue, 410);
  assert.equal(item.freeUnits, 0);
  assert.equal(item.netValue, 410);
  assert.equal(item.schemeApplied, null);
  assert.equal(item.schemeHint, 'Add 14 more packs to get 3 free.');
  assert.equal(item.belowMinOrder, true);
  assert.equal(item.minOrderQty, 24);
});

test('expired scheme: P006 x5 on 2026-11-16 gets no discount', () => {
  const item = priceItem(product('P006'), 5, '2026-11-16');
  assert.equal(item.discountAmount, 0);
  assert.equal(item.netValue, 4725);
  assert.equal(item.schemeApplied, null);
  assert.equal(item.schemeHint, null);
});

test('scheme is still active on its validTill date', () => {
  const item = priceItem(product('P006'), 5, '2026-11-15');
  assert.equal(item.discountAmount, 125);
});

test('enquiry total excludes backorder items', () => {
  const { items, enquiryTotal, unknownIds } = priceEnquiry(
    [
      { productId: 'P001', quantity: 20 },
      { productId: 'P010', quantity: 20 },
      { productId: 'P003', quantity: 24 },
    ],
    catalogue,
    TODAY,
  );
  assert.equal(items.length, 3);
  assert.equal(enquiryTotal, 8720);
  assert.deepEqual(unknownIds, []);
});

test('unknown product ids are reported, not priced', () => {
  const { items, unknownIds } = priceEnquiry([{ productId: 'P999', quantity: 5 }], catalogue, TODAY);
  assert.equal(items.length, 0);
  assert.deepEqual(unknownIds, ['P999']);
});

test('pricing note for the architecture turn example', () => {
  const { items, enquiryTotal } = priceEnquiry(
    [
      { productId: 'P001', quantity: 20 },
      { productId: 'P010', quantity: 20 },
    ],
    catalogue,
    TODAY,
  );
  assert.equal(
    buildPricingNote([], items, enquiryTotal),
    'Keshvana Pure Coconut Hair Oil: 20 bottles, with 2 free bottles, net value 3,560 rupees. ' +
      'Grainora Gold Chakki Atta: 20 packs, with 2 free Grainora iodised salt 1 kg, net value 5,160 rupees. ' +
      'Your enquiry total is now 8,720 rupees.',
  );
});

test('pricing note describes only changes and removals, empty when nothing changed', () => {
  const before = priceEnquiry(
    [
      { productId: 'P001', quantity: 20 },
      { productId: 'P010', quantity: 20 },
    ],
    catalogue,
    TODAY,
  );
  const after = priceEnquiry([{ productId: 'P001', quantity: 20 }], catalogue, TODAY);
  assert.equal(
    buildPricingNote(before.items, after.items, after.enquiryTotal),
    'Removed Grainora Gold Chakki Atta. Your enquiry total is now 3,560 rupees.',
  );
  assert.equal(buildPricingNote(after.items, after.items, after.enquiryTotal), '');
});

test('pricing note marks backorder items as excluded from the total', () => {
  const { items, enquiryTotal } = priceEnquiry([{ productId: 'P003', quantity: 24 }], catalogue, TODAY);
  assert.equal(
    buildPricingNote([], items, enquiryTotal),
    'Tarangini Almond Hair Oil: 24 bottles, with 141.60 rupees off, net value 2,690.40 rupees. ' +
      'This is noted as backorder interest because it is out of stock, so it is not included in the total. ' +
      'Your enquiry total is now 0 rupees.',
  );
});

test('formatRupees uses en-IN grouping and drops .00', () => {
  assert.equal(formatRupees(3560), '3,560');
  assert.equal(formatRupees(2690.4), '2,690.40');
  assert.equal(formatRupees(465000), '4,65,000');
});
