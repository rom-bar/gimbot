// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputManager } from './input';
import { HoldRepeater } from '../platform/touch-controls/repeater';

describe('InputManager sources', () => {
  let input: InputManager;

  afterEach(() => {
    input?.destroy();
  });

  it('keeps a control held until every pointer or key source releases it', () => {
    input = new InputManager();
    input.setActive(true);
    input.setSourceButton('left', 'pointer:1', true);
    input.setSourceButton('action', 'pointer:2', true);
    expect(input.down('left')).toBe(true);
    expect(input.down('action')).toBe(true);
    input.setSourceButton('left', 'key:ArrowLeft', true);
    input.setSourceButton('left', 'pointer:1', false);
    expect(input.down('left')).toBe(true);
    input.setSourceButton('left', 'key:ArrowLeft', false);
    expect(input.down('left')).toBe(false);
    expect(input.down('action')).toBe(true);
  });

  it('clears all held and pressed inputs on blur or visibility loss', () => {
    input = new InputManager();
    input.setActive(true);
    input.setSourceButton('right', 'pointer:4', true);
    input.setSourceButton('action', 'pointer:5', true);
    window.dispatchEvent(new Event('blur'));
    expect(input.snapshot().down).toEqual([]);
    expect(input.snapshot().pressed).toEqual([]);
  });

  it('records pulses so repeat behavior can be asserted by tests', () => {
    input = new InputManager();
    input.pulse('right');
    input.pulse('right');
    expect(input.snapshot().pulses.right).toBe(2);
    expect(input.pressed('right')).toBe(true);
    input.finishFrame();
    expect(input.pressed('right')).toBe(true);
    input.finishFrame();
    expect(input.pressed('right')).toBe(false);
  });
});

describe('HoldRepeater timing', () => {
  afterEach(() => vi.useRealTimers());

  it('waits 140ms, then repeats at the configured interval', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const repeater = new HoldRepeater();
    repeater.start(callback, 140, 40);
    vi.advanceTimersByTime(139);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(39);
    expect(callback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(80);
    expect(callback).toHaveBeenCalledTimes(4);
    repeater.stop();
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(4);
  });

  it('supports the faster 30ms soft-drop interval', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const repeater = new HoldRepeater();
    repeater.start(callback, 150, 30);
    vi.advanceTimersByTime(240);
    expect(callback).toHaveBeenCalledTimes(4);
    repeater.stop();
  });
});
