import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { createChatRouter } from './routes/chat.js';
import { createConversationsRouter } from './routes/conversations.js';
import { createDataRouter } from './routes/data.js';
import { getModelName, isGeminiConfigured } from './services/gemini.js';
import { readDataArray } from './services/store.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(serverDir, '.env'), quiet: true });

const PORT = Number(process.env.PORT) || 3001;

let products;
let retailers;
try {
  [products, retailers] = await Promise.all([readDataArray('products.json'), readDataArray('retailers.json')]);
} catch (err) {
  console.error(`[startup] ${err.message}`);
  process.exit(1);
}

if (!isGeminiConfigured()) {
  console.warn('\n*** WARNING: GEMINI_API_KEY is not set in server/.env. /api/chat will return 503 and summaries will be "Summary unavailable". ***\n');
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, geminiConfigured: isGeminiConfigured(), model: getModelName() });
});
app.use('/api', createDataRouter({ products, retailers }));
app.use('/api', createConversationsRouter({ products, retailers }));
app.use('/api', createChatRouter({ products, retailers }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Malformed JSON bodies and unexpected errors.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(`[server] ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API server on http://localhost:${PORT} (model: ${getModelName()})`);
});
