# FMCG Retailer Voice Agent

A browser-based prototype of an AI voice agent, **Meera**, who speaks with retailers on behalf of a fictional FMCG company. Meera answers questions about products, prices, schemes and stock; captures the products a retailer is interested in, the quantities and any follow-up requirements; and at the end of the call generates a summary, decides the outcome and saves the conversation so it can be reviewed later. Voice is used where the browser supports it, with a text chat that always works.

## Features

- Speak to the agent (speech-to-text) and hear replies (text-to-speech), with a text input that is always available.
- Answers product, price, scheme, availability and account (credit / outstanding) questions from sample business data.
- Live capture panel: products of interest, quantities, free units, discounts, line totals, enquiry total and follow-ups, updated every turn.
- All prices, schemes and totals are calculated in code, never by the AI.
- Out-of-stock items are captured as backorder and an in-stock alternative from the same category is suggested.
- End conversation: AI summary, rule-based outcome, and the full record saved to a JSON file.
- History tab: list of past conversations and a detail view (summary, outcome, items, follow-ups, transcript).
- Graceful fallbacks when the AI, voice or microphone is unavailable.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React + Vite |
| Backend | Node.js + Express |
| AI | Google Gemini via `@google/genai` (structured JSON output) |
| Voice | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| Storage | JSON files (`server/data/`) |
| Tests | `node:test` |

## Prerequisites

- **Node.js 22.12 or newer** (a `.nvmrc` is included) and npm.
- A free **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey).
- **Chrome or Edge** for voice. Brave, Opera and Firefox work in text-only mode. Voice works only on `localhost` or `https`.

## Setup

```bash
git clone <repo-url>
cd fmcg-voice-agent
npm install          # also installs the server dependencies (postinstall)
```

Create the server environment file.

```powershell
# PowerShell
Copy-Item server/.env.example server/.env
```

```bash
# bash
cp server/.env.example server/.env
```

Edit `server/.env`:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Your Gemini API key (required for chat and summaries). |
| `GEMINI_MODEL` | Main model, default `gemini-3.5-flash`. |
| `GEMINI_FALLBACK_MODELS` | Comma-separated models; the first one is tried if the main model fails (busy or quota). |
| `PORT` | API port, default `3001`. The Vite dev proxy expects `3001`. |

Run the app and open http://localhost:5173.

```bash
npm run dev          # starts the API (port 3001) and the React app (port 5173)
```

Other commands:

```bash
npm test             # server unit tests (pricing, outcome, chat helpers)
npm run lint
npm run build
```

## How to use

1. The conversation starts automatically as the demo retailer, **Shree Ganesh Kirana Store, Pune**, with a greeting from Meera.
2. Click the **mic** button and speak (English, `en-IN`). A *Listening* indicator shows while recording; the message is sent automatically when you stop speaking.
3. Or type in the text box at any time.
4. Voice replies are **muted by default**. Use the speaker toggle to unmute.
5. Watch the **capture panel** fill in with products, quantities, totals and follow-ups.
6. Click **End conversation** to see the summary and outcome. The call is saved.
7. Open the **History** tab to see previous conversations and their details. A sample record is included.

## Architecture

```
+-----------------------------+        +------------------------------------+        +-----------+
| Browser (React UI)          |  JSON  | Express API (server/)              |        |  Google   |
|  - Web Speech STT / TTS     | <----> |  /api/chat      /api/summary       | <----> |  Gemini   |
|  - conversation state       |        |  /api/conversations                |        |           |
|  - capture panel, history   |        |  pricing engine, JSON file store   |        +-----------+
+-----------------------------+        +------------------------------------+
```

**One turn**

1. The retailer speaks (or types); the browser converts speech to text.
2. The browser sends the conversation history plus the current captured items and follow-ups to `/api/chat`.
3. The server builds a system prompt with the catalogue, retailer record and current enquiry, and asks Gemini for a JSON reply: `reply`, `intent`, the full `capturedItems` list and `followUps`.
4. The server validates the items, prices them in code, appends a code-built pricing note to the reply and returns everything.
5. The browser shows the reply, speaks it (if unmuted) and updates the capture panel.

At the end, `/api/summary` re-prices the enquiry, asks Gemini for a summary, sets the outcome by rule and saves the record.

**Project structure**

```
src/
  App.jsx                    tabs: Conversation / History
  api.js                     fetch wrappers (with timeout)
  hooks/useConversation.js   conversation state and API calls
  hooks/useSpeech.js         speech recognition and synthesis
  components/                chat, mic, capture panel, summary, history
server/
  index.js                   Express app
  routes/                    chat, conversations (start, summary, history), data
  services/                  gemini, prompts, pricing, outcome, store
  data/                      products.json, retailers.json, conversations.json
```

**API endpoints**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Server status and whether Gemini is configured |
| GET | `/api/products` | Product catalogue |
| GET | `/api/retailers` | Retailer records |
| POST | `/api/conversations/start` | New conversation id, retailer and greeting (nothing saved) |
| POST | `/api/chat` | One conversation turn |
| POST | `/api/summary` | End the call: summarise, decide outcome, save |
| GET | `/api/conversations` | List saved conversations |
| GET | `/api/conversations/:id` | One saved conversation |

## Key design decisions

- **The LLM handles language; code handles the maths.** Gemini understands the retailer and extracts products and quantities. All prices, scheme benefits and totals come from `server/services/pricing.js`, and the pricing note in each reply is written by code. Supported schemes: `buy_x_get_y`, `percent_off`, `flat_off`, `free_gift`. Out-of-stock items are kept as backorder and excluded from the total; Meera suggests an alternative in the same category.
- **Stateless server.** The browser holds the conversation and sends the history each turn. The server re-validates and re-prices everything, so the client cannot change prices.
- **Full captured list every turn.** Gemini returns the complete list of items and follow-ups as structured JSON, so corrections and removals ("make it 20", "drop the noodles") need no merge logic.
- **Rule-based outcome.** `order_enquiry` if any item was captured, otherwise `follow_up_required` if any follow-up exists, otherwise `info_only` or `no_interest` (Gemini chooses only between these two).
- **Fallbacks.**
  - Gemini: per-attempt timeout with one retry on a fallback model; if both fail, a polite fallback reply is returned and the captured data is kept.
  - Summary failure: the call is still saved with "Summary unavailable".
  - Voice unsupported or microphone blocked: text input continues to work.
  - Missing API key: `/api/chat` returns a clear 503 message.

## Assumptions

- All brands, products, retailers and prices are fictional sample data.
- Prices are in INR and include tax.
- Quantities are in units (bottles, packs, pouches); there are no cases or cartons.
- A single demo retailer is used for the conversation.
- English only.
- Scheme validity is checked against the server date.
- Prototype scope: no real orders, payments or authentication.

## Sample questions to try

1. "What is the price of Keshvana Pure Coconut Hair Oil?"
2. "Are there any schemes on Suvarnadhara Refined Sunflower Oil?"
3. "I want 24 Tarangini Almond Hair Oil." (out of stock: captured as backorder, alternative suggested)
4. "Give me 20 bottles of Keshvana Pure Coconut Hair Oil." (Buy 10 get 1 free: 2 free units)
5. "Add 5 packs of Crunchley Instant Masala Noodles." (below the minimum order of 12)
6. "Make the coconut oil 30 instead, and remove the noodles." (correction and removal)
7. "Is there any offer on Grainora Gold Chakki Atta if I take 10 packs?" (free gift)
8. "Please ask the sales rep to call me back on Friday about the groundnut oil scheme." (follow-up)
9. "How much do I have outstanding, and what is my credit limit?"
10. "Can you repeat my full order and the total?" (recap)

## Known limitations

- **Gemini free tier** allows roughly 20 requests per day per model. Each conversation turn and each End conversation uses one request.
- Speech recognition needs Chrome or Edge and an internet connection (it uses the browser's cloud speech service).
- The greeting is not spoken before the first user interaction, and voice replies are muted by default (browser autoplay rules).
- Gemini resolves relative dates such as "Friday" itself.
- Only the numbers are code-controlled; the spoken reply text is not checked for promises such as "order confirmed".
- The `end_call` intent does not end the call automatically; the user clicks End conversation.
- The `degraded` flag returned on AI failure is not shown in the UI.
- Once the microphone is marked blocked, a page reload is needed to try again.
- Speech that arrives while a typed message is still sending is dropped.
- JSON file storage is single-user: writes go through a simple queue with no further concurrency safety, and concurrent requests could save the same call twice.
- The Vite proxy port is fixed at 3001.
- Validation is loose on some inputs (for example `startedAt`).
- Unit labels are singular in tables (for example "20 bottle").

## Future scope

- Telephony integration (IVR / SIP, outbound calling campaigns).
- A real database instead of JSON files.
- Authentication and roles (sales rep, manager).
- Hindi and regional languages.
- Integration with CRM and order management systems.
- Analytics dashboard and live stock / pricing APIs.
