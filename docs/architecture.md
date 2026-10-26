# Architecture – FMCG Retailer Voice Agent (Prototype)

This document describes how the prototype is built. It goes with `docs/requirements.md` (user stories US-1 to US-8, scheme rules in section 6). The design aims to be **simple enough to build in 4–5 hours and easy to explain in an interview.**

Three ideas drive the design:

1. **Gemini talks, code calculates.** Gemini understands the retailer and writes the reply. All prices, free units, discounts and totals come from a pure JavaScript module.
2. **The server is stateless.** The browser holds the conversation and sends it with every request. Nothing is written to disk until the call ends.
3. **Gemini returns the full captured list every turn**, not just the changes. This makes corrections and removals work without any merge logic.

---

## 1. Overview and request flow

```
 Browser (React, Vite :5173)                     Express (:3001)                         Gemini API
 ─────────────────────────────                   ─────────────────────────────           ──────────
 Mic ─► SpeechRecognition ─► text ─┐
 Keyboard ─────────────────────────┤
                                   ▼
                        useConversation.send()
                                   │  POST /api/chat
                                   │  { retailerId, messages[], capturedItems[], followUps[] }
                                   └──────────────────────────────►  routes/chat.js
                                                                      1. build system prompt
                                                                         (today, retailer, catalogue,
                                                                          current enquiry list)
                                                                      2. generateContent ─────────────► JSON:
                                                                         (structured output)  ◄──────── { reply, intent,
                                                                                                          capturedItems,
                                                                                                          followUps }
                                                                      3. validate ids, drop unknowns
                                                                      4. pricing.js prices the items
                                                                      5. reply += code-made pricing note
                                   ┌──────────────────────────────── { reply, intent, capturedItems (priced),
                                   │                                    followUps, enquiryTotal }
                                   ▼
             Chat + side panel update ─► speechSynthesis.speak(reply)

 End Conversation ─► POST /api/conversations/end ─► re-price ─► Gemini summary ─► append to conversations.json
 History          ─► GET  /api/conversations(/:id) ─► read conversations.json
```

Gemini is called only from the server. The browser never sees the API key.

---

## 2. Folder structure

The Vite app is already at the **repo root** (`index.html`, `src/`, `vite.config.js`), so the frontend stays there. The backend is a separate Node project in `server/` with its own `package.json`.

```
fmcg-voice-agent/
├── index.html                      Vite entry HTML (existing)
├── package.json                    Frontend deps and scripts (existing)
├── vite.config.js                  Adds a dev proxy: /api -> http://localhost:3001
├── docs/
│   ├── requirements.md             User stories, scope, scheme rules
│   └── architecture.md             This document
├── src/
│   ├── main.jsx                    React root (existing)
│   ├── App.jsx                     Holds view state (home | conversation | history) and switches screens
│   ├── App.css                     All styles (one file, plain CSS)
│   ├── api.js                      Small fetch wrappers for every /api endpoint
│   ├── format.js                   formatINR(), formatDateTime(), outcome labels
│   ├── hooks/
│   │   ├── useSpeech.js            Speech-to-text, text-to-speech, support detection, mute, errors
│   │   └── useConversation.js      Messages, captured items, follow-ups, totals; start/send/end
│   └── components/
│       ├── HomeScreen.jsx          Retailer dropdown, Start Conversation, link to History
│       ├── ConversationScreen.jsx  Joins both hooks; lays out the header, chat, input and side panel
│       ├── RetailerHeader.jsx      Retailer name, city, type, outstanding amount
│       ├── ChatWindow.jsx          Scrolling message list with a "thinking..." indicator
│       ├── ChatInput.jsx           Mic button with listening state, text box, Send, mute toggle
│       ├── CapturePanel.jsx        Captured items table (qty, free/discount, net), total, follow-ups
│       ├── SummaryView.jsx         Summary shown after End, and reused in the history detail view
│       ├── HistoryList.jsx         Saved conversations, newest first, empty state, optional filters
│       └── ConversationDetail.jsx  One saved conversation: summary, items, follow-ups, transcript
└── server/
    ├── package.json                express, @google/genai, dotenv, cors; "type": "module"
    ├── .env.example                GEMINI_API_KEY=, GEMINI_MODEL=, PORT= (the real .env is gitignored)
    ├── index.js                    Loads .env, checks config, sets up JSON body parsing, mounts routes, starts server
    ├── routes/
    │   ├── data.js                 GET /api/products, GET /api/retailers
    │   ├── chat.js                 POST /api/chat (one conversation turn)
    │   └── conversations.js        POST start, POST end, GET list, GET by id
    ├── services/
    │   ├── store.js                Reads and writes JSON files in server/data (handles a missing file)
    │   ├── gemini.js               SDK client, generateJson() with timeout + one retry + JSON parse
    │   ├── prompts.js              Builds the chat and summary prompts; holds both response schemas
    │   ├── pricing.js              Pure scheme and value calculations; builds the pricing note
    │   └── pricing.test.js         node:test unit tests for the worked examples in section 7
    └── data/
        ├── products.json           12 fictional products (existing)
        ├── retailers.json          5 fictional retailers (existing)
        └── conversations.json      Saved calls; committed with one sample record so History is not empty in the demo
```

The unused Vite starter assets (`src/assets/*`, starter CSS) can be removed when `App.jsx` is replaced.

---

## 3. Frontend

### 3.1 Component tree

```
App                                  view: 'home' | 'conversation' | 'history'
├── HomeScreen                       (view = home)
│     loads GET /api/retailers; retailer <select>; Start is disabled until one is picked
├── ConversationScreen               (view = conversation) uses useConversation + useSpeech
│   ├── RetailerHeader               retailer name, city, type, outstanding; End Conversation button
│   ├── ChatWindow                   messages[]; "Agent is thinking..." while a request is pending
│   ├── ChatInput                    mic (hidden if unsupported or blocked), text box + Send, mute toggle,
│   │                                interim transcript, short error note
│   ├── CapturePanel                 capturedItems[], enquiryTotal, followUps[]
│   └── SummaryView                  replaces the chat after End: summary, outcome, items, "Back to home"
└── HistoryList                      (view = history) GET /api/conversations; click a row to open detail
    └── ConversationDetail           GET /api/conversations/:id; reuses SummaryView, then the transcript
```

There is no router and no state library. `App` keeps `view` and `selectedRetailerId` in `useState`. `HistoryList` keeps `selectedId` in `useState` and shows `ConversationDetail` when it is set.

### 3.2 `useSpeech` – voice in and voice out

```js
const speech = useSpeech({ lang = 'en-IN', onFinalText })
// returns
{
  sttSupported,     // boolean: window.SpeechRecognition || window.webkitSpeechRecognition exists
  ttsSupported,     // boolean: 'speechSynthesis' in window
  micBlocked,       // boolean: true after a 'not-allowed' / 'service-not-allowed' error
  listening,        // boolean
  interimText,      // string: live partial transcript, shown under the input
  speaking,         // boolean
  muted,            // boolean
  error,            // string | null: short message for the user, cleared on the next start
  startListening,   // () => void   (stops any speech that is playing first)
  stopListening,    // () => void
  speak,            // (text) => void  (does nothing if muted or TTS is unsupported)
  stopSpeaking,     // () => void
  toggleMute,       // () => void   (muting also stops current speech)
}
```

How it works:
- One `SpeechRecognition` instance, created lazily and kept in a `useRef`. Settings: `lang = 'en-IN'`, `interimResults = true`, `continuous = false`. When a final result arrives, the hook calls `onFinalText(text)`, and the screen passes that text to `send()`.
- `startListening()` calls `speechSynthesis.cancel()` first. This meets "starting a new mic input stops any speech that is still playing".
- `speak(text)` cancels any current speech, then speaks a new `SpeechSynthesisUtterance`. It uses an `en-IN` voice if one exists, otherwise the default voice. Chrome loads voices late, so the hook reads them again on `voiceschanged`.
- Error mapping (`recognition.onerror`):
  - `not-allowed`, `service-not-allowed`: set `micBlocked = true` and show "Microphone blocked – please type".
  - `no-speech`: "Didn't catch that – try again".
  - `network`: "Voice service unavailable – please type".
  - `aborted`: ignored.
- If `sttSupported` is false or `micBlocked` is true, `ChatInput` hides the mic and shows "Voice not supported – please type". The text box is always there.
- On unmount, the hook calls `recognition.abort()` and `speechSynthesis.cancel()`.

### 3.3 `useConversation` – conversation state and server calls

```js
const convo = useConversation()
// returns
{
  status,           // 'idle' | 'active' | 'sending' | 'ending' | 'ended'
  conversation,     // { id, startedAt, retailer } | null
  messages,         // [{ role: 'agent' | 'retailer', text, ts, intent? }]
  capturedItems,    // priced items, exactly as the server returned them (see section 7)
  followUps,        // [{ type, details, dueDate }]
  enquiryTotal,     // number (from the server)
  result,           // response of /end: { saved, conversation?, reason? }
  error,            // string | null
  start,            // async (retailerId) => greetingText
  send,             // async (text) => replyText      (adds the retailer message straight away)
  end,              // async () => result
  reset,            // () => void
}
```

- `send` adds the retailer message to the list, then posts `{ retailerId, messages, capturedItems: [{productId, quantity}], followUps }`. It replaces `capturedItems`, `followUps` and `enquiryTotal` with the server's response. It ignores empty text, and it ignores calls while `status === 'sending'`.
- `start` and `send` **return the agent's text**, and `ConversationScreen` passes it to `speech.speak()`. This keeps the two hooks separate: `useConversation` knows nothing about speech.
- `end` checks on the client first. If there are no retailer messages, it does not call the server. It sets `result = { saved: false, reason: 'empty' }`, the UI shows "Nothing to save", and the app goes back to home.
- The client never calculates money. It only displays numbers from the server.

---

## 4. API endpoints

All endpoints use JSON. Errors look like `{ "error": "message" }` with a suitable HTTP status.

### Stateless server (decision)

The browser keeps the whole conversation: messages, captured items and follow-ups. It sends them with every `/api/chat` call. The server keeps no session in memory.

Why this is the simplest option that works:
- There is no session map, no expiry and no cleanup, and nothing is lost if the server restarts during a call.
- Each request carries everything needed to build the prompt, so a single request can be tested with curl.
- The payload is small. There are about 12 products, and the history is capped at the last 20 messages for the prompt.
- Trade-off: the client could send tampered items. The server only trusts `productId` and `quantity` and **re-prices everything** from `products.json`, so the money values cannot be faked. That is good enough for a prototype with no login.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/products` | Catalogue for display/debugging |
| GET | `/api/retailers` | Retailer dropdown |
| POST | `/api/conversations/start` | New ID, start time and greeting (nothing saved) |
| POST | `/api/chat` | One turn: Gemini reply plus priced captured items |
| POST | `/api/conversations/end` | Summary, then save to `conversations.json` |
| GET | `/api/conversations` | History list, newest first |
| GET | `/api/conversations/:id` | One full saved record |
| GET | `/api/health` | `{ ok: true, geminiConfigured: boolean, model }` |

**GET /api/products** → `200 [ ...products.json ]`
**GET /api/retailers** → `200 [ ...retailers.json ]`

**POST /api/conversations/start**
The server creates the ID and timestamp so that both use the server clock. The greeting is a **code template, not a Gemini call**, so it is instant and always correct.
```json
// request
{ "retailerId": "R001" }
// 200 response
{
  "conversationId": "3f9c1e2a-7b4d-4c1e-9a55-0d2b6c8e1f10",
  "startedAt": "2026-10-26T10:15:02.120Z",
  "retailer": { "id": "R001", "name": "Shree Ganesh Kirana Store", "ownerName": "Ramesh Patil", "city": "Pune", "type": "kirana", "outstandingAmount": 12500 },
  "greeting": "Namaste Ramesh ji, welcome. How can I help Shree Ganesh Kirana Store today?"
}
// 404 { "error": "Unknown retailer" }
```

**POST /api/chat**
```json
// request (the last message is the new retailer message)
{
  "retailerId": "R001",
  "messages": [
    { "role": "agent",    "text": "Namaste Ramesh ji, welcome. ...", "ts": "2026-10-26T10:15:02.120Z" },
    { "role": "retailer", "text": "Send me 20 bottles of Keshvana coconut oil", "ts": "2026-10-26T10:15:20.410Z" }
  ],
  "capturedItems": [],
  "followUps": []
}
// 200 response
{
  "reply": "Sure Ramesh ji, I have noted 20 bottles of Keshvana Pure Coconut Hair Oil 500 ml in your enquiry. Keshvana Pure Coconut Hair Oil: 20 bottles, with 2 free bottles, net value 3,560 rupees. Your enquiry total is now 3,560 rupees.",
  "intent": "add_or_update_items",
  "pricingNote": "Keshvana Pure Coconut Hair Oil: 20 bottles, with 2 free bottles, net value 3,560 rupees. Your enquiry total is now 3,560 rupees.",
  "capturedItems": [ { "productId": "P001", "productName": "Keshvana Pure Coconut Hair Oil", "quantity": 20, "unit": "bottle", "...": "priced fields, see section 7" } ],
  "followUps": [],
  "enquiryTotal": 3560,
  "degraded": false
}
```
`degraded: true` means Gemini failed. In that case `reply` is the fallback text and the items and follow-ups are the ones the client sent, re-priced and unchanged.

**POST /api/conversations/end**
```json
// request
{
  "conversationId": "3f9c1e2a-...", "retailerId": "R001", "startedAt": "2026-10-26T10:15:02.120Z",
  "messages": [ ... ], "capturedItems": [ { "productId": "P001", "quantity": 20 } ], "followUps": [ ... ]
}
// 201 response: { "saved": true, "conversation": { ...full record, section 9 } }
// 200 response when there are no retailer messages: { "saved": false, "reason": "empty" }
// 500 { "error": "Could not save conversation" }  (the client stays on the screen so the user can retry)
```

**GET /api/conversations** (optional `?retailerId=R001&outcome=order_enquiry`)
```json
[ { "id": "3f9c...", "retailerId": "R001", "retailerName": "Shree Ganesh Kirana Store",
    "startedAt": "2026-10-26T10:15:02.120Z", "outcome": "order_enquiry", "itemCount": 3, "enquiryTotal": 8720 } ]
```

**GET /api/conversations/:id** → `200 { ...full record }` or `404 { "error": "Not found" }`

---

## 5. Gemini chat system prompt

`prompts.js → buildChatSystemPrompt({ today, retailer, catalogue, enquiry, followUps })` fills in the placeholders below. It is sent as `config.systemInstruction`. The conversation history goes in `contents`: retailer messages become `user` and agent messages become `model`. The template greeting is left out so that `contents` starts with a `user` turn.

**Code prepares the facts before the prompt is built, so Gemini only has to read them, never work them out:**
- `marginPerUnit = mrp − retailerPrice` for each product.
- `scheme.active = today ≤ validTill`.
- `alternatives` for each `out_of_stock` product: same category, `in_stock` first. If there is no `in_stock` product, `low_stock` products are used.
- `availableCredit = creditLimit − outstandingAmount` for the retailer.
- `today` is the server's **local** date (`YYYY-MM-DD`) plus the weekday name. UTC `toISOString()` is not used, because it can shift the date in IST.

The catalogue is sent as compact JSON, one product per line. The current enquiry contains only `productId`, `productName`, `quantity` and `unit`, with **no money values**.

```text
You are Meera, a friendly voice assistant who speaks with retailers on behalf of our FMCG company.
You are on a voice call: everything you put in "reply" is read aloud by text-to-speech.

TODAY: {{TODAY_WEEKDAY}}, {{TODAY_ISO}}

RETAILER ON THE CALL:
{{RETAILER_JSON}}
(availableCredit is already calculated for you.)

PRODUCT CATALOGUE – the only products we sell:
{{CATALOGUE_JSON}}
Fields: id, name, brand, category, packSize, unit, mrp, retailerPrice, marginPerUnit, minOrderQty,
stockStatus (in_stock | low_stock | out_of_stock), scheme (description, validTill, active) or null,
alternatives (for out_of_stock items: substitute ids, best first), description.

CURRENT ENQUIRY LIST (before this turn):
{{ENQUIRY_JSON}}

CURRENT FOLLOW-UPS (before this turn):
{{FOLLOWUPS_JSON}}

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
intent values: greeting, product_info, price_query, scheme_query, availability_query,
add_or_update_items, review_enquiry, follow_up, account_query, end_call, other.
```

Call settings: `model = process.env.GEMINI_MODEL || 'gemini-3.5-flash'`; on failure it tries each model in `GEMINI_FALLBACK_MODELS` once (default `gemini-3.1-flash-lite,gemini-3.6-flash`), because each model has its own free-tier quota and models can be busy (503) or retired. Thinking is off (`thinkingBudget: 0`), which cuts a turn from ~19s to ~5s. `temperature: 0.3`, `responseMimeType: 'application/json'`, `responseSchema` (section 6). The SDK call is `ai.models.generateContent({ model, contents, config })` from `@google/genai`.

---

## 6. Per-turn response schema (Gemini structured output)

The schema is defined once in `prompts.js` with the SDK's `Type` enum and passed as `config.responseSchema`.

```json
{
  "type": "OBJECT",
  "properties": {
    "reply":  { "type": "STRING" },
    "intent": { "type": "STRING", "enum": ["greeting","product_info","price_query","scheme_query",
                "availability_query","add_or_update_items","review_enquiry","follow_up",
                "account_query","end_call","other"] },
    "capturedItems": { "type": "ARRAY", "items": { "type": "OBJECT",
        "properties": { "productId": { "type": "STRING" }, "quantity": { "type": "INTEGER" } },
        "required": ["productId","quantity"] } },
    "followUps": { "type": "ARRAY", "items": { "type": "OBJECT",
        "properties": {
          "type":    { "type": "STRING", "enum": ["callback","sample_request","credit_query",
                       "delivery_query","complaint","rep_visit","other"] },
          "details": { "type": "STRING" },
          "dueDate": { "type": "STRING", "description": "YYYY-MM-DD or empty string" } },
        "required": ["type","details","dueDate"] } }
  },
  "required": ["reply","intent","capturedItems","followUps"],
  "propertyOrdering": ["reply","intent","capturedItems","followUps"]
}
```

Gemini returns only `productId` and `quantity`. The product name, unit and all money fields are added by code from `products.json`, so Gemini cannot get them wrong.

### Full list, not a delta (decision)

Gemini returns the **complete current list** every turn, and it sees the current list in its prompt.
- Corrections ("make it 30") and removals ("drop the atta") are handled with no special logic. The server just uses the new list.
- With deltas, the design would need add/update/remove operations and merge rules, and a missed delta would leave the list wrong. With a full list, one bad turn is fixed on the next turn.
- Risk: Gemini could drop an item by mistake. Two things reduce this: the current list is in the prompt every turn, and rule 8 says to return the list unchanged if nothing changed. Every agent turn also shows the panel, so the user would see the problem and can correct it.

### What the server does with the response (`routes/chat.js`)
1. Parse the JSON. If parsing fails, retry once (see section 10).
2. **Items:** keep only entries whose `productId` exists in the catalogue (log and drop unknown ones). Keep only whole numbers > 0; a quantity ≤ 0 means the item is removed. If a `productId` appears twice, keep the last one.
3. **Follow-ups:** if `type` is not in the enum, use `other`. Trim `details` and drop it if empty. Keep `dueDate` only if it matches `YYYY-MM-DD`, otherwise use `null`. Drop exact duplicates (same type and details).
4. Price the validated list with `pricing.priceEnquiry()`.
5. Build the pricing note by comparing the client's previous list with the new one, and add it after `reply`.
6. Return `{ reply, intent, pricingNote, capturedItems, followUps, enquiryTotal, degraded }`.

---

## 7. Pricing and schemes (`server/services/pricing.js`)

### The problem
The retailer hears free units, discounts and totals in the spoken reply, and those numbers must be correct. LLM arithmetic is not reliable: "floor(27/10)" or "5% of 2832" can come out wrong. So **every number about the enquiry must come from code**, while the reply still sounds natural.

### Options considered

| | (a) Two Gemini calls per turn | (b) One call; code adds a pricing note (**chosen**) |
|---|---|---|
| Flow | Call 1 extracts items → code prices them → call 2 writes the reply using the prices | Gemini writes the reply without calculated numbers → code prices the items and adds a short sentence it builds itself |
| Latency / quota | 2× per turn (free tier limits, slower voice reply) | 1× per turn |
| Numbers correct? | Usually; Gemini could still restate or round them | Always; the numbers are never generated by the model |
| Naturalness | More natural | A bit more templated |
| Code | Two prompts, two schemas, harder to debug | One prompt and one template function |

**Decision: (b).** It is simpler (one call, one schema), faster for voice, and it **guarantees** the stated numbers are the code numbers. Trade-offs:
- The reply has two parts (Gemini's sentence, then the system's sentence), and the spoken reply can run slightly over 4 sentences on turns where items change.
- The system relies on Gemini following rule 7. If it adds its own figure anyway, the code sentence that follows is still correct, and the panel always shows the code values.
- A bonus: the pricing note stays in the transcript, so on later turns Gemini only ever sees correct numbers in the history.

### When the pricing note is added
- The note covers only items that are **new or whose quantity changed** this turn, plus "Removed X" for removed items, plus the enquiry total.
- If `intent === 'review_enquiry'`, the note recaps **all** items and the total.
- On any other turn, nothing is added.

### Function signatures

```js
round2(n) -> number                                  // Math.round((n + Number.EPSILON) * 100) / 100
todayLocalISO(date = new Date()) -> 'YYYY-MM-DD'      // local server date
isSchemeActive(scheme, todayISO) -> boolean          // scheme !== null && todayISO <= scheme.validTill
priceItem(product, quantity, todayISO) -> PricedItem
priceEnquiry(items /* [{productId, quantity}] */, catalogue, todayISO)
    -> { items: PricedItem[], enquiryTotal: number, unknownIds: string[] }
buildPricingNote(prevItems, pricedItems, enquiryTotal, { recapAll = false }) -> string   // '' if nothing to say
```

```js
PricedItem = {
  productId, productName, unit, quantity,
  retailerPrice,
  grossValue,          // round2(quantity × retailerPrice)
  freeUnits,           // buy_x_get_y only, else 0
  discountAmount,      // percent_off / flat_off only, else 0
  freeGift,            // free_gift only: { item, quantity } or null
  netValue,            // round2(grossValue − discountAmount)
  schemeApplied,       // scheme.description if it applied, else null
  schemeHint,          // e.g. "Add 4 more bottles to get 1 free" if below the first threshold, else null
  minOrderQty,
  belowMinOrder,       // quantity < minOrderQty
  stockStatus,
  backorder            // stockStatus === 'out_of_stock'
}
```

### Rules (from requirements.md section 6; `q` = requested quantity)
1. If the scheme is missing or `todayISO > validTill`, no scheme applies, and `schemeApplied` and `schemeHint` are both `null`.
2. `buy_x_get_y`: `freeUnits = floor(q / buyQty) × freeQty`.
3. `percent_off`: if `q ≥ minQty`, `discountAmount = round2(grossValue × discountPercent / 100)`.
4. `flat_off`: if `q ≥ minQty`, `discountAmount = round2(q × discountPerUnit)`.
5. `free_gift`: `freeGift = { item: giftItem, quantity: floor(q / buyQty) × giftQty }` if that is > 0. Prices do not change.
6. Free units and gifts are never charged, and they never count towards any threshold (only `q` is used).
7. `belowMinOrder` and `backorder` are flags only. The item is still captured, priced and shown (as "Backorder" in the panel). **Backorder items are excluded from `enquiryTotal`**: `enquiryTotal = sum(netValue of items where !backorder)`.
8. `schemeHint` is set only when `q` is below the scheme's first threshold (`buyQty` or `minQty`): "Add {threshold − q} more {unit}s to get {benefit}."
9. Money is rounded to 2 dp. The note formats amounts with `en-IN` grouping and leaves off `.00` (e.g. "2,690.40 rupees", "3,560 rupees").

### Note template (one sentence per changed item, then the total)
`{name}: {q} {unit plural}[, with {freeUnits} free {unit plural} | {discount} rupees off | {n} free {giftItem}], net value {net} rupees[. {schemeHint}][. The minimum order is {minOrderQty} {unit plural} – would you like to change the quantity?][. This is noted as backorder interest because it is out of stock, so it is not included in the total].`
followed by `Your enquiry total is now {enquiryTotal} rupees.`
Plurals use a simple helper: add "es" after ch/sh/s/x (pouch → pouches), otherwise add "s".

### Worked examples (today = 2026-10-26, so every scheme in the data is active)

| Item | Gross | Scheme result | Net | Flags |
|---|---|---|---|---|
| P001 Keshvana Coconut Oil × 20 bottles @178 | 3,560.00 | buy 10 get 1 → floor(20/10)×1 = **2 free** | 3,560.00 | – |
| P010 Grainora Atta × 20 packs @258 | 5,160.00 | free gift → floor(20/10)×1 = **2 × Grainora iodised salt 1 kg** | 5,160.00 | – |
| P003 Tarangini Almond × 24 bottles @118 | 2,832.00 | 5% (24 ≥ 24) → **141.60 off** | 2,690.40 | backorder |
| P006 Groundnut Oil × 5 cans @945 | 4,725.00 | flat 25/can (5 ≥ 5) → **125.00 off** | 4,600.00 | low stock |
| P011 Peanut Namkeen × 10 packs @41 | 410.00 | 10 < 24 → none; hint "Add 14 more packs to get 3 free" | 410.00 | belowMinOrder (24) |

Turn example: the retailer says "Send 20 bottles of Keshvana coconut oil and 20 packs of Grainora atta".
- Gemini reply: "Sure Ramesh ji, I have noted 20 bottles of Keshvana Pure Coconut Hair Oil and 20 packs of Grainora Gold Chakki Atta in your enquiry."
- Gemini `capturedItems`: `[{P001,20},{P010,20}]`
- Code note: "Keshvana Pure Coconut Hair Oil: 20 bottles, with 2 free bottles, net value 3,560 rupees. Grainora Gold Chakki Atta: 20 packs, with 2 free Grainora iodised salt 1 kg, net value 5,160 rupees. Your enquiry total is now 8,720 rupees."

All five rows above become the cases in `pricing.test.js`, plus one expired-scheme case (`todayISO = '2026-11-16'` for P006 → no discount).

---

## 8. Summary at end of call

`POST /api/conversations/end`:
1. If there are no messages with `role: 'retailer'`, return `{ saved: false, reason: 'empty' }`. Nothing is written.
2. Re-price `capturedItems` with `priceEnquiry()` (the server never trusts client numbers) and validate `followUps` the same way as in section 6.
3. Call Gemini once with `buildSummaryPrompt({ today, retailer, transcript, pricedItems, enquiryTotal, followUps })` and this schema:
   ```json
   { "summary": "STRING (2-4 sentences)",
     "outcome": "order_enquiry | info_only | follow_up_required | no_interest",
     "sentiment": "positive | neutral | negative" }
   ```
   Prompt (short): *"Summarise this call between our assistant and a retailer for a sales manager, in 2–4 sentences, third person. Mention products of interest with quantities and any follow-ups. Use only numbers that appear in FINAL ENQUIRY; do not calculate anything. Choose outcome and sentiment using the rules below."*
4. **The outcome is decided by rules in code, with Gemini used only where judgement is needed:**
   - one or more captured items → `order_enquiry`
   - otherwise, one or more follow-ups → `follow_up_required`
   - otherwise → Gemini's choice of `no_interest` (the retailer clearly declined) or `info_only`. If Gemini gives any other value, use `info_only`.
5. `productInterests` and `followUps` in the saved record come from the **live, validated, code-priced lists**, not from a second extraction by Gemini. Those lists were already confirmed turn by turn in the side panel, and a second extraction could disagree with them.
6. Fallback: if Gemini fails (after one retry, with a timeout), save anyway with `summary: "Summary unavailable"`, `summaryStatus: "unavailable"`, `sentiment: null`, and the outcome from rules 4a–4b (or `info_only`). No data is lost.
7. Append the record to `conversations.json` and return it. `SummaryView` shows it.

---

## 9. `conversations.json`

The file is a JSON array of records, and new records are appended. The history list sorts by `startedAt` descending. Example record:

```json
{
  "id": "3f9c1e2a-7b4d-4c1e-9a55-0d2b6c8e1f10",
  "retailerId": "R001",
  "retailerName": "Shree Ganesh Kirana Store",
  "ownerName": "Ramesh Patil",
  "startedAt": "2026-10-26T10:15:02.120Z",
  "endedAt": "2026-10-26T10:19:47.905Z",
  "summary": "Ramesh Patil enquired about Keshvana coconut oil, Grainora atta and Tarangini almond oil. He noted 20 bottles of coconut oil and 20 packs of atta, for an enquiry total of 8,720 rupees, plus 24 bottles of almond oil as backorder interest. He asked for a callback on Friday about his credit.",
  "summaryStatus": "ok",
  "outcome": "order_enquiry",
  "sentiment": "positive",
  "productInterests": [
    { "productId": "P001", "productName": "Keshvana Pure Coconut Hair Oil", "unit": "bottle", "quantity": 20,
      "retailerPrice": 178, "grossValue": 3560, "freeUnits": 2, "discountAmount": 0, "freeGift": null,
      "netValue": 3560, "schemeApplied": "Buy 10 get 1 free", "schemeHint": null,
      "minOrderQty": 6, "belowMinOrder": false, "stockStatus": "in_stock", "backorder": false },
    { "productId": "P010", "productName": "Grainora Gold Chakki Atta", "unit": "pack", "quantity": 20,
      "retailerPrice": 258, "grossValue": 5160, "freeUnits": 0, "discountAmount": 0,
      "freeGift": { "item": "Grainora iodised salt 1 kg", "quantity": 2 },
      "netValue": 5160, "schemeApplied": "Free 1 kg Grainora iodised salt with every 10 packs", "schemeHint": null,
      "minOrderQty": 5, "belowMinOrder": false, "stockStatus": "in_stock", "backorder": false },
    { "productId": "P003", "productName": "Tarangini Almond Hair Oil", "unit": "bottle", "quantity": 24,
      "retailerPrice": 118, "grossValue": 2832, "freeUnits": 0, "discountAmount": 141.6, "freeGift": null,
      "netValue": 2690.4, "schemeApplied": "Extra 5% discount on orders of 24 units or more", "schemeHint": null,
      "minOrderQty": 12, "belowMinOrder": false, "stockStatus": "out_of_stock", "backorder": true }
  ],
  "enquiryTotal": 8720,
  "followUps": [
    { "type": "credit_query", "details": "Call back on Friday about credit and outstanding amount.", "dueDate": "2026-10-30" }
  ],
  "transcript": [
    { "role": "agent",    "text": "Namaste Ramesh ji, welcome. How can I help Shree Ganesh Kirana Store today?", "ts": "2026-10-26T10:15:02.120Z" },
    { "role": "retailer", "text": "Is Tarangini almond oil available?", "ts": "2026-10-26T10:15:20.410Z" },
    { "role": "agent",    "text": "Sorry Ramesh ji, Tarangini Almond Hair Oil is out of stock right now, and restock is expected in two weeks. You could try Keshvana Pure Coconut Hair Oil 500 ml at 178 rupees, which is in stock with a buy 10 get 1 free scheme till 30 November.", "ts": "2026-10-26T10:15:23.002Z", "intent": "availability_query" },
    { "role": "retailer", "text": "Okay, send 20 bottles of Keshvana and 20 packs of Grainora atta. Also keep 24 Tarangini for when it comes.", "ts": "2026-10-26T10:16:05.771Z" },
    { "role": "agent",    "text": "Noted, Ramesh ji: 20 bottles of Keshvana Pure Coconut Hair Oil, 20 packs of Grainora Gold Chakki Atta and 24 bottles of Tarangini Almond Hair Oil in your enquiry. Keshvana Pure Coconut Hair Oil: 20 bottles, with 2 free bottles, net value 3,560 rupees. Grainora Gold Chakki Atta: 20 packs, with 2 free Grainora iodised salt 1 kg, net value 5,160 rupees. Tarangini Almond Hair Oil: 24 bottles, with 141.60 rupees off, net value 2,690.40 rupees. This is noted as backorder interest because it is out of stock. Your enquiry total is now 8,720 rupees.", "ts": "2026-10-26T10:16:09.330Z", "intent": "add_or_update_items" },
    { "role": "retailer", "text": "Call me back on Friday about my credit.", "ts": "2026-10-26T10:18:40.002Z" },
    { "role": "agent",    "text": "Sure, I have logged a callback for Friday, 30 October, about your credit. Our team will get back to you.", "ts": "2026-10-26T10:18:42.640Z", "intent": "follow_up" }
  ]
}
```

---

## 10. Errors and fallbacks

| Situation | Where it is detected | What happens |
|---|---|---|
| No SpeechRecognition (Firefox, some Safari) | `useSpeech` on load | Mic hidden; note "Voice not supported – please type"; text input works |
| Microphone permission denied | `onerror: not-allowed` | `micBlocked = true`, mic hidden, same note |
| Recognition `no-speech` / `network` | `onerror` | Short inline message; conversation continues; user can retry or type |
| speechSynthesis missing | `useSpeech` on load | Text-only replies; mute toggle hidden; no errors |
| Empty or whitespace message | `send()` and `/api/chat` (400) | Ignored on the client; the server rejects it |
| Gemini timeout (15 s) or API error | `gemini.generateJson()` | Retry once. If it fails again, `/api/chat` returns `degraded: true` with the reply "Sorry, I'm having trouble right now. Could you please say that again?" The items and follow-ups stay as they were |
| Gemini returns invalid JSON or JSON that does not match the schema | `JSON.parse` + required-field check | Treated as an error: retry once, then the same fallback |
| Unknown `productId` from Gemini | `chat.js` validation | Item dropped and logged; the rest of the turn continues |
| Invalid quantity (0, negative, not an integer) | `chat.js` validation | Item dropped (treated as removed) |
| `GEMINI_API_KEY` missing at startup | `index.js` | Loud console warning; the server still starts so the data and history screens work; `/api/chat` returns 503 "AI not configured" and the UI shows a banner; `/end` saves with "Summary unavailable" |
| Unknown retailer ID | `start`, `chat`, `end` | 404 `{ error }` |
| `conversations.json` missing | `store.js` | Treated as `[]` and created on first save |
| `conversations.json` corrupt (JSON parse fails) | `store.js` | **Do not overwrite.** Return 500; the list shows an error; the client keeps the conversation on screen so nothing is lost |
| File write fails | `store.js` | 500 "Could not save conversation"; the client stays on the conversation screen with a Retry option |
| `products.json` / `retailers.json` missing or invalid | `index.js` at startup | Exit with a clear message (the app cannot work without them) |
| Server unreachable from the browser | `api.js` fetch catch | Inline error "Cannot reach server"; the user's message stays in the chat |

Gemini wrapper (`gemini.js`): `generateJson({ systemInstruction, contents, schema })` runs the SDK call with a 15-second timeout (`AbortController` / `Promise.race`) and returns the parsed object. It throws on timeout, API error or bad JSON, and the route retries once and then uses the fallback. The wrapper logs the error message only, never the key.

---

## 11. Setup, run and build order

### Environment (`server/.env`, gitignored; commit `server/.env.example`)
```
GEMINI_API_KEY=your-key-from-google-ai-studio
GEMINI_MODEL=gemini-3.5-flash      # optional; any current Flash model works
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite,gemini-3.6-flash  # optional; tried in order on failure
PORT=3001                          # optional
```

### Run (two terminals)
```
cd server && npm install && npm run dev      # node --watch index.js  -> http://localhost:3001
npm install && npm run dev                   # Vite                    -> http://localhost:5173
```
`vite.config.js` adds `server.proxy: { '/api': 'http://localhost:3001' }`. The frontend calls relative `/api/...` URLs, so CORS is not needed in development. Open the app in **Chrome or Edge** for voice. Tests: `cd server && node --test`.

### Build order (about 4.5 hours)

| # | Step | Time | Done when |
|---|---|---|---|
| 1 | Server skeleton: `index.js`, `store.js`, `routes/data.js`, Vite proxy | 25 min | `/api/products` works in the browser |
| 2 | `pricing.js` + `pricing.test.js` | 35 min | All worked examples pass |
| 3 | `gemini.js`, `prompts.js`, `routes/chat.js` (validation + pricing note) | 60 min | curl turns: price, scheme, out-of-stock, capture, "cases", correction |
| 4 | `useConversation`, Home, Conversation screen with text only, CapturePanel | 60 min | Full text conversation with a live side panel |
| 5 | `useSpeech` + mic/mute in ChatInput | 40 min | Talk and hear replies in Chrome; Firefox falls back to text |
| 6 | `/conversations/start` + `/end` + SummaryView | 30 min | Summary shown and record in `conversations.json`; empty call is not saved |
| 7 | HistoryList + ConversationDetail | 25 min | Past calls listed and viewable |
| 8 | Error states, README (setup, approach, assumptions), demo run-through | 25 min | Demo script works end to end |

Filters on the history list (US-8 nice-to-have) are only worth doing if time is left.
