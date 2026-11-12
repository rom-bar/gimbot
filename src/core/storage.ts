import type { StorageApi } from '../games/types';

const PREFIX = 'retro-arcade:';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(`${PREFIX}${key}`);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(`${PREFIX}${key}`, value);
  } catch {
    // The arcade remains playable when browser storage is unavailable.
  }
}

export class ArcadeStorage implements StorageApi {
  getBestScore(id: string): number {
    const value = Number(read(`best:${id}`));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  setBestScore(id: string, value: number): void {
    if (Number.isFinite(value) && value >= 0) write(`best:${id}`, String(Math.floor(value)));
  }

  getBoolean(key: string, fallback = false): boolean {
    const value = read(`setting:${key}`);
    return value === null ? fallback : value === 'true';
  }

  setBoolean(key: string, value: boolean): void {
    write(`setting:${key}`, String(value));
  }

  getNumber(key: string, fallback = 0): number {
    const stored = read(`data:${key}`);
    if (stored === null) return fallback;
    const value = Number(stored);
    return Number.isFinite(value) ? value : fallback;
  }

  setNumber(key: string, value: number): void {
    if (Number.isFinite(value)) write(`data:${key}`, String(value));
  }
}
