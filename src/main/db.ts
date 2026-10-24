import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SessionRecord } from '../shared/types';

interface StoreData {
  kv: Record<string, any>;
  sessions: SessionRecord[];
}

let cache: StoreData | null = null;
let storageFilePath: string | null = null;

function getStorePath(): string {
  if (storageFilePath) return storageFilePath;
  const userDataDir = app.getPath('userData');
  mkdirSync(userDataDir, { recursive: true });
  storageFilePath = join(userDataDir, 'whis-store.json');
  return storageFilePath;
}

function loadStore(): StoreData {
  if (cache) return cache;
  const filePath = getStorePath();
  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      cache = JSON.parse(raw);
      if (!cache?.kv) cache = { kv: {}, sessions: [] };
      if (!Array.isArray(cache.sessions)) cache.sessions = [];
      return cache;
    } catch (e) {
      console.error('[Store] Failed to read store file, reinitializing', e);
    }
  }
  cache = { kv: {}, sessions: [] };
  return cache;
}

function persistStore(): void {
  if (!cache) return;
  const filePath = getStorePath();
  try {
    const tempPath = `${filePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(cache, null, 2), 'utf-8');
    writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Failed to persist data', err);
  }
}

export function getKV<T = any>(key: string, defaultValue?: T): T | undefined {
  const store = loadStore();
  const val = store.kv[key];
  return val !== undefined ? val : defaultValue;
}

export function setKV(key: string, value: any): void {
  const store = loadStore();
  store.kv[key] = value;
  persistStore();
}

export function getAllSessions(): SessionRecord[] {
  const store = loadStore();
  return store.sessions || [];
}

export function saveSessionRecord(session: SessionRecord): void {
  const store = loadStore();
  const existingIdx = store.sessions.findIndex((s) => s.id === session.id);
  if (existingIdx >= 0) {
    store.sessions[existingIdx] = session;
  } else {
    store.sessions.unshift(session);
  }
  if (store.sessions.length > 50) {
    store.sessions = store.sessions.slice(0, 50);
  }
  persistStore();
}

export function deleteSessionRecord(id: string): void {
  const store = loadStore();
  store.sessions = store.sessions.filter((s) => s.id !== id);
  persistStore();
}
