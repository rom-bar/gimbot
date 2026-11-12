import type { AudioApi, StorageApi } from '../games/types';

export class ArcadeAudio implements AudioApi {
  private context: AudioContext | null = null;
  private mutedValue: boolean;

  constructor(private readonly storage: StorageApi) {
    this.mutedValue = storage.getBoolean('muted', false);
  }

  get muted(): boolean {
    return this.mutedValue;
  }

  setMuted(muted: boolean): void {
    this.mutedValue = muted;
    this.storage.setBoolean('muted', muted);
  }

  async unlock(): Promise<void> {
    const context = this.getContext();
    if (context?.state === 'suspended') await context.resume();
  }

  tone(frequency: number, durationMs = 75, waveform: OscillatorType = 'square', volume = 0.07): void {
    if (this.muted || !Number.isFinite(frequency) || frequency <= 0) return;
    const context = this.getContext();
    if (!context) return;
    if (context.state === 'suspended') void context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    const duration = Math.max(0.025, Math.min(durationMs / 1000, 1));
    const level = Math.max(0.001, Math.min(volume, 0.14));

    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(Math.min(frequency, 1800), start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
    this.context ??= new AudioContext();
    return this.context;
  }
}
