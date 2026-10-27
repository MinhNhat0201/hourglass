import * as SQLite from 'expo-sqlite';

import type { Hourglass, Session } from '../../domain/types';
import type { Repository } from './repository';

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS hourglasses (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  color TEXT NOT NULL,
  auto_repeat INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  hourglass_id TEXT NOT NULL,
  hourglass_name TEXT NOT NULL,
  color TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  tracked_ms INTEGER NOT NULL,
  flip_count INTEGER NOT NULL,
  end_reason TEXT NOT NULL,
  tag TEXT,
  events TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_started_at ON sessions (started_at);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

interface HourglassRow {
  id: string;
  name: string;
  duration_ms: number;
  color: string;
  auto_repeat: number;
  created_at: number;
}

interface SessionRow {
  id: string;
  hourglass_id: string;
  hourglass_name: string;
  color: string;
  started_at: number;
  ended_at: number;
  duration_ms: number;
  tracked_ms: number;
  flip_count: number;
  end_reason: 'completed' | 'stopped';
  tag: string | null;
  events: string;
}

const toHourglass = (r: HourglassRow): Hourglass => ({
  id: r.id,
  name: r.name,
  durationMs: r.duration_ms,
  color: r.color,
  autoRepeat: r.auto_repeat === 1,
  createdAt: r.created_at,
});

const toSession = (r: SessionRow): Session => ({
  id: r.id,
  hourglassId: r.hourglass_id,
  hourglassName: r.hourglass_name,
  color: r.color,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  durationMs: r.duration_ms,
  trackedMs: r.tracked_ms,
  flipCount: r.flip_count,
  endReason: r.end_reason,
  tag: r.tag ?? undefined,
  events: JSON.parse(r.events),
});

export async function openRepository(): Promise<Repository> {
  const db = await SQLite.openDatabaseAsync('hourglass.db');
  await db.execAsync(SCHEMA);

  const getKv = async <T>(key: string): Promise<T | null> => {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
    return row ? (JSON.parse(row.value) as T) : null;
  };
  const setKv = async (key: string, value: unknown) => {
    if (value === null) await db.runAsync('DELETE FROM kv WHERE key = ?', key);
    else await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, JSON.stringify(value));
  };

  return {
    async listHourglasses() {
      const rows = await db.getAllAsync<HourglassRow>('SELECT * FROM hourglasses ORDER BY created_at');
      return rows.map(toHourglass);
    },
    async saveHourglass(h) {
      await db.runAsync(
        'INSERT OR REPLACE INTO hourglasses (id, name, duration_ms, color, auto_repeat, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        h.id,
        h.name,
        h.durationMs,
        h.color,
        h.autoRepeat ? 1 : 0,
        h.createdAt,
      );
    },
    async deleteHourglass(id) {
      await db.runAsync('DELETE FROM hourglasses WHERE id = ?', id);
    },
    async listSessions() {
      const rows = await db.getAllAsync<SessionRow>('SELECT * FROM sessions ORDER BY started_at DESC');
      return rows.map(toSession);
    },
    async saveSession(s) {
      await db.runAsync(
        `INSERT OR REPLACE INTO sessions
          (id, hourglass_id, hourglass_name, color, started_at, ended_at, duration_ms, tracked_ms, flip_count, end_reason, tag, events)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s.id,
        s.hourglassId,
        s.hourglassName,
        s.color,
        s.startedAt,
        s.endedAt,
        s.durationMs,
        s.trackedMs,
        s.flipCount,
        s.endReason,
        s.tag ?? null,
        JSON.stringify(s.events),
      );
    },
    async deleteSession(id) {
      await db.runAsync('DELETE FROM sessions WHERE id = ?', id);
    },
    loadRuntime: () => getKv('runtime'),
    saveRuntime: (r) => setKv('runtime', r),
    loadSettings: async () => (await getKv('settings')) ?? {},
    saveSettings: (s) => setKv('settings', s),
  };
}
