import { describe, expect, it } from 'vitest';
import { clearLines, rotateMatrix } from './logic';

describe('rotateMatrix', () => {
  it('rotates a 4x4 matrix clockwise', () => {
    const matrix = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 16],
    ];
    expect(rotateMatrix(matrix)).toEqual([
      [13, 9, 5, 1],
      [14, 10, 6, 2],
      [15, 11, 7, 3],
      [16, 12, 8, 4],
    ]);
  });
});

describe('clearLines', () => {
  it('clears one complete row and adds an empty row at the top', () => {
    const board = [
      [0, 1, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 2, 0],
    ];
    expect(clearLines(board)).toEqual({
      board: [
        [0, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 2, 0],
      ],
      cleared: 1,
    });
  });

  it('clears multiple complete rows while preserving row order', () => {
    const board = [
      [1, 0, 1, 0],
      [2, 2, 2, 2],
      [3, 3, 3, 3],
      [0, 4, 0, 0],
    ];
    expect(clearLines(board)).toEqual({
      board: [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [1, 0, 1, 0],
        [0, 4, 0, 0],
      ],
      cleared: 2,
    });
  });
});
