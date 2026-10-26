import { Router } from 'express';
import { generateJson, isGeminiConfigured } from '../services/gemini.js';
import { buildChatSystemPrompt, CHAT_RESPONSE_SCHEMA, FOLLOW_UP_TYPES, INTENTS } from '../services/prompts.js';
import { buildPricingNote, priceEnquiry, todayLocalISO } from '../services/pricing.js';

const HISTORY_LIMIT = 20;
const FALLBACK_REPLY = "Sorry, I'm having trouble right now. Could you please say that again?";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Keeps known product ids with whole quantities > 0; the last entry wins for duplicate ids.
export function sanitizeItems(rawItems, catalogue) {
  if (!Array.isArray(rawItems)) return [];
  const knownIds = new Set(catalogue.map((p) => p.id));
  const byId = new Map();
  for (const raw of rawItems) {
    const productId = raw?.productId;
    const quantity = Number(raw?.quantity);
    if (!knownIds.has(productId)) {
      console.warn(`[chat] dropped unknown productId: ${productId}`);
      continue;
    }
    byId.delete(productId);
    if (Number.isInteger(quantity) && quantity > 0) byId.set(productId, { productId, quantity });
  }
  return [...byId.values()];
}

// Normalises type, trims details, keeps dueDate only if YYYY-MM-DD, drops duplicates.
export function sanitizeFollowUps(rawFollowUps) {
  if (!Array.isArray(rawFollowUps)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of rawFollowUps) {
    const details = typeof raw?.details === 'string' ? raw.details.trim() : '';
    if (!details) continue;
    const type = FOLLOW_UP_TYPES.includes(raw.type) ? raw.type : 'other';
    const key = `${type}|${details}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const dueDate = typeof raw.dueDate === 'string' && DATE_PATTERN.test(raw.dueDate) ? raw.dueDate : null;
    result.push({ type, details, dueDate });
  }
  return result;
}

// Retailer messages become "user", agent messages "model"; contents must start with a user turn.
function toGeminiContents(messages) {
  const recent = messages.slice(-HISTORY_LIMIT);
  const firstUser = recent.findIndex((m) => m.role === 'retailer');
  return recent.slice(firstUser).map((m) => ({
    role: m.role === 'retailer' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));
}

function isValidMessage(m) {
  return (m?.role === 'retailer' || m?.role === 'agent') && typeof m.text === 'string';
}

export function createChatRouter({ products, retailers }) {
  const router = Router();

  router.post('/chat', async (req, res) => {
    const { retailerId, messages, capturedItems, followUps } = req.body ?? {};

    const retailer = retailers.find((r) => r.id === retailerId);
    if (!retailer) return res.status(404).json({ error: 'Unknown retailer' });

    if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isValidMessage)) {
      return res.status(400).json({ error: 'messages must be a non-empty array of { role, text }' });
    }
    const last = messages[messages.length - 1];
    if (last.role !== 'retailer' || !last.text.trim()) {
      return res.status(400).json({ error: 'The last message must be a non-empty retailer message' });
    }

    if (!isGeminiConfigured()) {
      return res.status(503).json({ error: 'AI not configured: set GEMINI_API_KEY in server/.env and restart the server' });
    }

    const todayISO = todayLocalISO();
    const prevItems = sanitizeItems(capturedItems, products);
    const prevFollowUps = sanitizeFollowUps(followUps);
    const prevPriced = priceEnquiry(prevItems, products, todayISO);

    let aiResult;
    try {
      aiResult = await generateJson({
        systemInstruction: buildChatSystemPrompt({
          todayISO,
          retailer,
          catalogue: products,
          enquiry: prevPriced.items.map(({ productId, productName, quantity, unit }) => ({
            productId,
            productName,
            quantity,
            unit,
          })),
          followUps: prevFollowUps,
        }),
        contents: toGeminiContents(messages),
        schema: CHAT_RESPONSE_SCHEMA,
      });
    } catch {
      return res.json({
        reply: FALLBACK_REPLY,
        intent: 'other',
        pricingNote: '',
        capturedItems: prevPriced.items,
        followUps: prevFollowUps,
        enquiryTotal: prevPriced.enquiryTotal,
        degraded: true,
      });
    }

    const intent = INTENTS.includes(aiResult.intent) ? aiResult.intent : 'other';
    const priced = priceEnquiry(sanitizeItems(aiResult.capturedItems, products), products, todayISO);
    const pricingNote = buildPricingNote(prevPriced.items, priced.items, priced.enquiryTotal, {
      recapAll: intent === 'review_enquiry',
    });
    const aiReply = String(aiResult.reply ?? '').trim();

    res.json({
      reply: [aiReply, pricingNote].filter(Boolean).join(' '),
      intent,
      pricingNote,
      capturedItems: priced.items,
      followUps: sanitizeFollowUps(aiResult.followUps),
      enquiryTotal: priced.enquiryTotal,
      degraded: false,
    });
  });

  return router;
}
