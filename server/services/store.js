import { readFile, rename, writeFile } from 'node:fs/promises';
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

const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

// Saved calls. A missing file means no calls yet; a corrupt file throws so it is never overwritten.
export async function readConversations() {
  let raw;
  try {
    raw = await readFile(CONVERSATIONS_FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error(`${CONVERSATIONS_FILE} must contain a JSON array`);
  return data;
}

// Writes run one after another so two saves at the same moment cannot drop a record.
let writeQueue = Promise.resolve();

// Appends one record. Writes to a temp file first and renames it, so a crash cannot leave half a file.
export function appendConversation(record) {
  const task = writeQueue.then(async () => {
    const conversations = await readConversations();
    conversations.push(record);
    const tempFile = `${CONVERSATIONS_FILE}.tmp`;
    await writeFile(tempFile, `${JSON.stringify(conversations, null, 2)}\n`, 'utf8');
    await rename(tempFile, CONVERSATIONS_FILE);
    return record;
  });
  writeQueue = task.catch(() => {});
  return task;
}
