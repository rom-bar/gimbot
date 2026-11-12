export type ControlName = 'up' | 'down' | 'left' | 'right' | 'action' | 'secondary' | 'hold';
export type GameStatus = 'ready' | 'playing' | 'paused' | 'over';
export type DirectionControl = Extract<ControlName, 'up' | 'down' | 'left' | 'right'>;

export interface TouchControlSpec {
  dpad: DirectionControl[];
  buttons: Array<Extract<ControlName, 'action' | 'secondary' | 'hold'>>;
  optionalButtons?: Array<Extract<ControlName, 'action' | 'secondary' | 'hold'>>;
  labels: Partial<Record<'action' | 'secondary' | 'hold', string>>;
  gestures?: boolean;
  hardDropOnFlick?: boolean;
}

export interface GameMeta {
  id: string;
  title: string;
  description: string;
  controls: string;
  accent: string;
  touchControls: TouchControlSpec;
}

export interface InputApi {
  down(control: ControlName): boolean;
  pressed(control: ControlName): boolean;
}

export interface AudioApi {
  readonly muted: boolean;
  tone(frequency: number, durationMs?: number, waveform?: OscillatorType, volume?: number): void;
}

export interface StorageApi {
  getBestScore(id: string): number;
  setBestScore(id: string, value: number): void;
  getBoolean(key: string, fallback?: boolean): boolean;
  setBoolean(key: string, value: boolean): void;
  getNumber(key: string, fallback?: number): number;
  setNumber(key: string, value: number): void;
}

export interface ScoreApi {
  current(): number;
  best(): number;
  set(value: number): void;
  add(value: number): void;
  reset(): void;
}

export interface GameContext {
  input: InputApi;
  audio: AudioApi;
  storage: StorageApi;
  score: ScoreApi;
  setStatus(status: GameStatus): void;
}

export interface Game {
  meta: GameMeta;
  init(canvas: HTMLCanvasElement, context: GameContext): void;
  update(dt: number): void;
  render(): void;
  destroy(): void;
  pause(): void;
  resume(): void;
  getDebugState?(): Record<string, unknown>;
  setSeed?(seed: number): void;
}

export interface GameEntry {
  meta: GameMeta;
  create(): Game;
}
