export type Direction = 'left' | 'right' | 'up' | 'down';

export function mergeLine(line: readonly number[]): { line: number[]; score: number } {
  const compact = line.filter((value) => value !== 0);
  const merged: number[] = [];
  let score = 0;

  for (let index = 0; index < compact.length; index += 1) {
    const value = compact[index];
    if (value === compact[index + 1]) {
      const combined = value * 2;
      merged.push(combined);
      score += combined;
      index += 1;
    } else {
      merged.push(value);
    }
  }

  while (merged.length < line.length) merged.push(0);
  return { line: merged, score };
}

export function moveBoard(
  board: readonly (readonly number[])[],
  direction: Direction,
): { board: number[][]; score: number; changed: boolean } {
  const size = board.length;
  const result = board.map((row) => [...row]);
  let score = 0;

  const readLine = (index: number): number[] => {
    if (direction === 'left' || direction === 'right') {
      const row = [...(board[index] ?? [])];
      return direction === 'right' ? row.reverse() : row;
    }
    const column = board.map((row) => row[index] ?? 0);
    return direction === 'down' ? column.reverse() : column;
  };

  const writeLine = (index: number, line: readonly number[]): void => {
    const output = [...line];
    if (direction === 'right' || direction === 'down') output.reverse();
    if (direction === 'left' || direction === 'right') {
      for (let column = 0; column < size; column += 1) result[index][column] = output[column] ?? 0;
    } else {
      for (let row = 0; row < size; row += 1) result[row][index] = output[row] ?? 0;
    }
  };

  for (let index = 0; index < size; index += 1) {
    const moved = mergeLine(readLine(index));
    score += moved.score;
    writeLine(index, moved.line);
  }

  const changed = result.some((row, rowIndex) => row.some((value, column) => value !== (board[rowIndex]?.[column] ?? 0)));
  return { board: result, score, changed };
}
