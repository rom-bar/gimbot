export type RevealResult = {
  revealed: boolean[][];
  cells: [number, number][];
};

const DIRECTIONS: readonly [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

/** Reveals one safe cell and expands zero-valued regions with breadth-first search. */
export function floodReveal(
  board: readonly (readonly number[])[],
  revealed: readonly (readonly boolean[])[],
  row: number,
  column: number,
): RevealResult {
  const next = board.map((line, index) =>
    line.map((_, columnIndex) => revealed[index]?.[columnIndex] === true),
  );
  const cells: [number, number][] = [];
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0) {
    return { revealed: next, cells };
  }
  if (row >= board.length || column >= (board[row]?.length ?? 0)) return { revealed: next, cells };
  if (board[row][column] < 0 || next[row][column]) return { revealed: next, cells };

  const queue: [number, number][] = [[row, column]];
  let head = 0;
  while (head < queue.length) {
    const [currentRow, currentColumn] = queue[head++];
    if (currentRow < 0 || currentRow >= board.length) continue;
    if (currentColumn < 0 || currentColumn >= (board[currentRow]?.length ?? 0)) continue;
    if (next[currentRow][currentColumn] || board[currentRow][currentColumn] < 0) continue;

    next[currentRow][currentColumn] = true;
    cells.push([currentRow, currentColumn]);
    if (board[currentRow][currentColumn] !== 0) continue;

    for (const [rowOffset, columnOffset] of DIRECTIONS) {
      const adjacentRow = currentRow + rowOffset;
      const adjacentColumn = currentColumn + columnOffset;
      if (
        adjacentRow >= 0 && adjacentRow < board.length
        && adjacentColumn >= 0 && adjacentColumn < (board[adjacentRow]?.length ?? 0)
        && !next[adjacentRow][adjacentColumn]
        && board[adjacentRow][adjacentColumn] >= 0
      ) {
        queue.push([adjacentRow, adjacentColumn]);
      }
    }
  }

  return { revealed: next, cells };
}
