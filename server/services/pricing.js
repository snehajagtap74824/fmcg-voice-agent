// Pure pricing and scheme calculations. Gemini never does arithmetic: every
// number the retailer hears or sees about the enquiry comes from this module.

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Server-local date as YYYY-MM-DD (toISOString() is UTC and can shift the date in IST).
export function todayLocalISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSchemeActive(scheme, todayISO) {
  return scheme !== null && scheme !== undefined && todayISO <= scheme.validTill;
}

// pouch -> pouches, bottle -> bottles; singular when count is 1.
export function pluralUnit(unit, count = 2) {
  if (count === 1) return unit;
  return /(ch|sh|s|x)$/.test(unit) ? `${unit}es` : `${unit}s`;
}

// "3,560" or "2,690.40" (en-IN grouping, no ".00").
export function formatRupees(amount) {
  const isWhole = Number.isInteger(round2(amount));
  return round2(amount).toLocaleString('en-IN', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function schemeThreshold(scheme) {
  return scheme.type === 'buy_x_get_y' || scheme.type === 'free_gift' ? scheme.buyQty : scheme.minQty;
}

function schemeBenefitText(scheme, unit) {
  switch (scheme.type) {
    case 'buy_x_get_y':
      return `${scheme.freeQty} free`;
    case 'percent_off':
      return `${scheme.discountPercent}% off`;
    case 'flat_off':
      return `${scheme.discountPerUnit} rupees off per ${unit}`;
    case 'free_gift':
      return `${scheme.giftQty} free ${scheme.giftItem}`;
    default:
      return 'the scheme benefit';
  }
}

export function priceItem(product, quantity, todayISO) {
  const q = quantity;
  const grossValue = round2(q * product.retailerPrice);
  let freeUnits = 0;
  let discountAmount = 0;
  let freeGift = null;
  let schemeApplied = null;
  let schemeHint = null;

  const scheme = product.scheme;
  if (isSchemeActive(scheme, todayISO)) {
    switch (scheme.type) {
      case 'buy_x_get_y':
        freeUnits = Math.floor(q / scheme.buyQty) * scheme.freeQty;
        break;
      case 'percent_off':
        if (q >= scheme.minQty) discountAmount = round2((grossValue * scheme.discountPercent) / 100);
        break;
      case 'flat_off':
        if (q >= scheme.minQty) discountAmount = round2(q * scheme.discountPerUnit);
        break;
      case 'free_gift': {
        const giftQuantity = Math.floor(q / scheme.buyQty) * scheme.giftQty;
        if (giftQuantity > 0) freeGift = { item: scheme.giftItem, quantity: giftQuantity };
        break;
      }
      default:
        break;
    }

    const threshold = schemeThreshold(scheme);
    if (q >= threshold) {
      schemeApplied = scheme.description;
    } else {
      const missing = threshold - q;
      schemeHint = `Add ${missing} more ${pluralUnit(product.unit, missing)} to get ${schemeBenefitText(scheme, product.unit)}.`;
    }
  }

  return {
    productId: product.id,
    productName: product.name,
    unit: product.unit,
    quantity: q,
    retailerPrice: product.retailerPrice,
    grossValue,
    freeUnits,
    discountAmount,
    freeGift,
    netValue: round2(grossValue - discountAmount),
    schemeApplied,
    schemeHint,
    minOrderQty: product.minOrderQty,
    belowMinOrder: q < product.minOrderQty,
    stockStatus: product.stockStatus,
    backorder: product.stockStatus === 'out_of_stock',
  };
}

// Backorder (out-of-stock) items are priced and shown but excluded from the total.
export function priceEnquiry(items, catalogue, todayISO) {
  const byId = new Map(catalogue.map((p) => [p.id, p]));
  const priced = [];
  const unknownIds = [];
  for (const { productId, quantity } of items) {
    const product = byId.get(productId);
    if (!product) {
      unknownIds.push(productId);
      continue;
    }
    priced.push(priceItem(product, quantity, todayISO));
  }
  const enquiryTotal = round2(
    priced.filter((item) => !item.backorder).reduce((sum, item) => sum + item.netValue, 0),
  );
  return { items: priced, enquiryTotal, unknownIds };
}

function itemSentence(item) {
  let text = `${item.productName}: ${item.quantity} ${pluralUnit(item.unit, item.quantity)}`;
  if (item.freeUnits > 0) {
    text += `, with ${item.freeUnits} free ${pluralUnit(item.unit, item.freeUnits)}`;
  } else if (item.discountAmount > 0) {
    text += `, with ${formatRupees(item.discountAmount)} rupees off`;
  } else if (item.freeGift) {
    text += `, with ${item.freeGift.quantity} free ${item.freeGift.item}`;
  }
  text += `, net value ${formatRupees(item.netValue)} rupees.`;
  if (item.schemeHint) text += ` ${item.schemeHint}`;
  if (item.belowMinOrder) {
    text += ` The minimum order is ${item.minOrderQty} ${pluralUnit(item.unit, item.minOrderQty)}, would you like to change the quantity?`;
  }
  if (item.backorder) {
    text += ' This is noted as backorder interest because it is out of stock, so it is not included in the total.';
  }
  return text;
}

// prevItems: priced items before this turn. Returns '' when there is nothing to say.
export function buildPricingNote(prevItems, pricedItems, enquiryTotal, { recapAll = false } = {}) {
  const prevQty = new Map(prevItems.map((item) => [item.productId, item.quantity]));
  const currentIds = new Set(pricedItems.map((item) => item.productId));

  const itemsToDescribe = recapAll
    ? pricedItems
    : pricedItems.filter((item) => prevQty.get(item.productId) !== item.quantity);
  const removed = recapAll ? [] : prevItems.filter((item) => !currentIds.has(item.productId));

  if (!recapAll && itemsToDescribe.length === 0 && removed.length === 0) return '';
  if (recapAll && pricedItems.length === 0) return 'Your enquiry list is empty so far.';

  const sentences = [
    ...itemsToDescribe.map(itemSentence),
    ...removed.map((item) => `Removed ${item.productName}.`),
    `Your enquiry total is now ${formatRupees(enquiryTotal)} rupees.`,
  ];
  return sentences.join(' ');
}
