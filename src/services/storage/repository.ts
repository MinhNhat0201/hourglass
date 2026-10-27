import type { Settings } from '../../domain/settings';
import type { Hourglass, RuntimeState, Session } from '../../domain/types';

/** Local persistence (spec §8). No backend: everything stays on the device. */
export interface Repository {
  listHourglasses(): Promise<Hourglass[]>;
  saveHourglass(h: Hourglass): Promise<void>;
  deleteHourglass(id: string): Promise<void>;

  listSessions(): Promise<Session[]>;
  saveSession(s: Session): Promise<void>;
  deleteSession(id: string): Promise<void>;

  loadRuntime(): Promise<RuntimeState | null>;
  saveRuntime(r: RuntimeState | null): Promise<void>;

  loadSettings(): Promise<Partial<Settings>>;
  saveSettings(s: Settings): Promise<void>;
}
