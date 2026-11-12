export function rotateMatrix(matrix: readonly (readonly number[])[]): number[][] {
  if (matrix.length === 0) return [];
  const height = matrix.length;
  const width = matrix[0]?.length ?? 0;
  if (width === 0) return matrix.map(() => []);
  return Array.from({ length: width }, (_, row) =>
    Array.from({ length: height }, (_, column) => matrix[height - 1 - column]?.[row] ?? 0),
  );
}

export function clearLines(board: readonly (readonly number[])[]): {
  board: number[][];
  cleared: number;
} {
  const remaining = board.filter((row) => row.length === 0 || row.some((cell) => cell === 0));
  const cleared = board.length - remaining.length;
  const width = board[0]?.length ?? 0;
  const emptyRows = Array.from({ length: cleared }, () => Array<number>(width).fill(0));
  return { board: [...emptyRows, ...remaining.map((row) => [...row])] , cleared };
}
