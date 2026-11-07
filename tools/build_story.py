#!/usr/bin/env python3
"""Build the story-mode maps (ancient Sinnoh, Ashen tribe) from pokeemerald tiles.
Maps are assembled from pieces of real Emerald maps (huts, farm plots, trees, cliffs, ash grass) so they look like
GBA maps but are our own layouts.  Output: <out>/maps/S_<Map>_{b,t,border,floor}.png and <out>/story.json
Usage: build_story.py <out dir>     (needs the pokeemerald checkout in $PRET, default /tmp/pret_pokeemerald)
"""
import json, os, sys, struct
from collections import Counter
sys.path.insert(0, os.path.dirname(__file__))
import maplib as M
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else 'world'
os.makedirs(OUT + '/maps', exist_ok=True)
SRC = {n: M.load_layout(n) for n in ['FallarborTown', 'Route113']}
COLL = 1 << 10   # collision bit in a block value

def mt(v, coll=None):
    v &= 0x3FF
    return v | (COLL if coll else 0)

class Map:
    def __init__(self, name, W, H, prim, sec, fill):
        self.name, self.W, self.H, self.prim, self.sec = name, W, H, prim, sec
        self.b = [fill] * (W * H)
        self.warps, self.signs, self.conns = [], [], []
    def put(self, x, y, v):
        if 0 <= x < self.W and 0 <= y < self.H: self.b[y * self.W + x] = v
    def get(self, x, y): return self.b[y * self.W + x]
    def stamp(self, x, y, src, sx, sy, w, h):
        L = SRC[src]
        for j in range(h):
            for i in range(w): self.put(x + i, y + j, L['blocks'][(sy + j) * L['W'] + sx + i] & 0x0FFF)
    def rect(self, x0, y0, x1, y1, v):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.put(x, y, v)
    def forest(self, x0, y0, x1, y1, edge_top=True, ground='ash'):
        """Trees fill the box (2x2 each). Top row shows tree tops over the ground."""
        top_edge = (0x206, 0x207) if ground == 'ash' else (0x204, 0x205)
        tops = (0x26B, 0x26C) if ground == 'ash' else (0x26D, 0x26E)
        bots = (0x273, 0x274) if ground == 'ash' else (0x275, 0x276)
        for y in range(y0, y1 + 1):
            r = y - y0
            for x in range(x0, x1 + 1):
                k = (x - x0) & 1
                if r == 0 and edge_top: v = mt(top_edge[k])
                elif (r % 2 == 1) if edge_top else (r % 2 == 1): v = mt(bots[k], 1)
                else: v = mt(tops[k], 1)
                if y == y1: v = mt(bots[k], 1)
                self.put(x, y, v)
    def cliff(self, y0, x0=0, x1=None):
        """North cliff band: plateau, edge, 3 rows of rock wall, base."""
        x1 = self.W - 1 if x1 is None else x1
        for x in range(x0, x1 + 1):
            self.put(x, y0, mt(0x279, 1)); self.put(x, y0 + 1, mt(0x31E, 1))
            for k in range(3): self.put(x, y0 + 2 + k, mt(0x269, 1))
            self.put(x, y0 + 5, mt(0x271))
    def hut(self, x, y): self.stamp(x, y, 'FallarborTown', 0, 3, 4, 4); return (x + 1, y + 3)   # returns the door tile
    def plot(self, x, y, k=0): self.stamp(x, y, 'Route113', 3 if k == 0 else 8, 7, 4, 3)
    def pit(self, x, y): self.stamp(x, y, 'FallarborTown', 1, 14, 3, 3)
    def shrub(self, x, y): self.stamp(x, y, 'FallarborTown', 4, 3, 2, 3); self.put(x + 1, y + 2, mt(0x279))

def save(m, extra):
    W, H = m.W, m.H
    bimg, timg, behs = M.render(W, H, m.b, m.prim, m.sec)
    n = 'S_' + m.name
    bimg.save(f'{OUT}/maps/{n}_b.png', optimize=True)
    has_top = timg.getbbox() is not None
    if has_top: timg.save(f'{OUT}/maps/{n}_t.png', optimize=True)
    prim, sec = M.tileset(m.prim), M.tileset(m.sec)
    coll = [(v >> 10) & 3 for v in m.b]
    cnt = Counter(v & 0x3FF for i, v in enumerate(m.b) if coll[i] == 0)
    fb, ft, _ = M.metatile(prim, sec, cnt.most_common(1)[0][0]); fl = fb.copy(); fl.alpha_composite(ft); fl.save(f'{OUT}/maps/{n}_floor.png')
    border = Image.new('RGBA', (32, 32))
    for k, v in enumerate(extra.pop('border', [0x26B, 0x26C, 0x273, 0x274])):
        b2, t2, _ = M.metatile(prim, sec, v); border.paste(b2, ((k % 2) * 16, (k // 2) * 16)); border.alpha_composite(t2, ((k % 2) * 16, (k // 2) * 16))
    border.save(f'{OUT}/maps/{n}_border.png')
    used = {}
    for code in set(behs):
        nm = M.beh_names.get(code, '')
        if any(k in nm for k in ('TALL_GRASS', 'LONG_GRASS', 'ASHGRASS', 'WATER', 'DOOR', 'JUMP_', 'COUNTER', 'WARP', 'PC', 'BOOKSHELF', 'POND', 'CAVE')): used[code] = nm
    d = {'w': W, 'h': H, 'top': has_top, 'coll': ''.join('1' if c else '0' for c in coll), 'beh': behs, 'behNames': used,
         'npcs': [], 'warps': m.warps, 'signs': m.signs, 'conns': m.conns, 'type': 'MAP_TYPE_TOWN', 'title': m.name, 'wild': None, 'water': None}
    d.update(extra)
    return n, d

def interior(name, src_map, door_out, furn):
    """A hut from the inside: Emerald's secret-base rooms (woven leaf / dirt / stone walls) with log furniture."""
    L = M.load_layout(src_map)
    m = Map(name, L['W'], L['H'], L['prim'], L['sec'], 0)
    m.b = [v & 0x0FFF for v in L['blocks']]
    for i, v in enumerate(m.b):
        if (v & 0x3FF) in (0x220, 0x221, 0x20E, 0x20F) and 0 < i % m.W < m.W - 1 and 0 < i // m.W < m.H - 1 and not (v & 0x3FF) == 0x20F: m.b[i] = 0x20A
    C = COLL
    for kind, x, y in furn:
        if kind == 'table':
            for i, v in enumerate((0x2A4, 0x2A5, 0x2A6)): m.put(x + i, y, v | C)
            for i, v in enumerate((0x2B4, 0x2B5, 0x2B6)): m.put(x + i, y + 1, v | C)
        elif kind == 'stump': m.put(x, y, 0x2C9 | C)
        elif kind == 'rock': m.put(x, y, 0x2CA | C)
        elif kind == 'stool': m.put(x, y, 0x2C2 | C)
        elif kind == 'plant': m.put(x, y, 0x2D0 | C)
        elif kind == 'mat':
            for i, v in enumerate((0x319, 0x31A, 0x31B)): m.put(x + i, y, v)
            for i, v in enumerate((0x329, 0x32A, 0x32B)): m.put(x + i, y + 1, v)
    for w in L['j']['warp_events']: m.warps.append({'x': w['x'], 'y': w['y'], 'to': door_out[0], 'w': door_out[1]})
    return m

MAPS = {}
# ---------------- Ashen Village ----------------
V = Map('AshenVillage', 36, 28, 'gTileset_General', 'gTileset_Fallarbor', mt(0x279))
V.cliff(0)                                   # the mountain to the north
V.forest(0, 6, 3, 27); V.forest(32, 6, 35, 10); V.forest(32, 17, 35, 27); V.forest(4, 24, 31, 27)
doors = {}
doors['home'] = V.hut(6, 8)
doors['elder'] = V.hut(15, 7)
doors['lodge'] = V.hut(25, 8)
doors['hut4'] = V.hut(6, 17)
doors['hut5'] = V.hut(13, 19)
V.pit(18, 13)                                # the village fire pit
V.plot(22, 17, 0); V.plot(27, 17, 1); V.plot(22, 21, 1); V.plot(27, 21, 0)
for (x, y) in [(11, 9), (21, 9), (30, 12), (11, 15), (5, 13), (20, 21)]: V.shrub(x, y)
for (x, y) in [(9, 13), (14, 12), (24, 13), (16, 16), (10, 22), (30, 15), (5, 22)]: V.put(x, y, mt(0x29F))
V.put(31, 13, mt(0x003, 1)); V.signs.append({'x': 31, 'y': 13, 'text': 'ASHEN VILLAGE\nThe fire keeps the monsters away.'})
V.put(10, 21, mt(0x003, 1)); V.signs.append({'x': 10, 'y': 21, 'text': "HEALER'S HUT\nRest your monsters here.", 'ko': '치유사의 오두막\n몬스터들을 이곳에서 쉬게 하세요.'})
V.put(10, 12, mt(0x003, 1)); V.signs.append({'x': 10, 'y': 12, 'text': "{P}'s home"})
house_maps = {   # name, room shape, furniture
    'home':  ('AshenVillage_Home',  'SecretBase_Tree1',      [('table', 5, 2), ('stump', 4, 3), ('stump', 8, 3), ('mat', 6, 5), ('plant', 2, 2)]),
    'elder': ('AshenVillage_Elder', 'SecretBase_Shrub1',     [('mat', 4, 4), ('stump', 2, 4), ('stump', 8, 4), ('plant', 8, 2), ('plant', 1, 3), ('rock', 2, 2)]),
    'lodge': ('AshenVillage_Lodge', 'SecretBase_BrownCave1', [('table', 6, 1), ('stump', 5, 2), ('stump', 9, 2), ('rock', 1, 3), ('rock', 9, 5), ('mat', 2, 5)]),
    'hut4':  ('AshenVillage_Hut4',  'SecretBase_Shrub1',     [('table', 5, 2), ('stump', 4, 3), ('stool', 8, 3), ('mat', 2, 5), ('plant', 8, 5)]),
    'hut5':  ('AshenVillage_Hut5',  'SecretBase_Tree1',      [('table', 4, 2), ('stump', 3, 3), ('stump', 7, 3), ('mat', 6, 5)])}
for i, (k, (mn, src, furn)) in enumerate(house_maps.items()):
    V.warps.append({'x': doors[k][0], 'y': doors[k][1], 'to': 'S_' + mn, 'w': 0})
    im = interior(mn, src, ('S_AshenVillage', i), furn)
    n, d = save(im, {'type': 'MAP_TYPE_INDOOR', 'border': [0x210, 0x210, 0x210, 0x210], 'title': ''}); MAPS[n] = d
V.conns.append({'to': 'S_AshenFields', 'dir': 'right', 'off': -0})
n, d = save(V, {'title': 'Ashen Village', 'music': 'town'}); MAPS[n] = d

# ---------------- Ashen Fields (farm + wild grass + the clearing where the gods fight) ----------------
F = Map('AshenFields', 46, 28, 'gTileset_General', 'gTileset_Fallarbor', mt(0x279))
F.cliff(0, 0, 45)
F.forest(0, 24, 45, 27)
F.plot(2, 9, 0); F.plot(7, 9, 1); F.plot(2, 13, 1); F.plot(7, 13, 0); F.plot(2, 17, 0); F.plot(7, 17, 1)
# pale ash-grass meadow with tall grass (wild monsters)
F.rect(13, 6, 45, 23, mt(0x218))
for (x0, y0, x1, y1) in [(15, 8, 22, 12), (17, 16, 26, 21), (27, 7, 33, 11), (30, 15, 36, 19)]: F.rect(x0, y0, x1, y1, mt(0x20A))
F.forest(13, 6, 14, 23, ground='grass'); F.rect(13, 12, 14, 16, mt(0x218))   # tree line between farm and meadow, with a gap
F.forest(42, 6, 45, 23, ground='grass')        # the far east is thick forest
F.pit(37, 13)                                   # scorched ground: where the shockwave hits
for (x, y) in [(11, 7), (9, 21), (4, 22)]: F.put(x, y, mt(0x29F))
F.put(12, 12, mt(0x003, 1)); F.signs.append({'x': 12, 'y': 12, 'text': 'EAST FIELDS\nTall grass ahead. Monsters hide there.'})
F.conns.append({'to': 'S_AshenVillage', 'dir': 'left', 'off': 0})
n, d = save(F, {'title': 'Ashen Fields', 'type': 'MAP_TYPE_ROUTE', 'music': 'grass',
                # tutorial map: weak monsters + the common 3-stage birds. noBabies = your partner's kind never shows up here (later maps may have them)
                'wild': {'rate': 20, 'noBabies': True, 'mons': [['pidgey', 2, 4], ['starly', 2, 4], ['fletchling', 2, 4], ['bidoof', 2, 4], ['kricketot', 2, 3], ['wurmple', 2, 3], ['burmy', 2, 3], ['caterpie', 2, 3], ['weedle', 2, 3], ['sentret', 2, 4]]}})
MAPS[n] = d

W0 = json.load(open(os.path.join(OUT, 'world.json')))
spr = {k: W0['sprites'][k] for k in W0['sprites']}
json.dump({'maps': MAPS, 'sprites': spr, 'start': {'map': 'S_AshenVillage_Home', 'x': 3, 'y': 5}}, open(OUT + '/story.json', 'w'), separators=(',', ':'))
print('story maps:', ', '.join(f'{k} {v["w"]}x{v["h"]}' for k, v in MAPS.items()))
