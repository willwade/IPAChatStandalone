import type { AppSettings } from '../types';

const NS = 'ipa-chat:';

export const storage = {
  getSettings(): Partial<AppSettings> {
    try {
      const raw = localStorage.getItem(NS + 'settings');
      return raw ? (JSON.parse(raw) as Partial<AppSettings>) : {};
    } catch {
      return {};
    }
  },
  setSettings(s: Partial<AppSettings>): void {
    try {
      const merged = { ...this.getSettings(), ...s };
      localStorage.setItem(NS + 'settings', JSON.stringify(merged));
    } catch {
      /* localStorage may be unavailable in some embedded web views */
    }
  },
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};
