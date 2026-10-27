import { GoogleGenAI } from '@google/genai';

const TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 2;
let client = null;

export function getModelName() {
  return process.env.GEMINI_MODEL || 'gemini-3.5-flash';
}

// Try the main model first, then the first fallback (comma-separated list); at most MAX_ATTEMPTS calls
// so a turn cannot hang for long. Each model has its own free-tier quota, so this also helps when one
// model hits 503 (busy) or 429 (daily limit).
function getAttemptModels() {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.1-flash-lite,gemini-3.6-flash')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([getModelName(), ...fallbacks])].slice(0, MAX_ATTEMPTS);
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

async function callOnce({ model, systemInstruction, contents, schema, temperature }) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Gemini timed out after ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);
  });

  try {
    const request = getClient().models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature,
        responseMimeType: 'application/json',
        responseSchema: schema,
        // No "thinking": cuts a turn from ~19s to ~5s. The task is lookup + extraction, and maths is done in code.
        thinkingConfig: { thinkingBudget: 0 },
        abortSignal: controller.signal,
      },
    });
    const response = await Promise.race([request, timeout]);
    const parsed = JSON.parse(response.text ?? '');
    const missing = (schema.required ?? []).filter((key) => parsed[key] === undefined);
    if (missing.length > 0) throw new Error(`Gemini response missing fields: ${missing.join(', ')}`);
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

// Runs one structured-output call with a timeout and one retry on the fallback model. Throws if both attempts fail.
// Only error messages are logged, never the API key.
export async function generateJson({ systemInstruction, contents, schema, temperature = 0.3 }) {
  let lastError;
  const models = getAttemptModels();
  for (let attempt = 0; attempt < models.length; attempt += 1) {
    try {
      return await callOnce({ model: models[attempt], systemInstruction, contents, schema, temperature });
    } catch (err) {
      lastError = err;
      console.error(`[gemini] attempt ${attempt + 1} (${models[attempt]}) failed: ${err.message}`);
    }
  }
  throw lastError;
}
