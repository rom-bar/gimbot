import { describe, expect, it } from 'vitest';
import { applyMove, getLegalMoves } from './logic';

const opening = (): number[][] => {
  const board = Array.from({ length: 8 }, () => Array<number>(8).fill(0));
  board[3][3] = -1;
  board[3][4] = 1;
  board[4][3] = 1;
  board[4][4] = -1;
  return board;
};

describe('Disk Reversal rules', () => {
  it('returns the four standard opening moves for either player', () => {
    expect(getLegalMoves(opening(), 1)).toEqual([
      [2, 3], [3, 2], [4, 5], [5, 4],
    ]);
    expect(getLegalMoves(opening(), -1)).toEqual([
      [2, 4], [3, 5], [4, 2], [5, 3],
    ]);
  });

  it('flips pieces in every direction from one move', () => {
    const board = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
    const directions = [
      [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
    ];
    for (const [rowStep, columnStep] of directions) {
      board[4 + rowStep][4 + columnStep] = -1;
      board[4 + rowStep * 2][4 + columnStep * 2] = 1;
    }
    const result = applyMove(board, 1, 4, 4);
    expect(result).not.toBeNull();
    expect(result?.flat().filter((cell) => cell === 1)).toHaveLength(17);
    for (const [rowStep, columnStep] of directions) {
      expect(result?.[4 + rowStep]?.[4 + columnStep]).toBe(1);
    }
  });

  it('rejects occupied, out-of-range, and non-capturing moves', () => {
    const board = opening();
    expect(applyMove(board, 1, 3, 3)).toBeNull();
    expect(applyMove(board, 1, -1, 0)).toBeNull();
    expect(applyMove(board, 1, 0, 0)).toBeNull();
    expect(getLegalMoves(board, 1)).not.toContainEqual([0, 0]);
  });
});
