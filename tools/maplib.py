"""Shared helpers to read/render pokeemerald tilesets and layouts (used by build_story.py)."""
import json, os, re, struct, sys, glob
from PIL import Image
SRC = os.environ.get('PRET', '/tmp/pret_pokeemerald')
P = lambda *a: os.path.join(SRC, *a)
layouts = {l['id']: l for l in json.load(open(P('data/layouts/layouts.json')))['layouts'] if 'id' in l}
map_by_id = {}
for d in os.listdir(P('data/maps')):
    try: j = json.load(open(P('data/maps', d, 'map.json'))); map_by_id[j['id']] = d
    except Exception: pass


# ---- tilesets ----
def snake(s): return re.sub(r'(?<!^)(?=[A-Z])', '_', s).lower()
def tsdir(name):
    base = name.replace('gTileset_', '')
    for kind in ('primary', 'secondary'):
        p = P('data/tilesets', kind, snake(base))
        if os.path.isdir(p): return p
    if base.startswith('SecretBase'):   # secret base variants: graphics in secret_base/<variant>, metatiles shared in secret_base/
        p = P('data/tilesets/secondary/secret_base', snake(base[len('SecretBase'):]))
        if os.path.isdir(p): return p
    raise SystemExit('missing tileset ' + name + ' -> ' + snake(base))
def jasc(path):
    L = open(path).read().split('\n')[3:19]
    return [tuple(int(x) for x in l.split()[:3]) for l in L if l.strip()]
TS = {}
def tileset(name):
    if name in TS: return TS[name]
    d = tsdir(name)
    tiles = Image.open(d + '/tiles.png'); tw = tiles.width // 8
    tdata = list(tiles.getdata()) if tiles.mode == 'P' else None
    if tdata is None:  # grayscale: map brightness to index
        g = tiles.convert('L'); tdata = [15 - (v >> 4) for v in g.getdata()]
    pals = [jasc(f'{d}/palettes/{i:02d}.pal') for i in range(16)]
    md = d if os.path.exists(d + '/metatiles.bin') else os.path.dirname(d)
    mt = open(md + '/metatiles.bin', 'rb').read(); at = open(md + '/metatile_attributes.bin', 'rb').read()
    TS[name] = dict(d=d, tw=tw, tdata=tdata, tiles=tiles, ntiles=tw * (tiles.height // 8), pals=pals,
                    mt=struct.unpack('<%dH' % (len(mt) // 2), mt), at=struct.unpack('<%dH' % (len(at) // 2), at))
    return TS[name]

def render_tile(img, px, py, prim, sec, entry):
    t = entry & 0x3FF; hf = entry & 0x400; vf = entry & 0x800; pal = entry >> 12
    src = prim if t < 512 else sec; ti = t if t < 512 else t - 512
    if ti >= src['ntiles']: return
    palette = (prim if pal < 6 else sec)['pals'][pal]
    tx, ty = ti % src['tw'], ti // src['tw']; w = src['tw'] * 8
    for y in range(8):
        for x in range(8):
            sx = 7 - x if hf else x; sy = 7 - y if vf else y
            c = src['tdata'][(ty * 8 + sy) * w + tx * 8 + sx] & 15
            if c: img.putpixel((px + x, py + y), palette[c] + (255,))

MT_CACHE = {}
def metatile(prim, sec, mid):
    key = (prim['d'], sec['d'], mid)
    if key in MT_CACHE: return MT_CACHE[key]
    src, i = (prim, mid) if mid < 512 else (sec, mid - 512)
    ents = src['mt'][i * 8:(i + 1) * 8] if (i + 1) * 8 <= len(src['mt']) else [0] * 8
    attr = src['at'][i] if i < len(src['at']) else 0
    layer = (attr >> 12) & 0xF; beh = attr & 0xFF
    bot = Image.new('RGBA', (16, 16), prim['pals'][0][0] + (255,)); top = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for k in range(4): render_tile(bot, (k % 2) * 8, (k // 2) * 8, prim, sec, ents[k])
    tgt = bot if layer == 1 else top   # COVERED: both layers under sprites
    for k in range(4): render_tile(tgt, (k % 2) * 8, (k // 2) * 8, prim, sec, ents[4 + k])
    MT_CACHE[key] = (bot, top, beh)
    return MT_CACHE[key]

# ---- behaviors we care about ----
beh_names = {}
for line in open(P('include/constants/metatile_behaviors.h')):
    m = re.match(r'\s*(MB_\w+)', line)
    if m: beh_names[len(beh_names)] = m.group(1)


def load_layout(map_name):
    j = json.load(open(P('data/maps', map_name, 'map.json'))); L = layouts[j['layout']]
    W, H = L['width'], L['height']
    blocks = list(struct.unpack('<%dH' % (W * H), open(P(L['blockdata_filepath']), 'rb').read()[:W * H * 2]))
    return dict(W=W, H=H, blocks=blocks, prim=L['primary_tileset'], sec=L['secondary_tileset'], border=L['border_filepath'], j=j)
def render(W, H, blocks, prim, sec):
    prim, sec = tileset(prim), tileset(sec)
    bimg = Image.new('RGBA', (W * 16, H * 16)); timg = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 0)); behs = []
    for i, v in enumerate(blocks):
        b, t, beh = metatile(prim, sec, v & 0x3FF); x, y = (i % W) * 16, (i // W) * 16
        bimg.paste(b, (x, y)); timg.alpha_composite(t, (x, y)); behs.append(beh)
    return bimg, timg, behs
