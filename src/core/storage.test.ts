// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { ArcadeStorage } from './storage';

describe('ArcadeStorage numeric settings', () => {
  let storage: ArcadeStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new ArcadeStorage();
  });

  it('uses the supplied fallback when no numeric setting is stored', () => {
    expect(storage.getNumber('block-stack:repeat', 1)).toBe(1);
    expect(storage.getNumber('touch:opacity', 0.92)).toBe(0.92);
  });

  it('preserves an explicitly stored zero', () => {
    storage.setNumber('setting', 0);
    expect(storage.getNumber('setting', 1)).toBe(0);
  });

  it('uses the fallback for invalid stored numeric text', () => {
    localStorage.setItem('retro-arcade:data:broken', 'not-a-number');
    expect(storage.getNumber('broken', 42)).toBe(42);
  });
});
