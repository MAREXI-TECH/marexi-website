# Uso: python tools/og-images.py  (regenera assets/og/*.jpg a partir de logos/ y vigo.jpg)
# Genera las imágenes para compartir (1200x630) en assets/og/: fondo azul marino de la marca, logo del producto y logo de Marexi.
import os, json
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'og'); os.makedirs(OUT, exist_ok=True)
W, H = 1200, 630
NAVY = (6, 15, 29); NAVY2 = (12, 36, 62); CYAN = (55, 198, 201); ACCENT = (255, 106, 77)
CARDS = {  # nombre de imagen -> logo del producto (None = solo Marexi)
 'marexi': None, 'pinger': 'pinger', 'anisakischeck': 'anisakischeck', 'scanisakis': 'scanisakis',
 'matrixled': 'matrixled', 'retroled': 'retroled', 'uvpress': 'uvpress', 'aquadef': 'aquadef',
 'tedepad': 'tedepad', 'tunascan': 'tunascan', 'hydrophones': 'hydrophones', 'acoustic-tank': 'acoustic-water-tank',
 'cylinder': 'cylinder', 'usv-victoria': 'usv-victoria', 'dual-use': 'dual-use', 'seasampler': 'seasampler',
 'tclean': 'tclean', 'sfs': 'sfs', 'c-tuna': 'c-tuna', 'bioacoustics': 'bioacoustics',
 'contaminants': 'contaminants', 'shark-bycatch': 'shark-bycatch'}

def fondo():
    im = Image.new('RGB', (W, H), NAVY)
    g = Image.new('L', (W, H), 0); d = ImageDraw.Draw(g)
    d.ellipse((W * 0.45, -H * 0.6, W * 1.35, H * 0.9), fill=255)
    g = g.filter(ImageFilter.GaussianBlur(160))
    im = Image.composite(Image.new('RGB', (W, H), NAVY2), im, g)
    d = ImageDraw.Draw(im)
    d.rectangle((0, H - 10, W, H), fill=CYAN); d.rectangle((0, H - 10, 220, H), fill=ACCENT)
    return im

def pegar(im, path, box_w, box_h, cx, cy):
    lg = Image.open(path).convert('RGBA'); k = min(box_w / lg.width, box_h / lg.height, 2.6)
    lg = lg.resize((int(lg.width * k), int(lg.height * k)), Image.LANCZOS)
    im.paste(lg, (int(cx - lg.width / 2), int(cy - lg.height / 2)), lg)

mx = os.path.join(ROOT, 'logo_marexi_light.png')
for name, logo in CARDS.items():
    im = fondo()
    if logo:
        pegar(im, os.path.join(ROOT, 'logos', logo + '.png'), 860, 300, W / 2, H / 2 - 35)
        pegar(im, mx, 230, 92, W / 2, H - 95)
    else:
        ph = Image.open(os.path.join(ROOT, 'vigo.jpg')).convert('RGB'); k = max(W / ph.width, H / ph.height)
        ph = ph.resize((int(ph.width * k), int(ph.height * k)), Image.LANCZOS); x = (ph.width - W) // 2; y = (ph.height - H) // 2
        ph = ph.crop((x, y, x + W, y + H)); im = Image.blend(ph, Image.new('RGB', (W, H), NAVY), 0.62)
        d = ImageDraw.Draw(im); d.rectangle((0, H - 10, W, H), fill=CYAN); d.rectangle((0, H - 10, 220, H), fill=ACCENT)
        pegar(im, mx, 520, 208, W / 2, H / 2 - 5)
    im.save(os.path.join(OUT, name + '.jpg'), quality=86, optimize=True, progressive=True)
print('generadas', len(CARDS), 'en', OUT)
