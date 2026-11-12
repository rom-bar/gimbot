export type Player = 1 | -1;

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],            [0, 1],
  [1, -1],  [1, 0],   [1, 1],
] as const;

function isPlayer(value: number, player: Player): boolean {
  return value === player;
}

function capturesInDirection(
  board: readonly (readonly number[])[],
  player: Player,
  row: number,
  column: number,
  rowStep: number,
  columnStep: number,
): Array<[number, number]> {
  const captured: Array<[number, number]> = [];
  let nextRow = row + rowStep;
  let nextColumn = column + columnStep;
  const opponent = -player;

  while (
    nextRow >= 0 && nextRow < board.length &&
    nextColumn >= 0 && nextColumn < (board[nextRow]?.length ?? 0) &&
    board[nextRow][nextColumn] === opponent
  ) {
    captured.push([nextRow, nextColumn]);
    nextRow += rowStep;
    nextColumn += columnStep;
  }

  if (
    captured.length === 0 ||
    nextRow < 0 || nextRow >= board.length ||
    nextColumn < 0 || nextColumn >= (board[nextRow]?.length ?? 0) ||
    !isPlayer(board[nextRow][nextColumn], player)
  ) {
    return [];
  }
  return captured;
}

export function getLegalMoves(
  board: readonly (readonly number[])[],
  player: Player,
): Array<[number, number]> {
  const moves: Array<[number, number]> = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < (board[row]?.length ?? 0); column += 1) {
      if (board[row][column] !== 0) continue;
      if (DIRECTIONS.some(([rowStep, columnStep]) =>
        capturesInDirection(board, player, row, column, rowStep, columnStep).length > 0,
      )) {
        moves.push([row, column]);
      }
    }
  }
  return moves;
}

export function applyMove(
  board: readonly (readonly number[])[],
  player: Player,
  row: number,
  column: number,
): number[][] | null {
  if (
    row < 0 || row >= board.length ||
    column < 0 || column >= (board[row]?.length ?? 0) ||
    board[row][column] !== 0
  ) return null;

  const flips: Array<[number, number]> = [];
  for (const [rowStep, columnStep] of DIRECTIONS) {
    flips.push(...capturesInDirection(board, player, row, column, rowStep, columnStep));
  }
  if (flips.length === 0) return null;

  const result = board.map((boardRow) => [...boardRow]);
  result[row][column] = player;
  for (const [flipRow, flipColumn] of flips) result[flipRow][flipColumn] = player;
  return result;
}
