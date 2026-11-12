import { describe, expect, it } from 'vitest';
import { floodReveal } from './logic';

describe('floodReveal', () => {
  it('expands a zero area and its numbered perimeter', () => {
    const board = [
      [0, 0, 1, 1],
      [0, 0, 1, -1],
      [0, 0, 1, 1],
    ] as const;
    const result = floodReveal(board, board.map((row) => row.map(() => false)), 1, 0);

    expect(new Set(result.cells.map(([cellRow, cellColumn]) => `${cellRow}:${cellColumn}`))).toEqual(new Set([
      '1:0', '0:0', '1:1', '2:0', '0:1', '2:1', '0:2', '1:2', '2:2',
    ]));
    expect(result.cells).toHaveLength(9);
    expect(result.revealed[1][3]).toBe(false);
    expect(result.revealed[0][3]).toBe(false);
  });

  it('reveals a positive number without expanding beyond that cell', () => {
    const board = [
      [1, 1, 1],
      [1, 2, 1],
      [1, 1, -1],
    ] as const;
    const result = floodReveal(board, board.map((row) => row.map(() => false)), 1, 1);

    expect(result.cells).toEqual([[1, 1]]);
    expect(result.revealed[0][0]).toBe(false);
  });

  it('returns a safe copy and no cells for out-of-bounds coordinates', () => {
    const board = [[0, 0], [0, 0]] as const;
    const revealed = [[true, false], [false, false]] as const;
    const result = floodReveal(board, revealed, -1, 4);

    expect(result.cells).toEqual([]);
    expect(result.revealed).toEqual([[true, false], [false, false]]);
    expect(result.revealed).not.toBe(revealed);
  });

  it('never reveals a hazard', () => {
    const board = [[0, -1], [1, 1]] as const;
    const result = floodReveal(board, [[false, false], [false, false]], 0, 1);

    expect(result.cells).toEqual([]);
    expect(result.revealed).toEqual([[false, false], [false, false]]);
  });

  it('does not duplicate cells when zero regions meet', () => {
    const board = [[0, 0, 0], [0, 0, 0]] as const;
    const result = floodReveal(board, [[false, false, false], [false, false, false]], 0, 0);

    expect(new Set(result.cells.map(([row, column]) => `${row}:${column}`)).size).toBe(result.cells.length);
    expect(result.cells).toHaveLength(6);
  });
});
