import type { Hourglass, Session } from '../../domain/types';
import type { Repository } from './repository';

/**
 * Browser fallback used for previewing the app on web. The phone builds use
 * SQLite (index.ts); this keeps the same contract on top of localStorage.
 */

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(`hourglass:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(`hourglass:${key}`);
    else globalThis.localStorage?.setItem(`hourglass:${key}`, JSON.stringify(value));
  } catch {
    // Storage blocked (private mode): the app still works for this visit.
  }
}

export async function openRepository(): Promise<Repository> {
  return {
    async listHourglasses() {
      return read<Hourglass[]>('hourglasses', []).sort((a, b) => a.createdAt - b.createdAt);
    },
    async saveHourglass(h) {
      write('hourglasses', [...read<Hourglass[]>('hourglasses', []).filter((x) => x.id !== h.id), h]);
    },
    async deleteHourglass(id) {
      write('hourglasses', read<Hourglass[]>('hourglasses', []).filter((x) => x.id !== id));
    },
    async listSessions() {
      return read<Session[]>('sessions', []).sort((a, b) => b.startedAt - a.startedAt);
    },
    async saveSession(s) {
      write('sessions', [...read<Session[]>('sessions', []).filter((x) => x.id !== s.id), s]);
    },
    async deleteSession(id) {
      write('sessions', read<Session[]>('sessions', []).filter((x) => x.id !== id));
    },
    loadRuntime: async () => read('runtime', null),
    saveRuntime: async (r) => write('runtime', r),
    loadSettings: async () => read('settings', {}),
    saveSettings: async (s) => write('settings', s),
  };
}
