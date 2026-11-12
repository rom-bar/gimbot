from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / 'docs' / 'screenshots'
GAMES = [
    'serpent', 'block-stack', 'brick-smash', 'twenty48', 'mine-sweep', 'paddle-duel',
    'brick-runner', 'rock-blaster', 'star-defender', 'maze-muncher', 'road-hopper',
    'sliding-tiles', 'lights-out', 'memory-match', 'three-in-a-row', 'disk-reversal',
    'checkers', 'word-guess', 'card-solitaire', 'life-grid',
]
VIEWPORTS = ['320x568', '360x740', '740x360']
STATES = ['idle', 'mid-play', 'paused', 'game-over', 'settings']
COLUMNS = 4
CELL_W = 240
LABEL_H = 26
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)

for viewport in VIEWPORTS:
    source = SCREENSHOTS / viewport
    with Image.open(source / f'{GAMES[0]}-idle.jpg') as sample:
        ratio = sample.width / sample.height
    thumb_w = CELL_W - 12
    thumb_h = round(thumb_w / ratio)
    rows = (len(GAMES) + COLUMNS - 1) // COLUMNS
    for state in STATES:
        sheet = Image.new('RGB', (COLUMNS * CELL_W, rows * (thumb_h + LABEL_H)), '#100d20')
        draw = ImageDraw.Draw(sheet)
        for index, game in enumerate(GAMES):
            file = source / f'{game}-{state}.jpg'
            if not file.exists():
                raise FileNotFoundError(file)
            x = (index % COLUMNS) * CELL_W
            y = (index // COLUMNS) * (thumb_h + LABEL_H)
            with Image.open(file) as image:
                image = image.convert('RGB').resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
                sheet.paste(image, (x + 6, y + LABEL_H))
            draw.text((x + 7, y + 5), game, fill='#6df4cf', font=FONT)
        sheet.save(SCREENSHOTS / f'contact-{viewport}-{state}.jpg', quality=82, optimize=True)

print('Created 15 contact sheets.')
