import * as SQLite from "expo-sqlite";
import { LIMITS, outingSnapshotSchema } from "../../shared/contracts";
import type { OutingSnapshot, ReturnMode } from "../../shared/contracts";

/**
 * Local saved outings (SQLite). Cloud sync is not connected yet, so every record's sync state
 * is "local-only" and the UI says "Saved on this phone". Not an encrypted vault.
 */
export type SyncState = "local-only" | "pending" | "synced" | "conflict";

export interface SavedOutingRow {
  id: string;
  name: string;
  note: string;
  returnMode: ReturnMode;
  savedAt: string;
  updatedAt: string;
  syncState: SyncState;
  /** null when the stored snapshot has an unsupported schema version or fails validation. */
  snapshot: OutingSnapshot | null;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function db() {
  dbPromise ??= (async () => {
    const d = await SQLite.openDatabaseAsync("benchmark.db");
    await d.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS saved_outings (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        return_mode TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        saved_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_state TEXT NOT NULL DEFAULT 'local-only'
      );
    `);
    return d;
  })();
  return dbPromise;
}

export function newUuid(): string {
  // RFC 4122 v4 from Math.random: a stable local identifier, not a security token.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface Raw {
  id: string; name: string; note: string; return_mode: string; snapshot: string;
  saved_at: string; updated_at: string; sync_state: string;
}

function toRow(r: Raw): SavedOutingRow {
  let snapshot: OutingSnapshot | null = null;
  try {
    const parsed = outingSnapshotSchema.safeParse(JSON.parse(r.snapshot));
    if (parsed.success) snapshot = parsed.data;
  } catch {
    snapshot = null;
  }
  return {
    id: r.id,
    name: r.name,
    note: r.note,
    returnMode: r.return_mode as ReturnMode,
    savedAt: r.saved_at,
    updatedAt: r.updated_at,
    syncState: r.sync_state as SyncState,
    snapshot,
  };
}

export function validateName(name: string) {
  const t = name.trim();
  return t.length >= 1 && t.length <= 80;
}

/** Creation is an INSERT with a UUID made before the first attempt; never an upsert. */
export async function insertOuting(input: { id: string; name: string; note: string; snapshot: OutingSnapshot }) {
  const snapshot = outingSnapshotSchema.parse(input.snapshot);
  const text = JSON.stringify(snapshot);
  if (text.length > LIMITS.maxSnapshotBytes) throw new Error("This outing is too large to save.");
  if (!validateName(input.name) || input.note.length > LIMITS.maxNoteLength) throw new Error("Invalid name or note.");
  const d = await db();
  await d.runAsync(
    `INSERT INTO saved_outings (id, name, note, return_mode, snapshot, schema_version, saved_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.id, input.name.trim(), input.note, snapshot.returnMode, text, snapshot.schemaVersion, snapshot.savedAt, snapshot.savedAt],
  );
}

export async function listOutings(): Promise<SavedOutingRow[]> {
  const d = await db();
  const rows = await d.getAllAsync<Raw>("SELECT * FROM saved_outings ORDER BY updated_at DESC LIMIT 20");
  return rows.map(toRow);
}

export async function getOuting(id: string): Promise<SavedOutingRow | null> {
  const d = await db();
  const r = await d.getFirstAsync<Raw>("SELECT * FROM saved_outings WHERE id = ?", [id]);
  return r ? toRow(r) : null;
}

export async function updateOutingText(id: string, name: string, note: string) {
  if (!validateName(name) || note.length > LIMITS.maxNoteLength) throw new Error("Invalid name or note.");
  const d = await db();
  await d.runAsync("UPDATE saved_outings SET name = ?, note = ?, updated_at = ? WHERE id = ?", [
    name.trim(), note, new Date().toISOString(), id,
  ]);
}

export async function deleteOuting(id: string) {
  const d = await db();
  await d.runAsync("DELETE FROM saved_outings WHERE id = ?", [id]);
}
