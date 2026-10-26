# Requirements – FMCG Retailer Voice Agent (Prototype)

## 1. Overview

A fictional FMCG company ("the company") wants an AI voice agent that talks to its retailers. The agent answers questions about products, prices, schemes and stock, records what the retailer wants to order and what follow-up they need, and saves a summary of each call.

This is a **browser-based prototype** built in under 24 hours. A sales rep or the retailer picks a retailer profile, speaks to (or types to) the agent, hears spoken replies, and ends the call. The app then generates a summary with Gemini and saves the conversation. Past conversations can be reviewed later.

**Primary persona:** retailer (kirana owner, supermarket manager, chemist-cum-general store, wholesaler).
**Secondary persona:** sales manager reviewing what retailers asked for.

## 2. User Stories and Acceptance Criteria

### US-1 Start a conversation with a selected retailer
*As a user, I want to pick which retailer I am, so that the agent can refer to my shop, my credit and my last order.*

- [ ] **Prototype decision:** the app runs as a single retailer profile, R001 Shree Ganesh Kirana Store, Pune. There is no selector screen. The other retailers stay in `retailers.json` for future use.
- [ ] When the app opens, a new conversation starts right away and the agent greets the retailer by shop/owner name (for example, "Namaste Ramesh ji, welcome. How can I help Shree Ganesh Kirana today?").
- [ ] The conversation screen shows the retailer's name, city, type and outstanding amount.
- [ ] Each conversation gets a unique ID and a start timestamp.

### US-2 Speak to the agent (voice input), with a text fallback
*As a retailer, I want to speak my question, so that I do not have to type while running my shop.*

- [ ] Given the browser supports the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), when I click the mic button, then it shows a listening state and my speech is turned into text.
- [ ] When I stop speaking, the text appears as my message in the chat and is sent to the agent.
- [ ] Given the browser does not support speech recognition, or microphone permission is denied, then the mic button is hidden or disabled with a short note ("Voice not supported – please type") and the text input still works.
- [ ] A text input box with a Send button is always available, even when voice works.
- [ ] Recognition errors (no speech, network) show a short message and do not break the conversation.

### US-3 Hear the agent's replies (text-to-speech)
*As a retailer, I want the agent to speak its answers, so that it feels like a phone call.*

- [ ] Given `speechSynthesis` is available, when the agent replies, then the reply is spoken aloud and also shown as text in the chat.
- [ ] A mute/unmute toggle lets me turn speech off. Text is always shown.
- [ ] Starting a new mic input stops any speech that is still playing.
- [ ] If TTS is not supported, replies are shown as text only and nothing errors.

### US-4 Ask about products, prices, schemes and availability
*As a retailer, I want correct answers about products, MRP, my buying price, current schemes and stock, so that I can decide what to order.*

- [ ] The agent answers **only from** `server/data/products.json` (sent to Gemini as context). It must not invent products, prices or schemes.
- [ ] Given I ask "What is the price of Keshvana coconut oil 500 ml?", then the agent states both MRP and retailer price in INR.
- [ ] Given I ask "Any scheme on Grainora Gold atta?", then the agent states the scheme text and its valid-till date, or says there is no current scheme.
- [ ] Given I ask about an `out_of_stock` product, then the agent says it is unavailable, gives the restock note from the product description if there is one, and **suggests at least one `in_stock` alternative from the same category** with its retailer price (for example, Tarangini Almond Hair Oil → Keshvana Pure Coconut Hair Oil).
- [ ] Alternatives are always from the same category and always `in_stock`. The agent never suggests another `out_of_stock` product. If no `in_stock` product exists in that category, it may suggest a `low_stock` one and say stock is limited.
- [ ] Given a product is `low_stock`, then the agent mentions limited stock.
- [ ] Given I ask about a product not in the catalogue, then the agent says it does not have that product and lists what is available in the closest category.
- [ ] The agent can tell me the margin (MRP minus retailer price) and the minimum order quantity when asked.
- [ ] Replies are short (2–4 sentences) so they work well when spoken.

### US-5 Capture product interest and requested quantities
*As a sales manager, I want each product the retailer is interested in and the quantity they want recorded, so that the sales team can act on it.*

- [ ] Given I say "Send me 20 bottles of Keshvana 500 ml", then the agent confirms the product and quantity back to me.
- [ ] Quantities are in the product's `unit` only (bottle, pouch, pack, etc.). There is no case conversion. Given I say "cases", then the agent asks for the number of units.
- [ ] Captured items are kept as structured data: `productId`, `productName`, `quantity`, `unit`, plus the calculated fields below.
- [ ] Given the quantity is below `minOrderQty`, then the agent tells me the minimum and asks whether to adjust.
- [ ] Given the product is out of stock, then the interest is still recorded but marked as out of stock / backorder interest. It is shown in the panel but **excluded from the enquiry total**, and the agent suggests an in-stock alternative (see US-4).
- [ ] **Scheme benefits and order values are calculated in backend code, not by Gemini.** Gemini only identifies the product and quantity. The code then calculates, for each item:
  - `freeUnits`, `discountAmount` and `freeGift`, using the scheme rules in section 6;
  - `grossValue` = `quantity × retailerPrice`;
  - `netValue` = `grossValue − discountAmount`.
- [ ] The code also calculates the enquiry total (sum of `netValue`, excluding out-of-stock/backorder items), which is shown in the side panel.
- [ ] A scheme is applied only if today's date is on or before its `validTill` and the quantity meets the scheme threshold.
- [ ] Given a scheme applies and my quantity qualifies (for example 20 bottles of P001 → 2 free), then the agent mentions the free units or discount. The numbers it states must be the code-calculated ones.
- [ ] Given my quantity is just short of a scheme threshold, then the agent may tell me how many more units would qualify.
- [ ] A side panel on the conversation screen shows the captured items, with quantity, free units/discount and net value, as the conversation goes on. It updates after every agent reply.
- [ ] The agent makes clear this is an **enquiry**, not a confirmed order.

### US-6 Capture follow-up requirements
*As a sales manager, I want follow-up needs recorded, so that someone can call back or act on them.*

- [ ] The agent recognises and records follow-ups such as: callback request (with date/time if given), product sample request, credit limit or outstanding query, delivery date query, complaint (damaged or expired stock), and a sales rep visit request.
- [ ] Each follow-up is stored as `{ type, details, dueDate (optional) }`.
- [ ] Given I say "Call me back on Friday about credit", then a follow-up of type `callback` / `credit_query` is recorded and the agent confirms it.
- [ ] Given I ask about my outstanding amount, then the agent can state it from the retailer record and offer to log a credit follow-up.
- [ ] Follow-ups appear in the side panel with the captured items.

### US-7 End the conversation, generate a summary and save it
*As a sales manager, I want a short summary and outcome for every call, saved for later.*

- [ ] An "End Conversation" button is always visible during a conversation.
- [ ] When I click it, the backend sends the full transcript to Gemini and gets back `summary` (2–4 sentences) and `sentiment` (optional). Product interests and follow-ups are **not** re-extracted by Gemini: the saved lists are the live lists captured during the call, re-priced in code. `outcome` is set by rule in code (see `docs/architecture.md` section 8).
- [ ] `outcome` is one of: `order_enquiry`, `info_only`, `follow_up_required`, `no_interest`.
- [ ] The conversation record (ID, retailer ID/name, start and end time, full transcript, summary, product interests, follow-ups, outcome) is saved to a JSON file in `/server/data` (for example `conversations.json`).
- [ ] The summary is shown on screen right after saving.
- [ ] Given Gemini fails or times out, the conversation is still saved with the transcript and captured items, and the summary says "Summary unavailable" (no data is lost).
- [ ] The saved product interests include the code-calculated `freeUnits`, `discountAmount`, `freeGift`, `grossValue` and `netValue`, plus the enquiry total.
- [ ] Given I end a conversation in which the retailer sent no messages, then it is **not saved**. The app shows "Nothing to save" and returns to the home screen.

### US-8 Review previous interactions
*As a sales manager, I want to see past conversations, so that I can follow up.*

- [ ] A "History" screen lists saved conversations, newest first, showing date/time, retailer name, outcome and number of items of interest.
- [ ] Clicking a row opens a detail view with the summary, product interests (with quantities), follow-ups, outcome and the full transcript.
- [ ] Given there are no saved conversations, the list shows an empty state message.
- [ ] (Nice to have) Filter the list by retailer or outcome.

## 3. Scope

### In scope
- Retailer selection from mock data (no login).
- Voice input (Web Speech API), text fallback, TTS replies with mute.
- Gemini-powered Q&A grounded in `products.json` and the selected retailer record.
- Capturing product interests, quantities and follow-ups during the chat.
- Summary generation at the end of the call and saving to JSON file storage.
- History list and detail view.
- Basic error handling (no voice support, Gemini failure, empty input).

### Out of scope
- Real order placement, invoicing, inventory updates or payments.
- Authentication, user roles, multi-tenant access.
- Real telephony (outbound/inbound calls, IVR, SIP).
- Databases. JSON files only.
- Admin screens for editing products, schemes or retailers.
- Analytics dashboards and reporting.
- Production hardening (rate limiting, concurrency-safe writes, deployment).
- **Stretch only:** Hindi or other regional language support (speech recognition `lang` set to `hi-IN`, Gemini replying in Hindi). Each retailer has a `preferredLanguage` field for this, but English is the only language that must work.

## 4. Assumptions
- All brands, products, retailers and people are **fictional**. Any resemblance to real brands is not intended.
- Prices are in **INR**, inclusive of taxes. MRP is the printed consumer price; `retailerPrice` is the price per unit to the retailer. Quantities are always in the product's `unit` (bottle/pouch/pack/etc.). There is no case conversion.
- Each scheme has a structured `type` with numeric fields (used by code) and a text `description` (used by Gemini to talk about it). "Today" is taken from the server date. A scheme past its `validTill` is treated as expired and not applied.
- All money and free-unit arithmetic is done in code. Gemini never calculates totals, because LLM arithmetic is unreliable.
- Free units and free gifts are not charged and do not count towards the quantity for any threshold.
- Stock status is a fixed label (`in_stock`, `low_stock`, `out_of_stock`). There are no live stock counts.
- Best voice support is in **Chrome or Edge** on desktop. Firefox and some Safari versions fall back to text.
- A single user uses the app on one machine. No concurrent writes to JSON files.
- The Gemini API key is stored in `server/.env` (`GEMINI_API_KEY`). It is never sent to the browser or committed.
- Gemini is called only from the Express backend. The frontend never calls Gemini directly.
- Product interests and follow-ups are captured **live**: Gemini returns structured JSON with each reply, and the side panel updates every turn. The end-of-call summary confirms the final list. Details are in `docs/architecture.md`.
- `preferredLanguage` is stored and displayed only. English is the only language supported in the prototype.
- Mock data is small (about 12 products, 5 retailers), so the whole catalogue can go into the prompt. No search or RAG is needed.

## 5. Stack
- **Frontend:** React (Vite). Web Speech API for speech-to-text (`SpeechRecognition`) and text-to-speech (`speechSynthesis`).
- **Backend:** Express (Node.js) in `/server`. It serves the mock data, sends chat requests to Gemini and saves conversations.
- **AI:** Google Gemini API (free tier), key in `server/.env`.
- **Storage:** JSON files in `server/data/` (`products.json`, `retailers.json`, `conversations.json`).

## 6. Mock Data Files
- `server/data/products.json`: 12 fictional products across hair oil, edible oil, skincare and foods, with MRP, retailer price, scheme, stock status and minimum order quantity.

### Scheme types
`scheme` is `null` or an object with `type`, `description`, `validTill` and the type's fields. The rules below assume the scheme is valid (today ≤ `validTill`) and `q` is the requested quantity.

| `type` | Fields | Rule (calculated in code) | Example |
|---|---|---|---|
| `buy_x_get_y` | `buyQty`, `freeQty` | `freeUnits = floor(q / buyQty) × freeQty` | P001: 20 bottles → 2 free |
| `percent_off` | `minQty`, `discountPercent` | if `q ≥ minQty`: `discountAmount = grossValue × discountPercent / 100` | P003: 24 × 118 = 2832 → Rs 141.60 off |
| `flat_off` | `minQty`, `discountPerUnit` | if `q ≥ minQty`: `discountAmount = q × discountPerUnit` | P006: 5 cans → Rs 125 off |
| `free_gift` | `buyQty`, `giftQty`, `giftItem` | `freeGift = floor(q / buyQty) × giftQty` of `giftItem` (no price change) | P010: 20 packs → 2 × salt 1 kg |

Money values are rounded to 2 decimal places.
- `server/data/retailers.json`: 5 fictional retailers across Indian cities, with type, credit limit, outstanding amount, preferred language and last order date.
