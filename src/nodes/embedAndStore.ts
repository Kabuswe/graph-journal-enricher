/**
 * embedAndStore — generates embedding for the journal entry and stores metadata.
 * Uses local @xenova/transformers for embeddings.
 * Storage: file-based JSON store (DynamoDB/Amplify when configured via env).
 */
import fs from "fs";
import path from "path";
import { embedText } from "../embeddings.js";

const STORE_PATH = process.env.JOURNAL_STORE_PATH ?? "./journal-store.json";

interface JournalRecord {
  vectorId: string;
  entryDate: string;
  title: string;
  dominantThemes: string[];
  moodScore: number;
  insightSummary: string;
  embedding: number[];
  storedAt: string;
}

function loadStore(): JournalRecord[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as JournalRecord[];
    }
  } catch { /* ignore */ }
  return [];
}

function saveStore(records: JournalRecord[]) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(records, null, 2), "utf-8");
  } catch (err) {
    console.warn("[embedAndStore] Could not save journal store:", (err as Error).message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const embedAndStoreNode = async (state: any) => {
  const { bodyText, entryDate, title, dominantThemes, moodScore, insightSummary } = state;
  const text: string = (insightSummary ?? "") + " " + (bodyText ?? "");

  let embedding: number[] = [];
  try {
    embedding = await embedText(text.slice(0, 512));
  } catch (err) {
    console.warn("[embedAndStore] Embedding failed:", (err as Error).message);
  }

  const vectorId = crypto.randomUUID();
  const storedAt = new Date().toISOString();

  const record: JournalRecord = {
    vectorId,
    entryDate: entryDate ?? storedAt.split("T")[0],
    title: title ?? "",
    dominantThemes: dominantThemes ?? [],
    moodScore: moodScore ?? 0,
    insightSummary: insightSummary ?? "",
    embedding,
    storedAt,
  };

  // Persist locally
  const store = loadStore();
  store.push(record);
  saveStore(store);

  console.log(`[embedAndStore] Stored journal entry ${vectorId} (embedding dim=${embedding.length})`);

  return {
    phase: "embed-store",
    vectorId,
    storedAt,
  };
};
