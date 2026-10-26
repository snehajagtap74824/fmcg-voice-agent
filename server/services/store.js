import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

// Reads a required JSON array from server/data. Throws with a clear message if missing or invalid.
export async function readDataArray(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  let raw;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read ${filePath}: ${err.message}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }
  if (!Array.isArray(data)) throw new Error(`${filePath} must contain a JSON array`);
  return data;
}

// TODO(step 6): readConversations() / appendConversation() for conversations.json.
