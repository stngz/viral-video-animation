"""Build crisp labeled contact sheets from rendered stills so we can visually inspect every shot."""
import glob
import os
import sys
from PIL import Image, ImageDraw, ImageFont

stills_dir = r"c:\Users\NATHANIEL\Videos\Video Animation\marathon-short\out\stills"
out_dir = r"c:\Users\NATHANIEL\Videos\Video Animation\marathon-short\out\sheets"
os.makedirs(out_dir, exist_ok=True)

files = sorted(glob.glob(os.path.join(stills_dir, "f_*.jpg")))
if not files:
    print("No stills found!")
    sys.exit(1)

cols = 4
rows = 2
per_page = cols * rows
cell_w, cell_h = 360, 640
pad = 12

for page in range(0, len(files), per_page):
    batch = files[page : page + per_page]
    sheet = Image.new("RGB", (cols * (cell_w + pad) + pad, rows * (cell_h + pad) + pad), (24, 24, 28))
    draw = ImageDraw.Draw(sheet)
    for idx, fp in enumerate(batch):
        r = idx // cols
        c = idx % cols
        im = Image.open(fp).resize((cell_w, cell_h), Image.Resampling.LANCZOS)
        x = pad + c * (cell_w + pad)
        y = pad + r * (cell_h + pad)
        sheet.paste(im, (x, y))
        label = os.path.basename(fp).replace(".jpg", "")
        draw.rectangle([x + 6, y + 6, x + 110, y + 32], fill=(0, 0, 0))
        draw.text((x + 12, y + 12), label, fill=(255, 255, 180))
    out_p = os.path.join(out_dir, f"sheet_{page // per_page + 1}.jpg")
    sheet.save(out_p, quality=90)
    print("Wrote:", out_p)
