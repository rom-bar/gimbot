import { describe, expect, it } from 'vitest';
import { mergeLine, moveBoard, type Direction } from './logic';

describe('mergeLine', () => {
  it('does not double-merge a newly combined tile', () => {
    expect(mergeLine([2, 2, 2, 2])).toEqual({ line: [4, 4, 0, 0], score: 8 });
    expect(mergeLine([2, 2, 4, 0])).toEqual({ line: [4, 4, 0, 0], score: 4 });
  });

  it('returns the score produced by each merge', () => {
    expect(mergeLine([4, 4, 8, 8])).toEqual({ line: [8, 16, 0, 0], score: 24 });
  });
});

describe('moveBoard', () => {
  const cases: Array<[Direction, number[][], number[][]]> = [
    ['left', [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 4, 2]], [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [4, 2, 0, 0]]],
    ['right', [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [4, 2, 0, 0]], [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 4, 2]]],
    ['up', [[0, 0, 0, 0], [0, 0, 0, 0], [4, 0, 0, 0], [2, 0, 0, 0]], [[4, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]],
    ['down', [[4, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], [[0, 0, 0, 0], [0, 0, 0, 0], [4, 0, 0, 0], [2, 0, 0, 0]]],
  ];

  it.each(cases)('moves tiles %s', (direction, board, expected) => {
    const moved = moveBoard(board, direction);
    expect(moved.board).toEqual(expected);
    expect(moved.changed).toBe(true);
  });

  it('reports a no-op without score', () => {
    const board = [
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2, 4],
      [8, 16, 32, 64],
    ];
    expect(moveBoard(board, 'left')).toEqual({ board, score: 0, changed: false });
  });
});
