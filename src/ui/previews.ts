type PreviewPainter = (context: CanvasRenderingContext2D) => void;

const painters: Record<string, PreviewPainter> = {
  serpent(context) {
    background(context);
    context.fillStyle = '#6df4cf';
    [[21, 31], [29, 31], [37, 31], [37, 39], [37, 47], [45, 47]].forEach(([x, y]) => context.fillRect(x, y, 7, 7));
    context.fillStyle = '#ff74bd';
    context.fillRect(53, 23, 7, 7);
    context.fillStyle = '#fff';
    context.fillRect(47, 48, 2, 2);
  },
  blockStack(context) {
    background(context);
    const cells: [number, number, string][] = [[24, 24, '#aa8cff'], [32, 24, '#aa8cff'], [40, 24, '#aa8cff'], [32, 32, '#aa8cff'], [40, 40, '#ffd36d'], [48, 40, '#ffd36d'], [48, 48, '#ffd36d'], [56, 48, '#ffd36d']];
    cells.forEach(([x, y, color]) => { context.fillStyle = color; context.fillRect(x, y, 7, 7); });
  },
  brickSmash(context) {
    background(context);
    const colors = ['#ff74bd', '#ffd36d', '#6df4cf'];
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        context.fillStyle = colors[row];
        context.fillRect(14 + column * 12, 18 + row * 10, 9, 6);
      }
    }
    context.fillStyle = '#fff';
    context.fillRect(39, 48, 5, 5);
    context.fillStyle = '#aa8cff';
    context.fillRect(28, 60, 26, 5);
  },
  twenty48(context) {
    background(context);
    const tiles = [['#384a61', '#6df4cf'], ['#aa8cff', '#ffd36d'], ['#ff74bd', '#6df4cf']];
    const values = [['2', '4'], ['8', '16'], ['32', '64']];
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 2; column += 1) {
        const x = 19 + column * 23;
        const y = 18 + row * 20;
        context.fillStyle = tiles[row][column];
        context.fillRect(x, y, 18, 16);
        context.fillStyle = '#171125';
        context.font = 'bold 8px ui-monospace, monospace';
        context.textAlign = 'center';
        context.fillText(values[row][column], x + 9, y + 11);
      }
    }
  },
  mineSweep(context) {
    background(context);
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        const x = 13 + column * 12;
        const y = 15 + row * 12;
        context.fillStyle = (row + column) % 3 === 0 ? '#34264c' : '#25314a';
        context.fillRect(x, y, 10, 10);
      }
    }
    context.fillStyle = '#6df4cf';
    context.font = 'bold 9px ui-monospace, monospace';
    context.textAlign = 'center';
    context.fillText('1', 30, 35);
    context.fillStyle = '#ff74bd';
    context.fillRect(50, 39, 6, 6);
  },
};

function background(context: CanvasRenderingContext2D): void {
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, 80, 80);
  context.fillStyle = '#19132a';
  context.fillRect(0, 0, 80, 80);
  context.strokeStyle = 'rgba(109, 244, 207, .08)';
  context.lineWidth = 1;
  for (let x = 8; x < 80; x += 16) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 80); context.stroke();
  }
  for (let y = 8; y < 80; y += 16) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(80, y); context.stroke();
  }
}

export function drawGamePreviews(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLCanvasElement>('[data-preview]').forEach((canvas) => {
    const context = canvas.getContext('2d');
    const paint = painters[canvas.dataset.preview ?? ''];
    if (!context || !paint) return;
    canvas.width = 80;
    canvas.height = 80;
    paint(context);
  });
}
