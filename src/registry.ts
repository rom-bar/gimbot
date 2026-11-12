import type { GameEntry } from './games/types';
import { createSerpent, meta as serpentMeta } from './games/serpent';
import { createBlockStack, meta as blockStackMeta } from './games/block-stack';
import { createBrickSmash, meta as brickSmashMeta } from './games/brick-smash';
import { createTwenty48, meta as twenty48Meta } from './games/twenty48';
import { createMineSweep, mineSweepMeta } from './games/mine-sweep';
import { createPaddleDuel, meta as paddleDuelMeta } from './games/paddle-duel';
import { createBrickRunner, meta as brickRunnerMeta } from './games/brick-runner';

export const gameRegistry: GameEntry[] = [
  { meta: serpentMeta, create: createSerpent },
  { meta: blockStackMeta, create: createBlockStack },
  { meta: brickSmashMeta, create: createBrickSmash },
  { meta: twenty48Meta, create: createTwenty48 },
  { meta: mineSweepMeta, create: createMineSweep },
  { meta: paddleDuelMeta, create: createPaddleDuel },
  { meta: brickRunnerMeta, create: createBrickRunner },
];
