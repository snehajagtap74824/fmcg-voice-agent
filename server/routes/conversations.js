import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { generateJson, isGeminiConfigured } from '../services/gemini.js';
import { decideOutcome, SENTIMENTS } from '../services/outcome.js';
import { priceEnquiry, todayLocalISO } from '../services/pricing.js';
import { buildSummaryPrompt, SUMMARY_RESPONSE_SCHEMA } from '../services/prompts.js';
import { appendConversation, readConversations } from '../services/store.js';
import { isValidMessage, sanitizeFollowUps, sanitizeItems } from './chat.js';

const SUMMARY_UNAVAILABLE = 'Summary unavailable';

function buildGreeting(retailer) {
  const firstName = retailer.ownerName.split(' ')[0];
  return `Namaste ${firstName} ji, welcome. How can I help ${retailer.name} today?`;
}

// Keeps only the fields we store, so the client cannot add anything else to the record.
function toTranscript(messages) {
  return messages.map(({ role, text, ts, intent }) => ({
    role,
    text: text.trim(),
    ts: typeof ts === 'string' ? ts : null,
    ...(typeof intent === 'string' ? { intent } : {}),
  }));
}

function transcriptText(transcript) {
  return transcript.map((m) => `${m.role === 'agent' ? 'Meera' : 'Retailer'}: ${m.text}`).join('\n');
}

// One Gemini call. Returns null on any failure (or no API key) so the call is still saved.
async function summarise({ retailer, transcript, pricedItems, enquiryTotal, followUps }) {
  if (!isGeminiConfigured()) return null;
  try {
    const result = await generateJson({
      systemInstruction: buildSummaryPrompt({ todayISO: todayLocalISO(), retailer, pricedItems, enquiryTotal, followUps }),
      contents: [{ role: 'user', parts: [{ text: `TRANSCRIPT:\n${transcriptText(transcript)}` }] }],
      schema: SUMMARY_RESPONSE_SCHEMA,
    });
    const summary = String(result.summary ?? '').trim();
    if (!summary) return null;
    return {
      summary,
      outcome: result.outcome,
      sentiment: SENTIMENTS.includes(result.sentiment) ? result.sentiment : null,
    };
  } catch {
    return null; // generateJson has already logged the error
  }
}

function toListEntry(record) {
  return {
    id: record.id,
    retailerId: record.retailerId,
    retailerName: record.retailerName,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    outcome: record.outcome,
    summary: record.summary,
    itemCount: record.productInterests.length,
    enquiryTotal: record.enquiryTotal,
  };
}

export function createConversationsRouter({ products, retailers }) {
  const router = Router();

  // Nothing is saved here: the browser holds the conversation until it ends.
  router.post('/conversations/start', (req, res) => {
    const retailer = retailers.find((r) => r.id === req.body?.retailerId);
    if (!retailer) return res.status(404).json({ error: 'Unknown retailer' });
    res.json({
      conversationId: randomUUID(),
      startedAt: new Date().toISOString(),
      retailer,
      greeting: buildGreeting(retailer),
    });
  });

  // End of call: re-price, summarise with Gemini (optional), set the outcome by rule, save.
  router.post('/summary', async (req, res) => {
    const { conversationId, retailerId, startedAt, messages, capturedItems, followUps } = req.body ?? {};

    const retailer = retailers.find((r) => r.id === retailerId);
    if (!retailer) return res.status(404).json({ error: 'Unknown retailer' });
    if (typeof conversationId !== 'string' || !conversationId.trim()) {
      return res.status(400).json({ error: 'conversationId is required' });
    }
    if (typeof startedAt !== 'string' || Number.isNaN(Date.parse(startedAt))) {
      return res.status(400).json({ error: 'startedAt must be an ISO date string' });
    }
    if (!Array.isArray(messages) || !messages.every(isValidMessage)) {
      return res.status(400).json({ error: 'messages must be an array of { role, text }' });
    }
    if (!messages.some((m) => m.role === 'retailer' && m.text.trim())) {
      return res.json({ saved: false, reason: 'empty' });
    }

    // Read first: a corrupt file fails here, before a Gemini request is spent.
    let saved;
    try {
      saved = await readConversations();
    } catch (err) {
      console.error(`[summary] cannot read conversations.json: ${err.message}`);
      return res.status(500).json({ error: 'Could not save conversation' });
    }
    // A retry or double click for the same call returns the record already saved.
    const existing = saved.find((c) => c.id === conversationId);
    if (existing) return res.json({ saved: true, conversation: existing });

    const transcript = toTranscript(messages);
    const priced = priceEnquiry(sanitizeItems(capturedItems, products), products, todayLocalISO());
    const cleanFollowUps = sanitizeFollowUps(followUps);
    const ai = await summarise({
      retailer,
      transcript,
      pricedItems: priced.items,
      enquiryTotal: priced.enquiryTotal,
      followUps: cleanFollowUps,
    });

    const record = {
      id: conversationId,
      retailerId: retailer.id,
      retailerName: retailer.name,
      ownerName: retailer.ownerName,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      summary: ai?.summary ?? SUMMARY_UNAVAILABLE,
      summaryStatus: ai ? 'ok' : 'unavailable',
      outcome: decideOutcome({
        itemCount: priced.items.length,
        followUpCount: cleanFollowUps.length,
        aiOutcome: ai?.outcome,
      }),
      sentiment: ai?.sentiment ?? null,
      productInterests: priced.items,
      enquiryTotal: priced.enquiryTotal,
      followUps: cleanFollowUps,
      transcript,
    };

    try {
      await appendConversation(record);
    } catch (err) {
      console.error(`[summary] save failed: ${err.message}`);
      return res.status(500).json({ error: 'Could not save conversation' });
    }
    res.status(201).json({ saved: true, conversation: record });
  });

  router.get('/conversations', async (req, res) => {
    try {
      const list = (await readConversations())
        .map(toListEntry)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      res.json(list);
    } catch (err) {
      console.error(`[conversations] ${err.message}`);
      res.status(500).json({ error: 'Could not read saved conversations' });
    }
  });

  router.get('/conversations/:id', async (req, res) => {
    try {
      const record = (await readConversations()).find((c) => c.id === req.params.id);
      if (!record) return res.status(404).json({ error: 'Not found' });
      res.json(record);
    } catch (err) {
      console.error(`[conversations] ${err.message}`);
      res.status(500).json({ error: 'Could not read saved conversations' });
    }
  });

  return router;
}
