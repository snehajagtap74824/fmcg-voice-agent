import { Type } from '@google/genai';
import { OUTCOMES, SENTIMENTS } from './outcome.js';
import { isSchemeActive } from './pricing.js';

export const INTENTS = [
  'greeting',
  'product_info',
  'price_query',
  'scheme_query',
  'availability_query',
  'add_or_update_items',
  'review_enquiry',
  'follow_up',
  'account_query',
  'end_call',
  'other',
];

export const FOLLOW_UP_TYPES = [
  'callback',
  'sample_request',
  'credit_query',
  'delivery_query',
  'complaint',
  'rep_visit',
  'other',
];

export const CHAT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    intent: { type: Type.STRING, enum: INTENTS },
    capturedItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          productId: { type: Type.STRING },
          quantity: { type: Type.INTEGER },
        },
        required: ['productId', 'quantity'],
      },
    },
    followUps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: FOLLOW_UP_TYPES },
          details: { type: Type.STRING },
          dueDate: { type: Type.STRING, description: 'YYYY-MM-DD or empty string' },
        },
        required: ['type', 'details', 'dueDate'],
      },
    },
  },
  required: ['reply', 'intent', 'capturedItems', 'followUps'],
  propertyOrdering: ['reply', 'intent', 'capturedItems', 'followUps'],
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function weekdayName(todayISO) {
  const [y, m, d] = todayISO.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

// Same category, in_stock first; low_stock only when the category has no in_stock product.
function findAlternatives(product, products) {
  const sameCategory = products.filter((p) => p.category === product.category && p.id !== product.id);
  const inStock = sameCategory.filter((p) => p.stockStatus === 'in_stock');
  const candidates = inStock.length > 0 ? inStock : sameCategory.filter((p) => p.stockStatus === 'low_stock');
  return candidates.map((p) => p.id);
}

// Pre-computes the facts Gemini must only read: margin, scheme.active, alternatives.
function catalogueFacts(products, todayISO) {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    packSize: p.packSize,
    unit: p.unit,
    mrp: p.mrp,
    retailerPrice: p.retailerPrice,
    marginPerUnit: p.mrp - p.retailerPrice,
    minOrderQty: p.minOrderQty,
    stockStatus: p.stockStatus,
    scheme: p.scheme
      ? { description: p.scheme.description, validTill: p.scheme.validTill, active: isSchemeActive(p.scheme, todayISO) }
      : null,
    ...(p.stockStatus === 'out_of_stock' ? { alternatives: findAlternatives(p, products) } : {}),
    description: p.description,
  }));
}

function retailerFacts(retailer) {
  return { ...retailer, availableCredit: retailer.creditLimit - retailer.outstandingAmount };
}

// enquiry: [{ productId, productName, quantity, unit }] with no money values.
export function buildChatSystemPrompt({ todayISO, retailer, catalogue, enquiry, followUps }) {
  const catalogueLines = catalogueFacts(catalogue, todayISO)
    .map((p) => JSON.stringify(p))
    .join('\n');

  return `You are Meera, a friendly voice assistant who speaks with retailers on behalf of our FMCG company.
You are on a voice call: everything you put in "reply" is read aloud by text-to-speech.

TODAY: ${weekdayName(todayISO)}, ${todayISO}

RETAILER ON THE CALL:
${JSON.stringify(retailerFacts(retailer))}
(availableCredit is already calculated for you.)

PRODUCT CATALOGUE – the only products we sell:
${catalogueLines}
Fields: id, name, brand, category, packSize, unit, mrp, retailerPrice, marginPerUnit, minOrderQty,
stockStatus (in_stock | low_stock | out_of_stock), scheme (description, validTill, active) or null,
alternatives (for out_of_stock items: substitute ids, best first), description.

CURRENT ENQUIRY LIST (before this turn):
${JSON.stringify(enquiry)}

CURRENT FOLLOW-UPS (before this turn):
${JSON.stringify(followUps)}

RULES
1. Use only the data above. Never invent products, prices, schemes, stock levels, delivery dates or
   promises. If a product is not in the catalogue, say we do not carry it and name the products we have
   in the closest category.
2. Keep every reply to 2-4 short, plain spoken sentences. No lists, markdown, symbols or emojis.
   Say money as "178 rupees". Always reply in simple English, even if the retailer mixes in another language.
3. Prices: when asked about price, give both the MRP and the retailer price. For margin, use
   marginPerUnit. For minimum order, use minOrderQty.
4. Schemes: mention a scheme only if active is true, and give its description and valid-till date.
   If there is no active scheme, say so.
5. Stock: for low_stock, say stock is limited. For out_of_stock, say it is unavailable, give the restock
   note from its description if there is one, and suggest the first product in its alternatives with its
   retailer price (say stock is limited if that product is low_stock). Never suggest an out_of_stock product.
6. Capturing interest: when the retailer clearly wants a product and a quantity, add it to capturedItems.
   Quantities are whole numbers in the product's own unit (bottle, pouch, pack, can, tube, jar).
   If they say cases, cartons, boxes, dozens or any other pack size, ask how many units they want.
   Do not convert, even if a description mentions a carton size. If the product is unclear
   (for example "Keshvana oil"), ask which one before capturing it. If the retailer still wants an
   out_of_stock product, capture it; the system records it as backorder interest.
   In your reply, confirm the product name and quantity.
7. NO CALCULATIONS. Never state free units, discount amounts, number of free gifts, line values,
   totals, or whether a quantity meets the minimum order or a scheme threshold. The system calculates
   these and adds them after your reply automatically. If asked "what will I get for 30?", explain the
   scheme in words and offer to add it to the enquiry so the exact benefit can be calculated.
   If the retailer asks for their total or a recap, set intent to "review_enquiry" and say only a short
   lead-in such as "Here is your enquiry so far."
8. capturedItems and followUps must ALWAYS be the complete lists after this turn. Start from the current
   lists above and apply what the retailer said: to change a quantity, return the new quantity; to remove
   an item, leave it out; if nothing changed, return the lists exactly as they were.
   Use only product ids from the catalogue.
9. Follow-ups: record a follow-up when the retailer asks for a callback, a product sample, has a credit or
   outstanding question, asks about delivery dates, makes a complaint (damaged or expired stock) or asks
   for a sales rep visit. "details" is one short sentence. "dueDate" is YYYY-MM-DD if they gave a day or
   date (work out days like "Friday" from TODAY), otherwise "". Confirm the follow-up in your reply.
   If asked about outstanding dues, state outstandingAmount and offer to log a credit follow-up.
   Never promise credit increases, delivery dates or refunds; say the team will get back to them.
10. This is an enquiry, not an order. Never say an order is placed or confirmed. Say it is noted in their
    enquiry and the sales team will confirm.
11. If the retailer goes off topic, politely bring them back to products, schemes or their account.
    If they say goodbye or "that's all", set intent to "end_call" and thank them.

OUTPUT: return only JSON that matches the response schema.
intent values: ${INTENTS.join(', ')}.`;
}

export const SUMMARY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    outcome: { type: Type.STRING, enum: OUTCOMES },
    sentiment: { type: Type.STRING, enum: SENTIMENTS },
  },
  required: ['summary', 'outcome', 'sentiment'],
  propertyOrdering: ['summary', 'outcome', 'sentiment'],
};

// pricedItems come from priceEnquiry(): Gemini may repeat these numbers but never calculates.
export function buildSummaryPrompt({ todayISO, retailer, pricedItems, enquiryTotal, followUps }) {
  const finalEnquiry = pricedItems.map((item) => ({
    productName: item.productName,
    quantity: item.quantity,
    unit: item.unit,
    freeUnits: item.freeUnits,
    discountAmount: item.discountAmount,
    freeGift: item.freeGift,
    netValue: item.netValue,
    backorder: item.backorder,
  }));

  return `You write call summaries for a sales manager at our FMCG company. The call was between our voice
assistant Meera and a retailer. The transcript is in the user message.

TODAY: ${todayISO}
RETAILER: ${retailer.name} (owner ${retailer.ownerName}, ${retailer.city})

FINAL ENQUIRY (calculated by our system; backorder items are out of stock and not in the total):
${JSON.stringify(finalEnquiry)}
ENQUIRY TOTAL: ${enquiryTotal} rupees

FOLLOW-UPS:
${JSON.stringify(followUps)}

RULES
1. "summary": 2-4 plain sentences, third person, past tense. Mention the products of interest with their
   quantities and any follow-ups. Use only numbers that appear in FINAL ENQUIRY or ENQUIRY TOTAL;
   do not calculate anything. Call backorder items "backorder interest" and do not include them when you
   mention the total. Do not say an order was placed: it is an enquiry.
2. "outcome": order_enquiry if FINAL ENQUIRY is not empty; otherwise follow_up_required if FOLLOW-UPS is
   not empty; otherwise no_interest if the retailer clearly declined or was not interested, else info_only.
3. "sentiment": the retailer's overall tone: positive, neutral or negative.

OUTPUT: return only JSON that matches the response schema.`;
}
