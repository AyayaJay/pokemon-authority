#!/usr/bin/env python3
"""Convert pret/pokeemerald maps into game-ready layers + JSON.
Usage: build_world.py <pokeemerald checkout> <out dir>
Output: <out>/maps/<Map>_b.png (under sprites), <Map>_t.png (over sprites), <out>/obj/<GFX>.png, <out>/world.json
"""
import json, os, re, struct, sys, glob
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT + '/maps', exist_ok=True); os.makedirs(OUT + '/obj', exist_ok=True)
P = lambda *a: os.path.join(SRC, *a)

OUTDOOR = ['LittlerootTown', 'Route101', 'OldaleTown', 'Route103', 'Route102', 'PetalburgCity', 'Route104', 'PetalburgWoods']
SKIP = {'AlteringCave'}

layouts = {l['id']: l for l in json.load(open(P('data/layouts/layouts.json')))['layouts'] if 'id' in l}
map_by_id = {}
for d in os.listdir(P('data/maps')):
    try: j = json.load(open(P('data/maps', d, 'map.json'))); map_by_id[j['id']] = d
    except Exception: pass

# ---- which maps: outdoor list + interiors reachable by warps (2 hops) ----
names = set(OUTDOOR)
frontier = list(OUTDOOR)
for hop in range(2):
    nxt = []
    for n in frontier:
        j = json.load(open(P('data/maps', n, 'map.json')))
        for w in j.get('warp_events', []):
            d = map_by_id.get(w['dest_map'])
            if d and d not in names and d not in SKIP and (hop == 0 or n not in OUTDOOR): names.add(d); nxt.append(d)
    frontier = nxt
names = sorted(names)

# ---- tilesets ----
def snake(s): return re.sub(r'(?<!^)(?=[A-Z])', '_', s).lower()
def tsdir(name):
    base = name.replace('gTileset_', '')
    for kind in ('primary', 'secondary'):
        p = P('data/tilesets', kind, snake(base))
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
    mt = open(d + '/metatiles.bin', 'rb').read(); at = open(d + '/metatile_attributes.bin', 'rb').read()
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

# ---- text (scripts + data/text) ----
TEXT = {}
files = [P('data/maps', n, 'scripts.inc') for n in names] + glob.glob(P('data/text/*.inc')) + glob.glob(P('data/scripts/*.inc'))
for f in files:
    if not os.path.exists(f): continue
    cur = None
    for line in open(f, encoding='utf-8', errors='replace'):
        m = re.match(r'^(\w+)::?\s*$', line)
        if m: cur = m.group(1); continue
        m = re.match(r'\s*\.string\s+"(.*)"', line)
        if m and cur: TEXT[cur] = TEXT.get(cur, '') + m.group(1)
        elif line.strip() and not line.strip().startswith('@') and cur and cur in TEXT and not line.strip().startswith('.string'): cur = None
SCRIPTS = {}
for n in names:
    f = P('data/maps', n, 'scripts.inc')
    if not os.path.exists(f): continue
    cur = None
    for line in open(f, encoding='utf-8', errors='replace'):
        m = re.match(r'^(\w+)::?\s*$', line)
        if m: cur = m.group(1); SCRIPTS[cur] = []; continue
        if cur: SCRIPTS[cur].append(line.strip())
def clean(s):
    s = s.replace('{PLAYER}', '{P}').replace('{RIVAL}', 'MAY').replace('{STR_VAR_1}', '…').replace('{PKMN}', 'POKéMON')
    s = re.sub(r'\{[A-Z_0-9 ]+\}', '', s)
    s = s.replace('\\p', '\n\n').replace('\\n', '\n').replace('\\l', '\n').replace('$', '')
    return s.strip()
def script_text(label, depth=0):
    if not label or depth > 3: return None
    if label in TEXT: return clean(TEXT[label])
    for l in SCRIPTS.get(label, []):
        m = re.match(r'msgbox\s+(\w+)', l)
        if m and m.group(1) in TEXT: return clean(TEXT[m.group(1)])
    for l in SCRIPTS.get(label, []):
        m = re.match(r'(?:goto|call)(?:_if\w*)?\s+.*?(\w+)\s*$', l)
        if m and m.group(1) in SCRIPTS: t = script_text(m.group(1), depth + 1)
        else: continue
        if t: return t
    return None

# ---- object sprites ----
gfx_info = open(P('src/data/object_events/object_event_graphics_info.h')).read()
pic_tables = open(P('src/data/object_events/object_event_pic_tables.h')).read()
gfx_files = open(P('src/data/object_events/object_event_graphics.h')).read()
ptrs = open(P('src/data/object_events/object_event_graphics_info_pointers.h')).read()
movement_c = open(P('src/event_object_movement.c')).read()
pal_file = {}
for m in re.finditer(r'(gObjectEventPal_\w+)\[\]\s*=\s*INC\w+\("([^"]+)"', gfx_files + movement_c): pal_file[m.group(1)] = m.group(2).replace('.gbapal', '.pal')
pal_tag = {}
for m in re.finditer(r'\{\s*(gObjectEventPal_\w+)\s*,\s*(OBJ_EVENT_PAL_TAG_\w+)\s*\}', movement_c): pal_tag[m.group(2)] = m.group(1)
def gfx_sheet(gid):
    m = re.search(r'\[' + gid + r'\]\s*=\s*&(gObjectEventGraphicsInfo_\w+)', ptrs)
    if not m: return None
    info = m.group(1)
    blk = re.search(info + r'\s*=\s*\{(.*?)\};', gfx_info, re.S)
    if not blk: return None
    b = blk.group(1)
    tag = re.search(r'\.paletteTag\s*=\s*(\w+)', b).group(1)
    w = int(re.search(r'\.width\s*=\s*(\d+)', b).group(1)); h = int(re.search(r'\.height\s*=\s*(\d+)', b).group(1))
    table = re.search(r'\.images\s*=\s*(\w+)', b).group(1)
    tb = re.search(table + r'\[\]\s*=\s*\{(.*?)\};', pic_tables, re.S)
    pic = re.search(r'(gObjectEventPic_\w+)', tb.group(1)).group(1)
    pm = re.search(pic + r'\[\]\s*=\s*INC\w+\("([^"]+)"', gfx_files)
    path = P(pm.group(1).replace('.4bpp', '.png'))
    if not os.path.exists(path): return None
    im = Image.open(path)
    pf = pal_file.get(pal_tag.get(tag, ''), '')
    rgba = im.convert('RGBA')
    if im.mode == 'P' and pf and os.path.exists(P(pf)):
        pal = jasc(P(pf)); idx = list(im.getdata()); px = []
        for v in idx: px.append((0, 0, 0, 0) if v % 16 == 0 else pal[v % 16] + (255,))
        rgba = Image.new('RGBA', im.size); rgba.putdata(px)
    elif im.mode == 'P':
        idx = list(im.getdata()); src = list(rgba.getdata()); rgba.putdata([(0, 0, 0, 0) if v == 0 else s for v, s in zip(idx, src)])
    name = gid.replace('OBJ_EVENT_GFX_', '').lower()
    rgba.save(f'{OUT}/obj/{name}.png')
    return {'img': name, 'w': w, 'h': h, 'n': rgba.width // w}

SPR = {}
def sprite(gid):
    if gid not in SPR:
        try: SPR[gid] = gfx_sheet(gid)
        except Exception as e: print('sprite fail', gid, e); SPR[gid] = None
    return SPR[gid]
for g in ['OBJ_EVENT_GFX_BRENDAN_NORMAL', 'OBJ_EVENT_GFX_BRENDAN_RUNNING', 'OBJ_EVENT_GFX_MAY_NORMAL', 'OBJ_EVENT_GFX_MAY_RUNNING']: sprite(g)

# ---- wild encounters ----
wild = {}
we = json.load(open(P('src/data/wild_encounters.json')))
for grp in we['wild_encounter_groups']:
    for e in grp.get('encounters', []):
        mid = e.get('map'); d = map_by_id.get(mid)
        if d in names and 'land_mons' in e and d not in wild:
            wild[d] = {'rate': e['land_mons']['encounter_rate'], 'mons': [[x['species'].replace('SPECIES_', '').lower().replace('_', ''), x['min_level'], x['max_level']] for x in e['land_mons']['mons']]}
        if d in names and 'water_mons' in e: wild.setdefault(d + '#water', {'rate': e['water_mons']['encounter_rate'], 'mons': [[x['species'].replace('SPECIES_', '').lower().replace('_', ''), x['min_level'], x['max_level']] for x in e['water_mons']['mons']]})

# ---- maps ----
WORLD = {'maps': {}, 'sprites': {}, 'start': {'map': 'LittlerootTown', 'x': 5, 'y': 9}}
for n in names:
    j = json.load(open(P('data/maps', n, 'map.json'))); L = layouts[j['layout']]
    W, H = L['width'], L['height']
    prim, sec = tileset(L['primary_tileset']), tileset(L['secondary_tileset'])
    blocks = struct.unpack('<%dH' % (W * H), open(P(L['blockdata_filepath']), 'rb').read()[:W * H * 2])
    bimg = Image.new('RGBA', (W * 16, H * 16)); timg = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 0))
    coll, behs = [], []
    for i, v in enumerate(blocks):
        mid, c = v & 0x3FF, (v >> 10) & 3
        b, t, beh = metatile(prim, sec, mid)
        x, y = (i % W) * 16, (i // W) * 16
        bimg.paste(b, (x, y)); timg.alpha_composite(t, (x, y))
        coll.append(c); behs.append(beh)
    bimg.save(f'{OUT}/maps/{n}_b.png', optimize=True)
    # battle floor: the most common walkable plain tile (no grass / water / doors)
    from collections import Counter
    cnt = Counter(v & 0x3FF for i, v in enumerate(blocks) if coll[i] == 0 and not any(k in beh_names.get(behs[i], '') for k in ('GRASS', 'WATER', 'DOOR', 'WARP', 'JUMP', 'COUNTER')))
    if cnt:
        fb, ft, _ = metatile(prim, sec, cnt.most_common(1)[0][0]); fl = fb.copy(); fl.alpha_composite(ft); fl.save(f'{OUT}/maps/{n}_floor.png')
    # border block (what the game shows past the map edge)
    bd = struct.unpack('<4H', open(P(L['border_filepath']), 'rb').read()[:8])
    border = Image.new('RGBA', (32, 32))
    for k, v in enumerate(bd):
        b2, t2, _ = metatile(prim, sec, v & 0x3FF); border.paste(b2, ((k % 2) * 16, (k // 2) * 16)); border.alpha_composite(t2, ((k % 2) * 16, (k // 2) * 16))
    border.save(f'{OUT}/maps/{n}_border.png')
    has_top = timg.getbbox() is not None
    if has_top: timg.save(f'{OUT}/maps/{n}_t.png', optimize=True)
    # behavior codes we use: grass, water, doors, ledges, counters
    used = {}
    for code in set(behs):
        nm = beh_names.get(code, '')
        if any(k in nm for k in ('TALL_GRASS', 'LONG_GRASS', 'WATER', 'DOOR', 'JUMP_', 'COUNTER', 'WARP', 'LADDER', 'STAIRS', 'PC', 'TELEVISION', 'BOOKSHELF', 'SAND', 'PUDDLE', 'POND', 'OCEAN', 'WATERFALL', 'ARROW', 'CAVE')): used[code] = nm
    npcs = []
    for o in j.get('object_events', []):
        if o.get('type') == 'clone' or 'graphics_id' not in o: continue
        if str(o.get('flag', '0')) not in ('0', ''): continue   # hidden by story flags (intro trucks, cutscene characters)
        g = o['graphics_id']; s = sprite(g)
        if not s: continue
        WORLD['sprites'][s['img']] = s
        npcs.append({'s': s['img'], 'x': int(o['x']), 'y': int(o['y']), 'mv': o.get('movement_type', '').replace('MOVEMENT_TYPE_', ''), 'rx': int(o.get('movement_range_x', 0) or 0), 'ry': int(o.get('movement_range_y', 0) or 0),
                     'tr': o.get('trainer_type', 'TRAINER_TYPE_NONE') != 'TRAINER_TYPE_NONE', 'text': script_text(o.get('script'))})
    warps = [{'x': w['x'], 'y': w['y'], 'to': map_by_id.get(w['dest_map']), 'w': int(w['dest_warp_id']) if str(w['dest_warp_id']).isdigit() else 0} for w in j.get('warp_events', [])]
    warps = [w for w in warps if w['to'] in names]
    signs = [{'x': s['x'], 'y': s['y'], 'text': script_text(s.get('script'))} for s in j.get('bg_events', []) if s.get('type') == 'sign']
    signs = [s for s in signs if s['text']]
    conns = [{'to': map_by_id.get(c['map']), 'dir': c['direction'], 'off': c['offset']} for c in (j.get('connections') or []) if map_by_id.get(c['map']) in names]
    WORLD['maps'][n] = {'w': W, 'h': H, 'top': has_top, 'coll': ''.join(str(c) for c in coll), 'beh': behs, 'behNames': used,
                        'npcs': npcs, 'warps': warps, 'signs': signs, 'conns': conns, 'type': j.get('map_type', ''), 'music': j.get('music', ''),
                        'title': j.get('name'), 'wild': wild.get(n), 'water': wild.get(n + '#water')}
    print(n, W, H, len(npcs), 'npcs', len(warps), 'warps')
# player sheets: 9 walking + 9 running frames side by side, with the player palette
for who in ('brendan', 'may'):
    pal = jasc(P(f'graphics/object_events/palettes/{who}.pal'))
    parts = []
    for f in ('walking', 'running'):
        im = Image.open(P(f'graphics/object_events/pics/people/{who}/{f}.png')); px = [(0, 0, 0, 0) if v % 16 == 0 else pal[v % 16] + (255,) for v in im.getdata()]
        r = Image.new('RGBA', im.size); r.putdata(px); parts.append(r)
    sheet = Image.new('RGBA', (parts[0].width + parts[1].width, 32), (0, 0, 0, 0)); sheet.paste(parts[0], (0, 0)); sheet.paste(parts[1], (parts[0].width, 0))
    sheet.save(f'{OUT}/obj/player_{who}.png'); WORLD['sprites']['player_' + who] = {'img': 'player_' + who, 'w': 16, 'h': 32, 'n': 18}
for k in []:
    s = [v for v in SPR.values() if v and v['img'] == k]
    if s: WORLD['sprites'][k] = s[0]
json.dump(WORLD, open(OUT + '/world.json', 'w'), separators=(',', ':'))
print('maps', len(names), 'sprites', len(WORLD['sprites']))
