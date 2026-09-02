#!/usr/bin/env python3
"""
Importerar kartor från pret/pokecrystal (Game Boy Color) till pokeemerald-expansion.

  python3 tools/crystal_import/import_crystal.py      # kör från repo-roten

Principer
- Ett Crystal-block (32x32 px, 4x4 tiles) blir 2x2 Emerald-metatiles (16x16 px).
- Crystals 8 GBC-paletter (4 färger) packas tre och tre i GBA-paletter (16 färger).
- Grafiken behålls pixel för pixel (GBC-utseende) och kan bytas per tileset senare.
- Kollision -> Emerald-beteende + kollisionsbit; höjd: mark 3, vatten 1, spärrat 0.
- Varpar, NPC:er, skyltar och triggers översätts; skript blir textstubbar (msgbox).
- Allt i befintliga Emerald-filer läggs i markerade block (CRYSTAL_IMPORT_BEGIN/END).
"""
import json, os, re, struct, sys
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(ROOT, '..', '..'))
CFG = json.load(open(os.path.join(ROOT, 'config.json'), encoding='utf-8'))
CR = os.path.join(REPO, CFG['crystal_dir'])
EM = os.path.join(REPO, CFG['game_dir'])
ALLOC_PATH = os.path.join(ROOT, 'allocations.json')
BEGIN, END = 'CRYSTAL_IMPORT_BEGIN', 'CRYSTAL_IMPORT_END'
LAYER_COVERED, LAYER_NORMAL = 1, 0

log_lines = []
def log(cat, msg): log_lines.append(f'[{cat}] {msg}')
def rd(p): return open(p, encoding='utf-8', errors='replace').read()
def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(s)
def load_json(p): return json.load(open(p, encoding='utf-8'))
def dump_json(p, d): wr(p, json.dumps(d, indent=2, ensure_ascii=False) + '\n')

MARK_RE = re.compile(r'(?://|@) ' + BEGIN + r'\n.*?(?://|@) ' + END + r'\n', re.S)
def rd_clean(p): return MARK_RE.sub('', rd(p))

def marked_block(path, content, comment='//', anchor=None, before=False):
    text = rd(path)
    block = f'{comment} {BEGIN}\n{content.rstrip()}\n{comment} {END}\n'
    pat = re.compile(re.escape(comment) + ' ' + BEGIN + r'\n.*?' + re.escape(comment) + ' ' + END + r'\n', re.S)
    if pat.search(text) and anchor:
        text = pat.sub('', text)
    if pat.search(text):
        text = pat.sub(lambda m: block, text)
    elif anchor:
        m = re.search(anchor, text, re.M)
        if not m: raise RuntimeError(f'anchor {anchor!r} saknas i {path}')
        if before: text = text[:m.start()] + block + '\n' + text[m.start():]
        else: text = text[:m.end()] + '\n' + block + text[m.end():]
    else:
        text = text.rstrip('\n') + '\n\n' + block
    wr(path, text)

# ------------------------------------------------------------------ Crystal-data
def parse_blocks():
    """data/maps/blocks.asm: en eller flera <Map>_Blocks:-etiketter följda av INCBIN \"maps/X.blk\"."""
    d = {}; pending = []
    for line in rd(f'{CR}/data/maps/blocks.asm').splitlines():
        m = re.match(r'^(\w+)_Blocks:', line)
        if m: pending.append(m.group(1)); continue
        m = re.search(r'INCBIN "([^"]+)"', line)
        if m:
            for lab in pending: d[lab] = m.group(1)
            pending = []
    return d

def parse_map_consts():
    d = {}
    for m in re.finditer(r'map_const (\w+),\s*(\d+),\s*(\d+)', rd(f'{CR}/constants/map_constants.asm')):
        d[m.group(1)] = (int(m.group(2)), int(m.group(3)))
    return d

def parse_maps_asm():
    d = {}
    for m in re.finditer(r'^\tmap (\w+), (TILESET_\w+), (\w+), (LANDMARK_\w+), (MUSIC_\w+)', rd(f'{CR}/data/maps/maps.asm'), re.M):
        d[m.group(1)] = dict(tileset=m.group(2), env=m.group(3), landmark=m.group(4), music=m.group(5))
    return d

def parse_attributes():
    d = {}; cur = None
    for line in rd(f'{CR}/data/maps/attributes.asm').splitlines():
        m = re.match(r'\s*map_attributes (\w+), (\w+), \$([0-9a-fA-F]+)', line)
        if m:
            cur = m.group(1); d[cur] = dict(const=m.group(2), border=int(m.group(3), 16), conns=[]); continue
        m = re.match(r'\s*connection (north|south|east|west), (\w+), (\w+), (-?\d+)', line)
        if m and cur:
            d[cur]['conns'].append((m.group(1), m.group(2), m.group(3), int(m.group(4))))
    return d

def parse_collision_consts():
    return {m.group(1): int(m.group(2), 16) for m in re.finditer(r'DEF COLL_(\w+)\s+EQU \$([0-9a-fA-F]+)', rd(f'{CR}/constants/collision_constants.asm'))}

def parse_scene_consts():
    """Scen-ID:n definieras av scene_script-ordningen i varje kartfil (0, 1, 2 ...)."""
    d = {}
    for fn in os.listdir(f'{CR}/maps'):
        if not fn.endswith('.asm'): continue
        for i, m in enumerate(re.finditer(r'^\tscene_script \w+, (SCENE_\w+)', rd(f'{CR}/maps/{fn}'), re.M)):
            d.setdefault(m.group(1), i)
    return d

def parse_landmarks():
    text = rd(f'{CR}/data/maps/landmarks.asm')
    order = re.findall(r'^\tlandmark\s+-?\d+,\s*-?\d+,\s*(\w+)$', text, re.M)
    consts = re.findall(r'const (LANDMARK_\w+)', rd(f'{CR}/constants/landmark_constants.asm'))
    names = {m.group(1): m.group(2) for m in re.finditer(r'^(\w+):\s*db "([^"]*)@"', text, re.M)}
    d = {}
    for c, lab in zip(consts, order):
        d[c] = names.get(lab, c).replace('<BSP>', ' ').replace('¯', ' ')
    return d

def parse_day_palettes():
    text = rd(f'{CR}/gfx/tilesets/bg_tiles.pal')
    sec = text.split('; day')[1].split('; nite')[0]
    pals = []
    for m in re.finditer(r'RGB ((?:\d+,\s*)+\d+)', sec):
        vals = [int(v) for v in re.split(r',\s*', m.group(1))]
        pals.append([tuple(vals[i:i+3]) for i in range(0, 12, 3)])
    assert len(pals) == 8, len(pals)
    return pals

DAY_PALS = parse_day_palettes()
PAL_NAMES = ['GRAY', 'RED', 'GREEN', 'WATER', 'YELLOW', 'BROWN', 'ROOF', 'TEXT']

def parse_palette_map(name):
    """Returnerar lista (palett-index, priority) per gfx-tile (0..191)."""
    out = []
    for line in rd(f'{CR}/gfx/tilesets/{name}_palette_map.asm').splitlines():
        m = re.match(r'\s*tilepal\s+\d+,\s*(.*)', line)
        if not m: continue
        for tok in [t.strip() for t in m.group(1).split(',')]:
            pri = tok.startswith('PRIORITY_')
            tok = tok.replace('PRIORITY_', '')
            out.append((PAL_NAMES.index(tok), pri))
    return out

def parse_collision(name, coll_consts):
    blocks = []
    for line in rd(f'{CR}/data/tilesets/{name}_collision.asm').splitlines():
        m = re.match(r'\s*tilecoll\s+(\w+),\s*(\w+),\s*(\w+),\s*(\w+)', line)
        if m:
            q = []
            for tok in m.groups():
                if tok in coll_consts: q.append(tok)
                elif re.fullmatch(r'[0-9a-fA-F]{2}', tok):
                    v = int(tok, 16); q.append(next((k for k, vv in coll_consts.items() if vv == v), tok))
                else: q.append(tok)
            blocks.append(q)
    return blocks

def tileset_files(tileset_const):
    n = tileset_const[len('TILESET_'):].lower()
    return n

def gfx_tile_index(tile_id):
    """Crystal tile-ID ($00-$5F, $80-$DF) -> index i tileset-PNG:n."""
    return tile_id if tile_id < 0x60 else tile_id - 0x20

# ------------------------------------------------------------------ tilesets
def build_tileset(tname, coll_consts):
    """Skapar Emerald-primär (+ sekundär) för ett Crystal-tileset. Returnerar (prim_sym, sec_sym, ncoll)."""
    png = Image.open(f'{CR}/gfx/tilesets/{tname}.png').convert('L')
    w, h = png.size
    ntiles = (w // 8) * (h // 8)
    shades = sorted(set(png.getdata()), reverse=True)  # ljusast först = färgindex 0
    shade_idx = {v: i for i, v in enumerate(shades)}
    palmap = parse_palette_map(tname)
    meta = open(f'{CR}/data/tilesets/{tname}_metatiles.bin', 'rb').read()
    nblocks = len(meta) // 16
    coll = parse_collision(tname, coll_consts)
    # --- tiles.png: varje tile ritas med index 1 + 4*(pal%3) + shade; tile ntiles = tom
    out = Image.new('P', (128, ((ntiles + 1 + 15) // 16) * 8), 0)
    pal16 = [(0, 0, 0)] * 16
    for k in range(3):  # PNG-palett = GBA-palett 0 (för förhandsvisning)
        for s in range(4):
            c = DAY_PALS[k][s]; pal16[1 + 4 * k + s] = tuple(v * 8 for v in c)
    flat = []
    for c in pal16: flat += list(c)
    out.putpalette(flat)
    px = png.load(); op = out.load()
    for t in range(ntiles):
        p, _ = palmap[t] if t < len(palmap) else (0, False)
        base = 1 + 4 * (p % 3)
        sx, sy = (t % 16) * 8, (t // 16) * 8
        for y in range(8):
            for x in range(8):
                op[sx + x, sy + y] = base + shade_idx[px[sx + x, sy + y]]
    blank = ntiles
    sym = 'Crystal' + ''.join(w_.capitalize() for w_ in tname.split('_'))
    prim_rel = f'data/tilesets/primary/crystal_{tname}'
    prim = f'{EM}/{prim_rel}'
    os.makedirs(f'{prim}/palettes', exist_ok=True)
    out.save(f'{prim}/tiles.png', bits=4)
    # --- paletter: 00-02 = Crystal-paletter (3 per GBA-palett), övriga svarta
    for i in range(16):
        cols = [(0, 0, 0)] * 16
        if i < 3:
            for k in range(3):
                cp = 3 * i + k
                if cp < 8:
                    for s in range(4): cols[1 + 4 * k + s] = tuple(v * 8 for v in DAY_PALS[cp][s])
        with open(f'{prim}/palettes/{i:02d}.pal', 'w') as f:
            f.write('JASC-PAL\r\n0100\r\n16\r\n' + ''.join(f'{r} {g} {b}\r\n' for r, g, b in cols))
    # --- metatiles + attribut
    mt = bytearray(); at = bytearray()
    for b in range(nblocks):
        tiles = meta[b * 16:(b + 1) * 16]
        for q in range(4):
            qy, qx = q // 2, q % 2
            bottom, top, has_pri = [], [], False
            for dy in range(2):
                for dx in range(2):
                    tid = tiles[(qy * 2 + dy) * 4 + qx * 2 + dx]
                    gi = gfx_tile_index(tid)
                    if gi >= ntiles or (0x60 <= tid < 0x80):
                        gi, p, pri = blank, 0, False
                    else:
                        p, pri = palmap[gi] if gi < len(palmap) else (0, False)
                    entry = gi | ((p // 3) << 12)
                    if pri:
                        has_pri = True; top.append(entry); bottom.append(blank)
                    else:
                        bottom.append(entry); top.append(blank)
            for e in bottom + top: mt += struct.pack('<H', e)
            cname = coll[b][q] if b < len(coll) else 'FLOOR'
            beh, _ = CFG['collision_map'].get(cname, ['MB_NORMAL', 1 if cname not in ('FLOOR',) else 0])
            if cname not in CFG['collision_map'] and cname != 'FLOOR':
                log('collision', f'{tname}: okänd kollision {cname} -> spärrad')
            layer = LAYER_NORMAL if has_pri else LAYER_COVERED
            at += struct.pack('<H', EM_MB[beh] | (layer << 12))
    n_meta = nblocks * 4
    prim_meta, prim_attr = mt[:512 * 16], at[:512 * 2]
    open(f'{prim}/metatiles.bin', 'wb').write(prim_meta)
    open(f'{prim}/metatile_attributes.bin', 'wb').write(prim_attr)
    # --- sekundär: block 128..255 om de finns, annars gemensam tom
    if n_meta > 512:
        sec_rel = f'data/tilesets/secondary/crystal_{tname}_2'
        sec = f'{EM}/{sec_rel}'; os.makedirs(f'{sec}/palettes', exist_ok=True)
        Image.new('P', (128, 8), 0).save(f'{sec}/tiles.png', bits=4)
        for i in range(16):
            with open(f'{sec}/palettes/{i:02d}.pal', 'w') as f:
                f.write('JASC-PAL\r\n0100\r\n16\r\n' + '0 0 0\r\n' * 16)
        open(f'{sec}/metatiles.bin', 'wb').write(mt[512 * 16:])
        open(f'{sec}/metatile_attributes.bin', 'wb').write(at[512 * 2:])
        sec_sym = sym + '2'
        TILESETS.append((sec_sym, sec_rel, 1, True))
    else:
        sec_sym = ensure_empty_secondary()
    TILESETS.append((sym, prim_rel, ntiles + 1, False))
    return f'gTileset_{sym}', f'gTileset_{sec_sym}', coll

_empty_done = [False]
def ensure_empty_secondary():
    if not _empty_done[0]:
        rel = 'data/tilesets/secondary/crystal_empty'; d = f'{EM}/{rel}'
        os.makedirs(f'{d}/palettes', exist_ok=True)
        Image.new('P', (128, 8), 0).save(f'{d}/tiles.png', bits=4)
        for i in range(16):
            with open(f'{d}/palettes/{i:02d}.pal', 'w') as f:
                f.write('JASC-PAL\r\n0100\r\n16\r\n' + '0 0 0\r\n' * 16)
        open(f'{d}/metatiles.bin', 'wb').write(bytes(512 * 16))
        open(f'{d}/metatile_attributes.bin', 'wb').write(bytes(512 * 2))
        TILESETS.append(('CrystalEmpty', rel, 1, True))
        _empty_done[0] = True
    return 'CrystalEmpty'

TILESETS = []  # (sym, rel, ntiles, secondary)

def write_tileset_headers():
    g = ['// Genererad av tools/crystal_import – tilesets från pokecrystal\n']
    m = [g[0]]; hh = [g[0]]
    for sym, rel, ntiles, sec in TILESETS:
        g.append(f'const u32 gTilesetTiles_{sym}[] = INCGFX_U32("{rel}/tiles.png", ".4bpp.fastSmol", "-num_tiles {ntiles} -Wnum_tiles");\n')
        g.append(f'const u16 gTilesetPalettes_{sym}[][16] =\n{{\n' + ''.join(f'\tINCGFX_U16("{rel}/palettes/{i:02d}.pal", ".gbapal"),\n' for i in range(16)) + '};\n\n')
        m.append(f'const u16 gMetatiles_{sym}[] = INCBIN_U16("{rel}/metatiles.bin");\nconst u16 gMetatileAttributes_{sym}[] = INCBIN_U16("{rel}/metatile_attributes.bin");\n\n')
        hh.append(f'const struct Tileset gTileset_{sym} =\n{{\n    .isCompressed = TRUE,\n    .isSecondary = {"TRUE" if sec else "FALSE"},\n'
                  f'    .tiles = gTilesetTiles_{sym},\n    .palettes = gTilesetPalettes_{sym},\n    .metatiles = gMetatiles_{sym},\n'
                  f'    .metatileAttributes = gMetatileAttributes_{sym},\n    .callback = NULL,\n}};\n\n')
    wr(f'{EM}/src/data/tilesets/crystal_graphics.h', ''.join(g))
    wr(f'{EM}/src/data/tilesets/crystal_metatiles.h', ''.join(m))
    wr(f'{EM}/src/data/tilesets/crystal_headers.h', ''.join(hh))
    marked_block(f'{EM}/src/tilesets.c', '#include "data/tilesets/crystal_graphics.h"\n#include "data/tilesets/crystal_metatiles.h"\n#include "data/tilesets/crystal_headers.h"')

# ------------------------------------------------------------------ Emerald-konstanter
def parse_enum_or_defines(path, prefix):
    t = rd_clean(path)
    return set(re.findall(r'#define (' + prefix + r'\w*)', t)) | set(re.findall(r'^\s*(' + prefix + r'\w*)\s*(?:=[^,]*)?,', t, re.M))

def parse_mb():
    vals = {}; v = -1
    for line in rd(f'{EM}/include/constants/metatile_behaviors.h').splitlines():
        m = re.match(r'\s*(MB_\w+)\s*(?:=\s*(0x[0-9A-Fa-f]+|\d+))?\s*,', line)
        if m:
            v = int(m.group(2), 0) if m.group(2) else v + 1; vals[m.group(1)] = v
    return vals

EM_MB = parse_mb()
EM_GFX = parse_enum_or_defines(f'{EM}/include/constants/event_objects.h', 'OBJ_EVENT_GFX_')
EM_MOV = parse_enum_or_defines(f'{EM}/include/constants/event_object_movement.h', 'MOVEMENT_TYPE_')
EM_SONGS = parse_enum_or_defines(f'{EM}/include/constants/songs.h', 'MUS_')
EM_SPECIES = parse_enum_or_defines(f'{EM}/include/constants/species.h', 'SPECIES_')
EM_MAP_IDS = set()
for name in os.listdir(f'{EM}/data/maps'):
    p = f'{EM}/data/maps/{name}/map.json'
    if os.path.exists(p): EM_MAP_IDS.add((load_json(p)['id'], name))

alloc = load_json(ALLOC_PATH) if os.path.exists(ALLOC_PATH) else {'flags': {}, 'vars': {}, 'maps': []}
FLAG_POOL = re.findall(r'#define (FLAG_UNUSED_0x[0-9A-Fa-f]+)', rd_clean(f'{EM}/include/constants/flags.h'))
VAR_POOL = re.findall(r'#define (VAR_UNUSED_0x[0-9A-Fa-f]+)', rd_clean(f'{EM}/include/constants/vars.h'))
# story-generatorn använder samma pool – undvik dubbelbokning
story_alloc = os.path.join(REPO, 'tools', 'story', 'flag_allocations.json')
RESERVED = set(load_json(story_alloc).values()) if os.path.exists(story_alloc) else set()

def allocate(kind, name):
    table = alloc[kind]
    if name in table: return table[name]
    pool = FLAG_POOL if kind == 'flags' else VAR_POOL
    used = set(table.values()) | RESERVED
    cand = next((c for c in pool if c not in used), None)
    if cand is None: raise RuntimeError(f'slut på lediga {kind}')
    table[name] = cand
    return cand

# ------------------------------------------------------------------ text
def convert_text_block(lines):
    """Crystal text-makron -> Emerald .string-rader."""
    out = []; cur = ''
    def flush(sep):
        nonlocal cur
        if cur is not None:
            out.append(cur + sep); cur = None
    parts = []
    for line in lines:
        m = re.match(r'\s*(text|line|para|cont|next|done|prompt|text_start|text_end|text_ram|text_decimal|text_low|text_promptbutton|text_waitbutton)\b\s*(?:"(.*)")?', line)
        if not m: continue
        cmd, s = m.group(1), m.group(2)
        if cmd in ('text', 'text_start'): parts.append(('text', s or ''))
        elif cmd == 'line': parts.append(('\\n', s or ''))
        elif cmd == 'para': parts.append(('\\p', s or ''))
        elif cmd in ('cont', 'next'): parts.append(('\\l', s or ''))
        elif cmd in ('done', 'prompt', 'text_end', 'text_waitbutton', 'text_promptbutton'): break
    res = ''
    for i, (sep, s) in enumerate(parts):
        s = fix_chars(s)
        if i == 0: res = s
        else: res += sep + s
    if not res: res = '…'
    return '\t.string "' + res + '$"'

CHAR_MAP = [('<PK><MN>', 'POKéMON'), ('<PO><KE>', 'POKé'), ('<PLAY_G>', '{PLAYER}'), ('<PLAYER>', '{PLAYER}'), ('<RIVAL>', '{RIVAL}'),
            ('<TRNER>', 'TRAINER'), ('<ROCKET>', 'ROCKET'), ('<……>', '…'), ('<BSP>', ' '), ('¯', ' '), ('<TM>', 'TM'), ('<LNBRK>', '\\n'),
            ('#', 'POKé'), ('<PK>', 'PK'), ('<MN>', 'MN'), ('<TARGET>', '{STR_VAR_1}'), ('<USER>', '{STR_VAR_2}'), ('<ENEMY>', 'Wild')]
def fix_chars(s):
    for a, b in CHAR_MAP: s = s.replace(a, b)
    s = re.sub(r'<[A-Z_0-9]+>', '', s)
    return s.replace('"', "'")

# ------------------------------------------------------------------ kartor
def parse_map_events(text):
    ev = dict(warps=[], coords=[], bgs=[], objs=[])
    for m in re.finditer(r'^\twarp_event\s+(\d+),\s*(\d+),\s*(\w+),\s*(\d+)', text, re.M):
        ev['warps'].append((int(m.group(1)), int(m.group(2)), m.group(3), int(m.group(4))))
    for m in re.finditer(r'^\tcoord_event\s+(\d+),\s*(\d+),\s*(\w+),\s*(\w+)', text, re.M):
        ev['coords'].append((int(m.group(1)), int(m.group(2)), m.group(3), m.group(4)))
    for m in re.finditer(r'^\tbg_event\s+(\d+),\s*(\d+),\s*(\w+),\s*(\w+)', text, re.M):
        ev['bgs'].append((int(m.group(1)), int(m.group(2)), m.group(3), m.group(4)))
    for m in re.finditer(r'^\tobject_event\s+(\d+),\s*(\d+),\s*(SPRITE_\w+),\s*(SPRITEMOVEDATA_\w+),\s*(\d+),\s*(\d+),\s*(-?\w+),\s*(-?\w+),\s*(-?\w+),\s*(OBJECTTYPE_\w+),\s*(\d+),\s*(\w+),\s*(-?\w+)', text, re.M):
        g = m.groups()
        ev['objs'].append(dict(x=int(g[0]), y=int(g[1]), sprite=g[2], move=g[3], rx=int(g[4]), ry=int(g[5]), h1=g[6], h2=g[7],
                               objtype=g[9], sight=int(g[10]), script=g[11], flag=g[12]))
    return ev

def script_body(text, label):
    m = re.search(r'^' + re.escape(label) + r':\n(.*?)(?=^\S|\Z)', text, re.M | re.S)
    return m.group(1) if m else ''

def text_block(text, label):
    m = re.search(r'^' + re.escape(label) + r':\n((?:\t.*\n)+)', text, re.M)
    return m.group(1).splitlines() if m else None

def convert_npc_script(text, label, mapname, kind, texts_needed):
    """Returnerar Emerald-skriptrader för en NPC/skylt. kind: 'npc'|'sign'."""
    body = script_body(text, label)
    if 'jumpstd PokecenterNurseScript' in body or 'jumpstd pokecenternurse' in body.lower():
        return ['\tsetvar VAR_0x800B, 0', '\tcall Common_EventScript_PkmnCenterNurse', '\twaitmessage', '\twaitbuttonpress', '\trelease', '\tend'], None
    tlabel = None
    m = re.search(r'jumptextfaceplayer (\w+)', body) or re.search(r'jumptext (\w+)', body) or re.search(r'writetext (\w+)', body)
    if m: tlabel = m.group(1)
    if not tlabel or text_block(text, tlabel) is None:
        log('script', f'{mapname}: {label} saknar text – stub')
        return [f'\tmsgbox {mapname}_Text_CrystalTodo, {"MSGBOX_SIGN" if kind == "sign" else "MSGBOX_NPC"}', '\tend'], None
    texts_needed.add(tlabel)
    return [f'\tmsgbox {mapname}_Text_{tlabel}, {"MSGBOX_SIGN" if kind == "sign" else "MSGBOX_NPC"}', '\tend'], tlabel

def import_maps(map_consts, maps_asm, attrs, coll_consts, scene_consts, landmarks):
    names = CFG['maps']
    label_to_const = {k: v['const'] for k, v in attrs.items()}
    const_to_label = {v['const']: k for k, v in attrs.items()}
    imported_consts = {label_to_const[n] for n in names}
    tileset_syms = {}
    layouts_json = load_json(f'{EM}/data/layouts/layouts.json')
    existing_layouts = {l['id']: i for i, l in enumerate(layouts_json['layouts']) if l}
    groups = load_json(f'{EM}/data/maps/map_groups.json')
    gname = CFG['map_group_name']
    for old in alloc.get('maps', []):
        pass
    groups[gname] = []
    if gname not in groups['group_order']: groups['group_order'].append(gname)
    mapsecs = load_json(f'{EM}/src/data/region_map/region_map_sections.json')
    mapsec_ids = {e['id'] for e in mapsecs['map_sections']}
    includes = []
    for name in names:
        info = maps_asm[name]; a = attrs[name]; const = a['const']
        W, H = map_consts[const]
        mapid = f'MAP_{const}'
        for mid, mname in EM_MAP_IDS:
            if mid == mapid and mname != name: raise RuntimeError(f'{mapid} finns redan i Emerald ({mname})')
        # tileset
        tn = tileset_files(info['tileset'])
        if tn not in tileset_syms:
            tileset_syms[tn] = build_tileset(tn, coll_consts)
        prim, sec, coll = tileset_syms[tn]
        # layout
        blk = open(f'{CR}/{BLOCKS.get(name, f"maps/{name}.blk")}', 'rb').read()
        assert len(blk) == W * H, (name, len(blk), W, H)
        w2, h2 = W * 2, H * 2
        mapbin = bytearray()
        def quad(bx, by, q):
            b = blk[by * W + bx]
            cname = coll[b][q] if b < len(coll) else 'FLOOR'
            beh, imp = CFG['collision_map'].get(cname, ['MB_NORMAL', 1])
            return b * 4 + q, imp, cname
        grid = [[quad(x // 2, y // 2, (y % 2) * 2 + (x % 2)) for x in range(w2)] for y in range(h2)]
        water = set(CFG['water_collisions'])
        for y in range(h2):
            for x in range(w2):
                mid, imp, cname = grid[y][x]
                if imp: elev = 0
                elif cname in water: elev = 1
                else:
                    elev = 3
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w2 and 0 <= ny < h2 and grid[ny][nx][2] in water and not grid[ny][nx][1]:
                            elev = 0
                mapbin += struct.pack('<H', mid | (imp << 10) | (elev << 12))
        border = bytearray()
        for q in range(4): border += struct.pack('<H', a['border'] * 4 + q)
        ldir = f'{EM}/data/layouts/{name}'; os.makedirs(ldir, exist_ok=True)
        open(f'{ldir}/map.bin', 'wb').write(mapbin); open(f'{ldir}/border.bin', 'wb').write(border)
        lid = f'LAYOUT_{const}'
        entry = dict(id=lid, name=f'{name}_Layout', width=w2, height=h2, primary_tileset=prim, secondary_tileset=sec,
                     border_filepath=f'data/layouts/{name}/border.bin', blockdata_filepath=f'data/layouts/{name}/map.bin', layout_version='emerald')
        if lid in existing_layouts: layouts_json['layouts'][existing_layouts[lid]] = entry
        else: layouts_json['layouts'].append(entry); existing_layouts[lid] = len(layouts_json['layouts']) - 1
        # mapsec
        lm = info['landmark']; msec = 'MAPSEC_' + lm[len('LANDMARK_'):]
        if msec not in mapsec_ids:
            mapsecs['map_sections'].append(dict(id=msec, name=landmarks.get(lm, lm)[:20].upper(), x=0, y=0, width=1, height=1))
            mapsec_ids.add(msec)
        # events
        text = rd(f'{CR}/maps/{name}.asm')
        ev = parse_map_events(text)
        outdoor = info['env'] in ('TOWN', 'ROUTE')
        mtype = {'TOWN': 'MAP_TYPE_TOWN', 'ROUTE': 'MAP_TYPE_ROUTE', 'INDOOR': 'MAP_TYPE_INDOOR', 'GATE': 'MAP_TYPE_INDOOR',
                 'CAVE': 'MAP_TYPE_UNDERGROUND', 'DUNGEON': 'MAP_TYPE_UNDERGROUND'}.get(info['env'], 'MAP_TYPE_INDOOR')
        music = CFG['music_map'].get(info['music'], CFG['music_default'])
        if music not in EM_SONGS: log('music', f'{name}: {music} saknas'); music = CFG['music_default']
        conns = []
        for d, lab, c, off in a['conns']:
            if c in imported_consts: conns.append(dict(map=f'MAP_{c}', offset=off * 2, direction={'north': 'up', 'south': 'down', 'east': 'right', 'west': 'left'}[d]))
            else: log('map', f'{name}: anslutning till {c} hoppas över (ej importerad)')
        scr = [f'{name}_MapScripts::', '\t.byte 0', '']
        texts_needed = set()
        objs = []
        for i, o in enumerate(ev['objs']):
            if o['h1'] != '-1' or o['h2'] not in ('-1', 'DAY'):
                log('map', f"{name}: tidsbegränsat objekt {o['sprite']} ({o['h1']},{o['h2']}) hoppas över"); continue
            gfx = CFG['sprite_map'].get(o['sprite'], CFG['sprite_default'])
            if gfx not in EM_GFX: log('sprite', f'{gfx} saknas i Emerald'); gfx = CFG['sprite_default']
            if o['sprite'] not in CFG['sprite_map']: log('sprite', f"{name}: {o['sprite']} saknar mappning -> {gfx}")
            mov = CFG['movement_map'].get(o['move'], 'MOVEMENT_TYPE_FACE_DOWN')
            if mov not in EM_MOV: mov = 'MOVEMENT_TYPE_FACE_DOWN'
            flag = '0' if o['flag'] == '-1' else o['flag']
            if flag != '0': allocate('flags', flag)
            slabel = f'{name}_EventScript_{o["script"]}'
            if slabel + '::' in '\n'.join(scr):
                pass  # flera objekt delar skript
            elif o['objtype'] == 'OBJECTTYPE_ITEMBALL':
                body = script_body(text, o['script'])
                m = re.search(r'itemball (\w+)', body)
                item = 'ITEM_' + (m.group(1) if m else 'POTION')
                scr += [f'{slabel}::', f'\tfinditem {item}', '\tend', '']
            else:
                lines, _ = convert_npc_script(text, o['script'], name, 'npc', texts_needed)
                if o['objtype'] == 'OBJECTTYPE_TRAINER': log('trainer', f"{name}: tränare {o['script']} blir vanlig NPC")
                scr += [f'{slabel}::'] + lines + ['']
            objs.append(dict(graphics_id=gfx, x=o['x'], y=o['y'], elevation=3, movement_type=mov, movement_range_x=o['rx'], movement_range_y=o['ry'],
                             trainer_type='TRAINER_TYPE_NONE', trainer_sight_or_berry_tree_id='0', script=slabel, flag=flag))
        warps = []
        for (x, y, dest, wid) in ev['warps']:
            if dest not in imported_consts:
                log('map', f'{name}: varp till {dest} hoppas över (ej importerad)'); continue
            warps.append(dict(x=x, y=y, elevation=0, dest_map=f'MAP_{dest}', dest_warp_id=str(wid - 1)))
        coords = []
        if ev['coords']:
            var = allocate('vars', f'VAR_SCENE_{const}')
            for (x, y, scene, sl) in ev['coords']:
                val = scene_consts.get(scene, 0)
                slabel = f'{name}_EventScript_{sl}'
                body = script_body(text, sl)
                m = re.search(r'writetext (\w+)', body)
                lines = ['\tlockall']
                if m and text_block(text, m.group(1)) is not None:
                    texts_needed.add(m.group(1)); lines.append(f'\tmsgbox {name}_Text_{m.group(1)}')
                lines += [f'\tsetvar VAR_SCENE_{const}, {val + 1}', '\treleaseall', '\tend']
                if slabel + '::' not in '\n'.join(scr): scr += [slabel + '::'] + lines + ['']
                coords.append(dict(type='trigger', x=x, y=y, elevation=3, var=f'VAR_SCENE_{const}', var_value=str(val), script=slabel))
        bgs = []
        for (x, y, kind, sl) in ev['bgs']:
            if kind == 'BGEVENT_ITEM':
                body = script_body(text, sl); m = re.search(r'hiddenitem (\w+), (\w+)', body)
                if m:
                    bgs.append(dict(type='hidden_item', x=x, y=y, elevation=0, item='ITEM_' + m.group(1), flag=allocate('flags', m.group(2))))
                continue
            facing = {'BGEVENT_READ': 'BG_EVENT_PLAYER_FACING_ANY', 'BGEVENT_UP': 'BG_EVENT_PLAYER_FACING_NORTH', 'BGEVENT_DOWN': 'BG_EVENT_PLAYER_FACING_SOUTH',
                      'BGEVENT_LEFT': 'BG_EVENT_PLAYER_FACING_WEST', 'BGEVENT_RIGHT': 'BG_EVENT_PLAYER_FACING_EAST'}.get(kind, 'BG_EVENT_PLAYER_FACING_ANY')
            slabel = f'{name}_EventScript_{sl}'
            if slabel + '::' not in '\n'.join(scr):
                lines, _ = convert_npc_script(text, sl, name, 'sign', texts_needed)
                scr += [slabel + '::'] + lines + ['']
            bgs.append(dict(type='sign', x=x, y=y, elevation=0, player_facing_dir=facing, script=slabel))
        # texter
        scr += [f'{name}_Text_CrystalTodo::', '\t.string "…$"', '']
        for tl in sorted(texts_needed):
            scr += [f'{name}_Text_{tl}::', convert_text_block(text_block(text, tl)), '']
        mj = dict(id=mapid, name=name, layout=lid, music=music, region=CFG['region'], region_map_section=msec, requires_flash=False,
                  weather='WEATHER_SUNNY' if outdoor else 'WEATHER_NONE', map_type=mtype, allow_cycling=outdoor, allow_escaping=False,
                  allow_running=True, show_map_name=outdoor, battle_scene='MAP_BATTLE_SCENE_NORMAL', connections=conns or None,
                  object_events=objs, warp_events=warps, coord_events=coords, bg_events=bgs)
        mdir = f'{EM}/data/maps/{name}'; os.makedirs(mdir, exist_ok=True)
        dump_json(f'{mdir}/map.json', mj)
        spath = f'{mdir}/scripts.inc'
        if os.path.exists(spath) and BEGIN not in rd(spath):
            log('map', f'{name}: scripts.inc är handjusterad – behålls')
        else:
            wr(spath, f'@ {BEGIN}: genererad från pokecrystal av tools/crystal_import. Ta bort raden för att handjustera.\n' + '\n'.join(scr) + '\n')
        groups[gname].append(name)
        includes.append(f'\t.include "data/maps/{name}/scripts.inc"')
    dump_json(f'{EM}/data/layouts/layouts.json', layouts_json)
    dump_json(f'{EM}/data/maps/map_groups.json', groups)
    dump_json(f'{EM}/src/data/region_map/region_map_sections.json', mapsecs)
    alloc['maps'] = list(names)
    wr(f'{EM}/data/johto/event_scripts.inc', '@ Genererad av tools/crystal_import\n' + '\n'.join(includes) + '\n')
    marked_block(f'{EM}/data/event_scripts.s', '\t.include "data/johto/event_scripts.inc"', comment='@',
                 anchor=r'^\t\.include "data/scripts/debug\.inc"$')

# ------------------------------------------------------------------ vilda pokémon
def species_name(n):
    fix = {'NIDORAN_F': 'NIDORAN_F', 'NIDORAN_M': 'NIDORAN_M', 'MR__MIME': 'MR_MIME', 'FARFETCH_D': 'FARFETCHD', 'HO_OH': 'HO_OH'}
    s = 'SPECIES_' + fix.get(n, n)
    if s not in EM_SPECIES: log('wild', f'okänd art {s}'); return 'SPECIES_RATTATA'
    return s

def import_wild(attrs):
    label_to_const = {k: v['const'] for k, v in attrs.items()}
    wanted = {label_to_const[n]: n for n in CFG['maps']}
    em = load_json(f'{EM}/src/data/wild_encounters.json')
    grp = next(g for g in em['wild_encounter_groups'] if g['label'] == 'gWildMonHeaders')
    grp['encounters'] = [e for e in grp['encounters'] if not e['base_label'].startswith('gJohto_') and not e['base_label'].startswith('gCrystal_')]
    grass = {}; water = {}
    for region in ('johto', 'kanto'):
        t = rd(f'{CR}/data/wild/{region}_grass.asm')
        for m in re.finditer(r'def_grass_wildmons (\w+)\n(.*?)end_grass_wildmons', t, re.S):
            mons = re.findall(r'db (\d+), (\w+)', m.group(2))
            grass[m.group(1)] = mons[7:14] if len(mons) >= 14 else mons[:7]  # dagtabellen
        t = rd(f'{CR}/data/wild/{region}_water.asm')
        for m in re.finditer(r'def_water_wildmons (\w+)\n(.*?)end_water_wildmons', t, re.S):
            water[m.group(1)] = re.findall(r'db (\d+), (\w+)', m.group(2))
    for const, name in wanted.items():
        e = dict(map=f'MAP_{const}', base_label=f'gCrystal_{name}')
        if const in grass:
            g = grass[const]; order = [0, 1, 2, 2, 3, 1, 4, 4, 5, 5, 6, 6]
            e['land_mons'] = dict(encounter_rate=20, mons=[dict(min_level=int(g[i][0]), max_level=int(g[i][0]), species=species_name(g[i][1])) for i in order])
        if const in water:
            wt = water[const]; order = [0, 1, 2, 0, 1]
            e['water_mons'] = dict(encounter_rate=4, mons=[dict(min_level=int(wt[i][0]), max_level=int(wt[i][0]), species=species_name(wt[i][1])) for i in order])
        if 'land_mons' in e or 'water_mons' in e: grp['encounters'].append(e)
    dump_json(f'{EM}/src/data/wild_encounters.json', em)

def write_aliases():
    lines = ['// Crystal-flaggor (EVENT_*) mappade till oanvända Emerald-flaggor – genererat av tools/crystal_import']
    for k, v in sorted(alloc['flags'].items()): lines.append(f'#define {k} {v}')
    marked_block(f'{EM}/include/constants/flags.h', '\n'.join(lines), anchor=r'^#endif // GUARD_', before=True)
    lines = ['// Crystal-scenvariabler mappade till oanvända Emerald-variabler – genererat av tools/crystal_import']
    for k, v in sorted(alloc['vars'].items()): lines.append(f'#define {k} {v}')
    marked_block(f'{EM}/include/constants/vars.h', '\n'.join(lines), anchor=r'^#endif // GUARD_', before=True)

BLOCKS = {}
def main():
    global BLOCKS
    BLOCKS = parse_blocks()
    map_consts = parse_map_consts(); maps_asm = parse_maps_asm(); attrs = parse_attributes()
    coll_consts = parse_collision_consts(); scene_consts = parse_scene_consts(); landmarks = parse_landmarks()
    import_maps(map_consts, maps_asm, attrs, coll_consts, scene_consts, landmarks)
    write_tileset_headers()
    import_wild(attrs)
    write_aliases()
    dump_json(ALLOC_PATH, alloc)
    for f in ['tilesets']:
        for d in ('emerald',):
            p = f'{EM}/build/{d}/src/{f}.d'
            if os.path.exists(p): os.remove(p)
    wr(os.path.join(ROOT, 'last_report.txt'), '\n'.join(log_lines) + '\n')
    cats = {}
    for l in log_lines: c = l.split(']')[0][1:]; cats[c] = cats.get(c, 0) + 1
    print(f'Importerade {len(CFG["maps"])} kartor, {len(TILESETS)} tilesets. Anmärkningar: {cats}')

if __name__ == '__main__':
    main()
