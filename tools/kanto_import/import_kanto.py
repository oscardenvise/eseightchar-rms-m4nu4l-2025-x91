#!/usr/bin/env python3
"""
Importerar kartor från pret/pokefirered till pret/pokeemerald.

Kör från repo-roten:  python3 tools/kanto_import/import_kanto.py

Verktyget är idempotent: det kan köras om efter ändringar i config.json.
Allt som skrivs in i befintliga Emerald-filer läggs i markerade block
(// KANTO_IMPORT_BEGIN ... // KANTO_IMPORT_END) som ersätts vid nästa körning.

Kartfiler som skapas (data/maps/<Karta>/scripts.inc) skrivs bara om de
inte redan finns, så att handgjorda justeringar bevaras. Ta bort filen
för att generera om den.
"""
import json, os, re, shutil, struct, sys
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(ROOT, '..', '..'))
CFG = json.load(open(os.path.join(ROOT, 'config.json')))
FR = os.path.join(REPO, CFG['firered_dir'])
EM = os.path.join(REPO, CFG['emerald_dir'])
ALLOC_PATH = os.path.join(ROOT, 'allocations.json')
BEGIN = 'KANTO_IMPORT_BEGIN'
END = 'KANTO_IMPORT_END'

log_lines = []
def log(cat, msg):
    log_lines.append(f'[{cat}] {msg}')

def rd(p):
    with open(p, encoding='utf-8') as f:
        return f.read()

def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)

def load_json(p):
    return json.load(open(p, encoding='utf-8'))

def dump_json(p, d):
    wr(p, json.dumps(d, indent=2, ensure_ascii=False) + '\n')

def marked_block(path, content, comment='//', anchor=None, before=False):
    """Ersätt/infoga ett markerat block i en befintlig fil."""
    text = rd(path)
    block = f'{comment} {BEGIN}\n{content.rstrip()}\n{comment} {END}\n'
    pat = re.compile(re.escape(comment) + r' ' + BEGIN + r'\n.*?' + re.escape(comment) + r' ' + END + r'\n', re.S)
    if pat.search(text):
        text = pat.sub(lambda m: block, text)
    elif anchor:
        m = re.search(anchor, text, re.M)
        if not m:
            raise RuntimeError(f'anchor {anchor!r} not found in {path}')
        pos = m.start() if before else m.end()
        text = text[:pos] + ('\n' if not before else '') + block + ('\n' if before else '') + text[pos:]
    else:
        text = text.rstrip('\n') + '\n\n' + block
    wr(path, text)

# ---------------------------------------------------------------- konstanter
MARK_RE = re.compile(r'(?://|@) ' + BEGIN + r'\n.*?(?://|@) ' + END + r'\n', re.S)

def rd_clean(path):
    """Filinnehåll utan tidigare genererade block (annars ser gamla alias ut som riktiga konstanter)."""
    return MARK_RE.sub('', rd(path))

def parse_defines(path, prefix):
    return set(re.findall(r'#define (' + prefix + r'\w*)', rd_clean(path)))

def parse_enum_names(path, prefix):
    return set(re.findall(r'^\s*(' + prefix + r'\w*)\s*(?:=[^,]*)?,', rd(path), re.M))

def parse_mb(path):
    """Metatile behaviors: FR använder #define, Emerald enum."""
    text = rd(path)
    vals = {}
    for m in re.finditer(r'#define (MB_\w+)\s+(0x[0-9A-Fa-f]+|\d+)', text):
        vals[m.group(1)] = int(m.group(2), 0)
    if not vals:
        v = -1
        for line in text.splitlines():
            m = re.match(r'\s*(MB_\w+)\s*(?:=\s*(0x[0-9A-Fa-f]+|\d+))?\s*,', line)
            if m:
                v = int(m.group(2), 0) if m.group(2) else v + 1
                vals[m.group(1)] = v
    # alias: #define MB_X MB_Y
    for m in re.finditer(r'#define (MB_\w+)\s+(MB_\w+)', text):
        if m.group(2) in vals:
            vals[m.group(1)] = vals[m.group(2)]
    return vals

FR_METATILES = {m.group(1): m.group(2) for m in re.finditer(r'#define (METATILE_\w+)\s+(0x[0-9A-Fa-f]+|\d+)', rd(f'{FR}/include/constants/metatile_labels.h'))}
FR_MB = parse_mb(f'{FR}/include/constants/metatile_behaviors.h')
EM_MB = parse_mb(f'{EM}/include/constants/metatile_behaviors.h')
FR_MB_BY_VAL = {v: k for k, v in FR_MB.items()}

EM_FLAGS = parse_defines(f'{EM}/include/constants/flags.h', 'FLAG_')
EM_VARS = parse_defines(f'{EM}/include/constants/vars.h', 'VAR_')
EM_GFX = parse_defines(f'{EM}/include/constants/event_objects.h', 'OBJ_EVENT_GFX_')
EM_MOVTYPES = parse_defines(f'{EM}/include/constants/event_object_movement.h', 'MOVEMENT_TYPE_')
EM_SONGS = parse_defines(f'{EM}/include/constants/songs.h', r'(?:MUS|SE|PH)_')
EM_SPECIALS = set(re.findall(r'def_special (\w+)', rd(f'{EM}/data/specials.inc')))
EM_BATTLE_SCENES = parse_defines(f'{EM}/include/constants/map_types.h', 'MAP_BATTLE_SCENE_')
EM_ITEMS = parse_enum_names(f'{EM}/include/constants/items.h', 'ITEM_') | parse_defines(f'{EM}/include/constants/items.h', 'ITEM_')
EM_SPECIES = parse_defines(f'{EM}/include/constants/species.h', 'SPECIES_') | parse_enum_names(f'{EM}/include/constants/species.h', 'SPECIES_')
EM_TRAINERS = parse_defines(f'{EM}/include/constants/opponents.h', 'TRAINER_') | parse_enum_names(f'{EM}/include/constants/opponents.h', 'TRAINER_')
EM_HEAL = parse_enum_names(f'{EM}/include/constants/heal_locations.h', 'HEAL_LOCATION_') | parse_defines(f'{EM}/include/constants/heal_locations.h', 'HEAL_LOCATION_')
EM_MAPSEC = {e['id'] for e in load_json(f'{EM}/src/data/region_map/region_map_sections.json')['map_sections']}
EM_EVENT_MACROS = set(re.findall(r'^\s*\.macro (\w+)', rd(f'{EM}/asm/macros/event.inc'), re.M))
EM_MOVE_MACROS = set(re.findall(r'create_movement_action (\w+)', rd(f'{EM}/asm/macros/movement.inc')))
EM_EVENT_MACROS |= set(re.findall(r'^\s*\.macro (\w+)', rd(f'{EM}/asm/macros/map.inc'), re.M))
EM_EVENT_MACROS |= set(re.findall(r'^\s*\.macro (\w+)', rd(f'{EM}/asm/macros/movement.inc'), re.M))

# Kända skript-etiketter i Emerald (data/scripts + event_scripts.s + fältmoves)
EM_LABELS = set()
for d in [f'{EM}/data/scripts', f'{EM}/data/text']:
    if os.path.isdir(d):
        for fn in os.listdir(d):
            EM_LABELS |= set(re.findall(r'^([A-Za-z_]\w*):{1,2}', rd(os.path.join(d, fn)), re.M))
EM_LABELS |= set(re.findall(r'^([A-Za-z_]\w*):{1,2}', rd(f'{EM}/data/event_scripts.s'), re.M))

# Alla kart-ID:n i Emerald
EM_MAP_IDS = set()
for name in os.listdir(f'{EM}/data/maps'):
    p = f'{EM}/data/maps/{name}/map.json'
    if os.path.exists(p):
        EM_MAP_IDS.add(load_json(p)['id'])

# ---------------------------------------------------------------- allokering av flaggor/vars
alloc = load_json(ALLOC_PATH) if os.path.exists(ALLOC_PATH) else {'flags': {}, 'vars': {}}

def unused_pool(path, prefix):
    names = re.findall(r'#define (' + prefix + r'UNUSED_(0x[0-9A-Fa-f]+))', rd_clean(path))
    return names

# Gömda föremål måste ha flaggor i intervallet FLAG_HIDDEN_ITEMS_START..+0xFF
HIDDEN_LO, HIDDEN_HI = 0x1F4, 0x1F4 + 0xFF
_flags = unused_pool(f'{EM}/include/constants/flags.h', 'FLAG_')
FLAG_POOL = [n for n, v in _flags if not (HIDDEN_LO <= int(v, 16) <= HIDDEN_HI)]
HIDDEN_POOL = [n for n, v in _flags if HIDDEN_LO <= int(v, 16) <= HIDDEN_HI]
VAR_POOL = [n for n, v in unused_pool(f'{EM}/include/constants/vars.h', 'VAR_')]

def allocate(kind, name):
    table = alloc[kind]
    if name in table:
        return table[name]
    pool = VAR_POOL if kind == 'vars' else (HIDDEN_POOL if name.startswith('FLAG_HIDDEN_ITEM_') else FLAG_POOL)
    used = set(table.values())
    for cand in pool:
        if cand not in used:
            table[name] = cand
            return cand
    raise RuntimeError(f'Slut på lediga {kind} i Emerald – dags att utöka save-blocket')

def map_flag(tok):
    if tok in EM_FLAGS or tok == '0':
        return tok
    allocate('flags', tok)
    return tok  # namnet behålls; definieras i flags.h via alias

def map_var(tok):
    if tok in EM_VARS:
        return tok
    allocate('vars', tok)
    return tok

# ---------------------------------------------------------------- musik / gfx / mm
def map_music(tok):
    rg = 'MUS_RG_' + tok[len('MUS_'):]
    if rg in EM_SONGS:
        return rg
    if tok in EM_SONGS:
        return tok
    log('music', f'{tok} saknas i Emerald, använder MUS_RG_PALLET')
    return 'MUS_RG_PALLET'

def map_gfx(tok):
    if tok in CFG['gfx_port']:
        return tok  # alias definieras i event_objects.h
    if tok in CFG['gfx_map']:
        return CFG['gfx_map'][tok]
    if tok in EM_GFX or tok == '0':
        return tok
    log('gfx', f'{tok} saknar motsvarighet, använder {CFG["gfx_default"]}')
    return CFG['gfx_default']

def map_movtype(tok):
    if tok in EM_MOVTYPES:
        return tok
    if tok in CFG['movement_type_map']:
        return CFG['movement_type_map'][tok]
    log('movement', f'{tok} saknas, använder MOVEMENT_TYPE_FACE_DOWN')
    return 'MOVEMENT_TYPE_FACE_DOWN'

def map_behavior(fr_val):
    name = FR_MB_BY_VAL.get(fr_val)
    if name is None:
        log('behavior', f'okänt FR-beteende {fr_val}, använder MB_NORMAL')
        return EM_MB['MB_NORMAL']
    if name in EM_MB:
        return EM_MB[name]
    fb = CFG['behavior_fallback'].get(name)
    if fb is None:
        log('behavior', f'{name} saknar fallback, använder MB_NORMAL')
        return EM_MB['MB_NORMAL']
    return EM_MB[fb]

def convert_attributes(fr_bytes):
    """FR: u32 per metatile (behavior bit 0-8, layer bit 29-30).
       Emerald: u16 per metatile (behavior bit 0-7, layer bit 12-15)."""
    out = bytearray()
    for (a,) in struct.iter_unpack('<I', fr_bytes):
        beh = map_behavior(a & 0x1FF)
        layer = (a >> 29) & 3
        out += struct.pack('<H', (beh & 0xFF) | (layer << 12))
    return bytes(out)

# ---------------------------------------------------------------- tilesets
def tileset_dirname(sym):
    # gTileset_PalletTown -> pallet_town
    n = sym[len('gTileset_'):]
    return re.sub(r'(?<!^)(?=[A-Z0-9])', '_', n).lower().replace('__', '_')

def fr_tileset_dir(sym, secondary):
    return f'{FR}/data/tilesets/{"secondary" if secondary else "primary"}/{tileset_dirname(sym)}'

def png_tiles(path):
    im = Image.open(path)
    if im.mode != 'P':
        raise RuntimeError(f'{path}: väntade indexerad PNG')
    w, h = im.size
    assert w == 128, path
    tiles = []
    for ty in range(h // 8):
        for tx in range(16):
            tiles.append(im.crop((tx * 8, ty * 8, tx * 8 + 8, ty * 8 + 8)))
    return tiles, im.getpalette()

def write_tiles_png(path, tiles, palette):
    rows = (len(tiles) + 15) // 16
    im = Image.new('P', (128, rows * 8), 0)
    im.putpalette(palette)
    for i, t in enumerate(tiles):
        im.paste(t, ((i % 16) * 8, (i // 16) * 8))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)

def copy_palettes(src_dir, dst_dir, override=None):
    """Kopiera 00-15.pal. override: {index: källfil}"""
    os.makedirs(dst_dir, exist_ok=True)
    for i in range(16):
        src = f'{src_dir}/{i:02d}.pal'
        if override and i in override:
            src = override[i]
        shutil.copyfile(src, f'{dst_dir}/{i:02d}.pal')

N_PRIM_EM = 512
N_PRIM_FR = 640

def build_tilesets(layouts):
    """Skapar Emerald-tilesets av FR-par. Returnerar {fr_sym: em_sym} och genererar .h-filer."""
    prim_used = {}
    pairs = {}
    for l in layouts:
        prim_used[l['primary_tileset']] = True
        if l['secondary_tileset'] in pairs and pairs[l['secondary_tileset']] != l['primary_tileset']:
            raise RuntimeError(f"{l['secondary_tileset']} används med flera primära tilesets")
        pairs[l['secondary_tileset']] = l['primary_tileset']

    mapping = {}
    gfx_h, meta_h, hdr_h = [], [], []
    gfx_h.append('// Genererad av tools/kanto_import/import_kanto.py – ändra inte för hand.\n')
    meta_h.append(gfx_h[0]); hdr_h.append(gfx_h[0])

    def emit(em_name, dirpath_rel, ntiles, secondary, callback):
        sym = 'Kanto' + em_name
        gfx_h.append(f'const u32 gTilesetTiles_{sym}[] = INCGFX_U32("{dirpath_rel}/tiles.png", ".4bpp.lz", "-num_tiles {ntiles} -Wnum_tiles");\n')
        gfx_h.append(f'const u16 gTilesetPalettes_{sym}[][16] =\n{{\n')
        for i in range(16):
            gfx_h.append(f'\tINCGFX_U16("{dirpath_rel}/palettes/{i:02d}.pal", ".gbapal"),\n')
        gfx_h.append('};\n\n')
        meta_h.append(f'const u16 gMetatiles_{sym}[] = INCBIN_U16("{dirpath_rel}/metatiles.bin");\n')
        meta_h.append(f'const u16 gMetatileAttributes_{sym}[] = INCBIN_U16("{dirpath_rel}/metatile_attributes.bin");\n\n')
        hdr_h.append(f'const struct Tileset gTileset_{sym} =\n{{\n    .isCompressed = TRUE,\n    .isSecondary = {"TRUE" if secondary else "FALSE"},\n'
                     f'    .tiles = gTilesetTiles_{sym},\n    .palettes = gTilesetPalettes_{sym},\n    .metatiles = gMetatiles_{sym},\n'
                     f'    .metatileAttributes = gMetatileAttributes_{sym},\n    .callback = {callback},\n}};\n\n')
        return f'gTileset_{sym}'

    # Primära
    for prim in prim_used:
        name = prim[len('gTileset_'):]
        src = fr_tileset_dir(prim, False)
        dst_rel = f'data/tilesets/primary/kanto_{tileset_dirname(prim)}'
        dst = f'{EM}/{dst_rel}'
        tiles, pal = png_tiles(f'{src}/tiles.png')
        write_tiles_png(f'{dst}/tiles.png', tiles[:N_PRIM_EM], pal)
        copy_palettes(f'{src}/palettes', f'{dst}/palettes')
        mt = open(f'{src}/metatiles.bin', 'rb').read()
        at = open(f'{src}/metatile_attributes.bin', 'rb').read()
        open(f'{dst}/metatiles.bin', 'wb').write(mt[:N_PRIM_EM * 16])
        open(f'{dst}/metatile_attributes.bin', 'wb').write(convert_attributes(at[:N_PRIM_EM * 4]))
        cb = CFG['tileset_callbacks'].get(name, 'NULL')
        mapping[prim] = emit(name, dst_rel, N_PRIM_EM, False, cb)
        # animationsramar (png) kopieras om de finns
        anim_src = f'{src}/anim'
        if os.path.isdir(anim_src):
            for root, dirs, files in os.walk(anim_src):
                for fn in files:
                    if fn.endswith('.png'):
                        rel = os.path.relpath(os.path.join(root, fn), anim_src)
                        d = f'{dst}/anim/{rel}'
                        os.makedirs(os.path.dirname(d), exist_ok=True)
                        shutil.copyfile(os.path.join(root, fn), d)

    # Sekundära: FR-primärens tiles 512..639 + FR-sekundärens tiles
    for sec, prim in pairs.items():
        name = sec[len('gTileset_'):]
        psrc = fr_tileset_dir(prim, False)
        ssrc = fr_tileset_dir(sec, True)
        dst_rel = f'data/tilesets/secondary/kanto_{tileset_dirname(sec)}'
        dst = f'{EM}/{dst_rel}'
        ptiles, _ = png_tiles(f'{psrc}/tiles.png')
        stiles, spal = png_tiles(f'{ssrc}/tiles.png')
        tiles = ptiles[N_PRIM_EM:N_PRIM_FR] + stiles
        if len(tiles) > 512:
            raise RuntimeError(f'{sec}: {len(tiles)} tiles ryms inte i ett Emerald-sekundärtileset')
        write_tiles_png(f'{dst}/tiles.png', tiles, spal)
        copy_palettes(f'{ssrc}/palettes', f'{dst}/palettes', override={6: f'{psrc}/palettes/06.pal'})
        pmt = open(f'{psrc}/metatiles.bin', 'rb').read()
        pat = open(f'{psrc}/metatile_attributes.bin', 'rb').read()
        smt = open(f'{ssrc}/metatiles.bin', 'rb').read()
        sat = open(f'{ssrc}/metatile_attributes.bin', 'rb').read()
        mt = pmt[N_PRIM_EM * 16:N_PRIM_FR * 16] + smt
        at = pat[N_PRIM_EM * 4:N_PRIM_FR * 4] + sat
        if len(mt) // 16 > 512:
            raise RuntimeError(f'{sec}: för många metatiles')
        open(f'{dst}/metatiles.bin', 'wb').write(mt)
        open(f'{dst}/metatile_attributes.bin', 'wb').write(convert_attributes(at))
        cb = CFG['tileset_callbacks'].get(name, 'NULL')
        mapping[sec] = emit(name, dst_rel, len(tiles), True, cb)

    wr(f'{EM}/src/data/tilesets/kanto_graphics.h', ''.join(gfx_h))
    wr(f'{EM}/src/data/tilesets/kanto_metatiles.h', ''.join(meta_h))
    wr(f'{EM}/src/data/tilesets/kanto_headers.h', ''.join(hdr_h))
    marked_block(f'{EM}/src/tilesets.c',
                 '#include "data/tilesets/kanto_graphics.h"\n#include "data/tilesets/kanto_metatiles.h"\n#include "data/tilesets/kanto_headers.h"')
    return mapping

# ---------------------------------------------------------------- layouter
def layout_new_id(fr_id):
    return 'LAYOUT_KANTO_' + fr_id[len('LAYOUT_'):]

def layout_new_name(fr_name):
    return 'Kanto' + fr_name  # PalletTown_Layout -> KantoPalletTown_Layout

def import_layouts(fr_layouts, tileset_map):
    em_path = f'{EM}/data/layouts/layouts.json'
    em = load_json(em_path)
    existing = {l['id']: i for i, l in enumerate(em['layouts']) if l}
    for l in fr_layouts:
        nid = layout_new_id(l['id'])
        dirname = 'Kanto' + os.path.basename(os.path.dirname(l['blockdata_filepath']))
        dst = f'{EM}/data/layouts/{dirname}'
        os.makedirs(dst, exist_ok=True)
        shutil.copyfile(f'{FR}/{l["border_filepath"]}', f'{dst}/border.bin')
        shutil.copyfile(f'{FR}/{l["blockdata_filepath"]}', f'{dst}/map.bin')
        entry = {
            'id': nid,
            'name': layout_new_name(l['name']),
            'width': l['width'], 'height': l['height'],
            'primary_tileset': tileset_map[l['primary_tileset']],
            'secondary_tileset': tileset_map[l['secondary_tileset']],
            'border_filepath': f'data/layouts/{dirname}/border.bin',
            'blockdata_filepath': f'data/layouts/{dirname}/map.bin',
        }
        if nid in existing:
            em['layouts'][existing[nid]] = entry
        else:
            em['layouts'].append(entry)
    dump_json(em_path, em)

# ---------------------------------------------------------------- skript
DROP_RES = [re.compile(r) for r in CFG['drop_line_regex']]
TOKEN_MAP = CFG['token_map']

def resolve_ifdefs(text):
    """Behåll BUGFIX-grenen i #ifdef BUGFIX/#else/#endif (preproc kör före cpp)."""
    out = []; keep = [True]
    for line in text.splitlines():
        s = line.strip()
        if s.startswith('#ifdef'):
            keep.append('BUGFIX' in s); continue
        if s.startswith('#ifndef'):
            keep.append('BUGFIX' not in s); continue
        if s.startswith('#else'):
            keep[-1] = not keep[-1]; continue
        if s.startswith('#endif'):
            keep.pop(); continue
        if all(keep):
            out.append(line)
    return '\n'.join(out)

def convert_script(text, map_name, imported_map_ids, defined_labels, nurse_id=None):
    out = []
    text = resolve_ifdefs(text)
    for line in text.splitlines():
        raw = line
        if nurse_id and re.match(r'^\s*call (Common_)?EventScript_PkmnCenterNurse\b', line):
            out.append(f'\tsetvar VAR_0x800B, {nurse_id}')
        m = re.match(r'^(\s*)giveitem_msg (\w+), (\w+)(?:, (\w+))?(?:, (\w+))?', line)
        if m:
            amount = m.group(4) or '1'
            log('script', f'{map_name}: giveitem_msg -> giveitem ({m.group(3)})')
            line = f'{m.group(1)}giveitem {m.group(3)}, {amount}'
        if any(r.search(line) for r in DROP_RES):
            log('script', f'{map_name}: tog bort rad: {line.strip()}')
            continue
        # specials
        m = re.match(r'^(\s*)special (\w+)\s*$', line)
        if m:
            sp = TOKEN_MAP.get(m.group(2), m.group(2))
            if sp not in EM_SPECIALS:
                log('script', f'{map_name}: okänd special borttagen: {m.group(2)}')
                out.append(f'{m.group(1)}@ KANTO_TODO special {m.group(2)}')
                continue
            line = f'{m.group(1)}special {sp}'
        m = re.match(r'^(\s*)specialvar (\w+), (\w+)\s*$', line)
        if m:
            sp = TOKEN_MAP.get(m.group(3), m.group(3))
            if sp not in EM_SPECIALS:
                log('script', f'{map_name}: okänd specialvar ersatt med setvar 0: {m.group(3)}')
                out.append(f'{m.group(1)}setvar {m.group(2)}, 0 @ KANTO_TODO specialvar {m.group(3)}')
                continue
            line = f'{m.group(1)}specialvar {m.group(2)}, {sp}'
        # tränarstrider mot FR-tränare -> bara text
        m = re.match(r'^(\s*)trainerbattle\w*\s+(TRAINER_\w+),\s*(\w+),\s*(\w+)', line)
        if m and m.group(2) not in EM_TRAINERS:
            log('script', f'{map_name}: tränarstrid ersatt med text: {m.group(2)}')
            out.append(f'{m.group(1)}msgbox {m.group(3)}, MSGBOX_DEFAULT @ KANTO_TODO {line.strip()}')
            continue
        m = re.match(r'^(\s*)setrespawn (\w+)', line)
        if m and m.group(2) not in EM_HEAL:
            log('script', f'{map_name}: setrespawn borttagen: {m.group(2)}')
            out.append(f'{m.group(1)}@ KANTO_TODO {line.strip()}')
            continue
        # token-ersättningar
        def repl(tok):
            t = tok.group(0)
            if t in TOKEN_MAP:
                return TOKEN_MAP[t]
            if t.startswith('FLAG_'):
                return map_flag(t)
            if t.startswith('VAR_'):
                return map_var(t)
            if t.startswith('MUS_'):
                return map_music(t)
            if t.startswith('OBJ_EVENT_GFX_'):
                return map_gfx(t)
            if t.startswith('MOVEMENT_TYPE_'):
                return map_movtype(t)
            if t.startswith('LAYOUT_'):
                return layout_new_id(t)
            if t.startswith('METATILE_') and t in FR_METATILES:
                return FR_METATILES[t]  # Emerald saknar FR:s metatile-etiketter; använd talet
            if t.startswith('MAP_') and not t.startswith(('MAP_SCRIPT_', 'MAP_TYPE_', 'MAP_BATTLE_')):
                if t not in imported_map_ids and t not in EM_MAP_IDS:
                    log('script', f'{map_name}: {t} är inte importerad, ersatt med {CFG["fallback_map"]}')
                    return CFG['fallback_map']
            if t.startswith('TRAINER_') and t not in EM_TRAINERS and not t.startswith('TRAINER_TYPE_'):
                log('script', f'{map_name}: okänd tränare {t} -> TRAINER_NONE')
                return 'TRAINER_NONE'
            if t.startswith('SE_') and t not in EM_SONGS:
                log('script', f'{map_name}: okänt ljud {t}')
            if t.startswith('ITEM_') and t not in EM_ITEMS:
                log('script', f'{map_name}: okänt föremål {t}')
            if t.startswith('SPECIES_') and t not in EM_SPECIES:
                log('script', f'{map_name}: okänd art {t}')
            return t
        code = line.split('@')[0]
        comment = line[len(code):]
        code = re.sub(r'\b[A-Za-z_]\w*\b', repl, code)
        line = code + comment
        # makron/etiketter
        m = re.match(r'^\s*([a-z_][a-z_0-9]*)\b', line)
        if m and not line.startswith(('\t.', ' .')) and not line.strip().startswith('.'):
            mac = m.group(1)
            if mac not in EM_EVENT_MACROS and mac not in EM_MOVE_MACROS and mac not in ('step_end',):
                # kan vara lokal .macro i filen
                if not re.search(r'\.macro ' + re.escape(mac) + r'\b', text):
                    log('script', f'{map_name}: okänt makro {mac}: {raw.strip()}')
        for lab in re.findall(r'\b([A-Z][A-Za-z0-9]*_(?:EventScript|Text|Movement)_\w+|Common_\w+|EventScript_\w+|Text_\w+|Std_\w+)\b', code):
            if lab not in EM_LABELS and lab not in defined_labels:
                log('script', f'{map_name}: okänd etikett {lab}')
        out.append(line)
    return '\n'.join(out) + '\n'

# ---------------------------------------------------------------- kartor
def import_maps(map_names, fr_layouts_by_id):
    fr_groups = load_json(f'{FR}/data/maps/map_groups.json')
    em_groups_path = f'{EM}/data/maps/map_groups.json'
    em_groups = load_json(em_groups_path)
    # rensa tidigare Kanto-grupper
    prev = alloc.get('groups', [])
    for g in prev:
        em_groups.pop(g, None)
        if g in em_groups['group_order']:
            em_groups['group_order'].remove(g)
    em_groups['connections_include_order'] = [m for m in em_groups['connections_include_order'] if m not in alloc.get('maps', [])]

    map_ids = {}
    for name in map_names:
        d = load_json(f'{FR}/data/maps/{name}/map.json')
        if d['id'] in EM_MAP_IDS and name not in alloc.get('maps', []):
            raise RuntimeError(f"{d['id']} finns redan i Emerald")
        map_ids[name] = d['id']
    imported_ids = set(map_ids.values())

    new_groups = {}
    for gname in fr_groups['group_order']:
        members = [m for m in fr_groups[gname] if m in map_names]
        if members:
            gn = CFG['group_rename'].get(gname, gname)
            new_groups[gn] = members
    for gn, members in new_groups.items():
        em_groups[gn] = members
        em_groups['group_order'].append(gn)
    for name in map_names:
        if load_json(f'{FR}/data/maps/{name}/map.json').get('connections'):
            em_groups['connections_include_order'].append(name)
    alloc['groups'] = list(new_groups.keys())
    alloc['maps'] = list(map_names)
    dump_json(em_groups_path, em_groups)

    includes = []
    for name in map_names:
        d = load_json(f'{FR}/data/maps/{name}/map.json')
        d.pop('floor_number', None)
        d['layout'] = layout_new_id(d['layout'])
        d['music'] = map_music(d['music'])
        if d['region_map_section'] not in EM_MAPSEC:
            log('map', f"{name}: {d['region_map_section']} saknas, använder MAPSEC_NONE")
            d['region_map_section'] = 'MAPSEC_NONE'
        if d['battle_scene'] not in EM_BATTLE_SCENES:
            d['battle_scene'] = 'MAP_BATTLE_SCENE_NORMAL'
        conns = [c for c in (d.get('connections') or []) if c['map'] in imported_ids or c['map'] in EM_MAP_IDS]
        for c in (d.get('connections') or []):
            if c not in conns:
                log('map', f"{name}: anslutning till {c['map']} borttagen (ej importerad)")
        d['connections'] = conns or None
        for o in d.get('object_events', []):
            o['graphics_id'] = map_gfx(o['graphics_id'])
            o['movement_type'] = map_movtype(o['movement_type'])
            o['flag'] = map_flag(o['flag'])
            if o.get('type') == 'clone':
                pass
        kept = []
        for w in d.get('warp_events', []):
            if w['dest_map'] not in imported_ids and w['dest_map'] not in EM_MAP_IDS:
                log('map', f"{name}: warp till {w['dest_map']} borttagen (ej importerad)")
            else:
                kept.append(w)
        d['warp_events'] = kept
        d['object_events'] = d.get('object_events', []) + CFG.get('extra_object_events', {}).get(name, [])
        for c in d.get('coord_events', []):
            if 'var' in c:
                c['var'] = map_var(c['var'])
        for b in d.get('bg_events', []):
            if b['type'] == 'hidden_item':
                b['flag'] = map_flag(b['flag'])
                b.pop('quantity', None); b.pop('underfoot', None)
                if b['item'] not in EM_ITEMS:
                    log('map', f"{name}: föremål {b['item']} saknas, använder ITEM_POTION")
                    b['item'] = 'ITEM_POTION'
        dst = f'{EM}/data/maps/{name}'
        os.makedirs(dst, exist_ok=True)
        dump_json(f'{dst}/map.json', d)

        scr_path = f'{dst}/scripts.inc'
        if os.path.exists(scr_path) and BEGIN not in rd(scr_path):
            log('map', f'{name}: scripts.inc finns redan (handjusterad) – behålls')
        else:
            fr_scr = rd(f'{FR}/data/maps/{name}/scripts.inc')
            fr_txt_p = f'{FR}/data/maps/{name}/text.inc'
            fr_txt = rd(fr_txt_p) if os.path.exists(fr_txt_p) else ''
            for extra in CFG.get('extra_text_files', {}).get(name, []):
                fr_txt += '\n' + rd(f'{FR}/{extra}')
            full = fr_scr + '\n' + fr_txt
            defined = set(re.findall(r'^(\w+):{1,2}', full, re.M))
            nurse = next((o['local_id'] for o in d.get('object_events', []) if 'NURSE' in o.get('local_id', '')), None)
            conv = convert_script(full, name, imported_ids, defined, nurse)
            wr(scr_path, f'@ {BEGIN}: genererad från pokefirered av tools/kanto_import. Ta bort denna rad om du handjusterar filen.\n' + conv)
        includes.append(f'\t.include "data/maps/{name}/scripts.inc"')
    for fn in sorted(os.listdir(f'{EM}/data/kanto')) if os.path.isdir(f'{EM}/data/kanto') else []:
        if fn.endswith('.inc') and fn != 'event_scripts.inc':
            includes.append(f'\t.include "data/kanto/{fn}"')
    wr(f'{EM}/data/kanto/event_scripts.inc', '@ Genererad av tools/kanto_import – Kanto-kartornas skript\n' + '\n'.join(includes) + '\n')
    marked_block(f'{EM}/data/event_scripts.s', '\t.include "data/kanto/event_scripts.inc"', comment='@',
                 anchor=r'^\t\.include "data/maps/[^"]+/scripts\.inc"\n(?!\t\.include "data/maps/)', before=False)
    return map_ids

# ---------------------------------------------------------------- vilda pokémon
def import_wild(map_ids):
    fr = load_json(f'{FR}/src/data/wild_encounters.json')
    em_path = f'{EM}/src/data/wild_encounters.json'
    em = load_json(em_path)
    grp = next(g for g in em['wild_encounter_groups'] if g['label'] == 'gWildMonHeaders')
    grp['encounters'] = [e for e in grp['encounters'] if not e['base_label'].startswith('gKanto_')]
    frgrp = next(g for g in fr['wild_encounter_groups'] if g['label'] == 'gWildMonHeaders')
    for name, mid in map_ids.items():
        cands = [e for e in frgrp['encounters'] if e['map'] == mid]
        if not cands:
            continue
        e = next((c for c in cands if 'FireRed' in c['base_label']), cands[0])
        e = json.loads(json.dumps(e))
        e['base_label'] = f'gKanto_{name}'
        grp['encounters'].append(e)
    dump_json(em_path, em)

# ---------------------------------------------------------------- flaggor/vars-alias
def write_flag_var_aliases():
    for f in CFG.get('extra_flags', []): allocate('flags', f)
    for v in CFG.get('extra_vars', []): allocate('vars', v)
    lines = ['// Kanto-flaggor från pokefirered, mappade till oanvända Emerald-flaggor']
    for k, v in sorted(alloc['flags'].items()):
        lines.append(f'#define {k} {v}')
    marked_block(f'{EM}/include/constants/flags.h', '\n'.join(lines), anchor=r'^#endif', before=True)
    lines = ['// Kanto-variabler från pokefirered, mappade till oanvända Emerald-variabler']
    for k, v in sorted(alloc['vars'].items()):
        lines.append(f'#define {k} {v}')
    marked_block(f'{EM}/include/constants/vars.h', '\n'.join(lines), anchor=r'^#endif', before=True)

# ---------------------------------------------------------------- sprites
PAL_TAG_MAP = {'OBJ_EVENT_PAL_TAG_NPC_BLUE': 'OBJ_EVENT_PAL_TAG_NPC_1', 'OBJ_EVENT_PAL_TAG_NPC_PINK': 'OBJ_EVENT_PAL_TAG_NPC_2',
               'OBJ_EVENT_PAL_TAG_NPC_GREEN': 'OBJ_EVENT_PAL_TAG_NPC_3', 'OBJ_EVENT_PAL_TAG_NPC_WHITE': 'OBJ_EVENT_PAL_TAG_NPC_4'}

def port_gfx():
    info_src = rd(f'{FR}/src/data/object_events/object_event_graphics_info.h')
    pics_src = rd(f'{FR}/src/data/object_events/object_event_pic_tables.h')
    gfx_lines = ['// Genererad av tools/kanto_import – Kanto-sprites från pokefirered\n']
    pic_lines = [gfx_lines[0]]
    info_lines = [gfx_lines[0], '''// Emerald saknar 32x16-basen som några FireRed-objekt använder
static const struct OamData gObjectEventBaseOam_32x16 = {
    .shape = SPRITE_SHAPE(32x16),
    .size = SPRITE_SIZE(32x16),
    .priority = 2
};

''']
    defines = ['// Kanto-sprites använder oanvända sprite-platser i Emerald']
    ptr_path = f'{EM}/src/data/object_events/object_event_graphics_info_pointers.h'
    ptr = rd(ptr_path)
    for const, spec in CFG['gfx_port'].items():
        fr_name = spec['fr_name']; sym = 'Kanto' + fr_name
        png_src = f'{FR}/graphics/object_events/pics/{spec["png"]}'
        png_dst_rel = f'graphics/object_events/pics/kanto/{os.path.basename(spec["png"])}'
        os.makedirs(f'{EM}/graphics/object_events/pics/kanto', exist_ok=True)
        shutil.copyfile(png_src, f'{EM}/{png_dst_rel}')
        # bildtabell
        m = re.search(r'static const struct SpriteFrameImage sPicTable_' + fr_name + r'\[\] = \{(.*?)\};', pics_src, re.S)
        frames = re.findall(r'overworld_frame\(gObjectEventPic_' + fr_name + r', (\d+), (\d+), (\d+)\)', m.group(1))
        # storlek från grafikinfon (FR:s pic-tabell anger ibland fel ordning)
        im = re.search(r'gObjectEventGraphicsInfo_' + fr_name + r' = \{.*?\.width = (\d+),\s*\.height = (\d+)', info_src, re.S)
        w, h = int(im.group(1)) // 8, int(im.group(2)) // 8
        frames = [(str(w), str(h), fi) for _, _, fi in frames]
        gfx_lines.append(f'const u32 gObjectEventPic_{sym}[] = INCGFX_U32("{png_dst_rel}", ".4bpp", "-mwidth {w} -mheight {h}");\n')
        gfx_lines.append(f'extern const struct ObjectEventGraphicsInfo gObjectEventGraphicsInfo_{sym};\n')
        pic_lines.append(f'static const struct SpriteFrameImage sPicTable_{sym}[] = {{\n')
        for fw, fh, fi in frames:
            pic_lines.append(f'    overworld_frame(gObjectEventPic_{sym}, {fw}, {fh}, {fi}),\n')
        pic_lines.append('};\n\n')
        # graphics info
        m = re.search(r'const struct ObjectEventGraphicsInfo gObjectEventGraphicsInfo_' + fr_name + r' = \{.*?\};\n', info_src, re.S)
        entry = m.group(0).replace(f'gObjectEventGraphicsInfo_{fr_name}', f'gObjectEventGraphicsInfo_{sym}')
        entry = entry.replace(f'sPicTable_{fr_name}', f'sPicTable_{sym}')
        entry = entry.replace('gObjectEventSpriteOamTables_', 'sOamTables_')
        for a, b in PAL_TAG_MAP.items():
            entry = entry.replace(a, b)
        info_lines.append(entry + '\n')
        defines.append(f'#define {const} {spec["slot"]}')
        ptr, n = re.subn(r'(\[' + re.escape(spec['slot']) + r'\]\s*=\s*)&\w+,', r'\1&gObjectEventGraphicsInfo_' + sym + ',', ptr)
        if n != 1:
            raise RuntimeError(f'kunde inte patcha pekartabell för {spec["slot"]}')
    wr(ptr_path, ptr)
    wr(f'{EM}/src/data/object_events/kanto_graphics.h', ''.join(gfx_lines))
    wr(f'{EM}/src/data/object_events/kanto_pic_tables.h', ''.join(pic_lines))
    wr(f'{EM}/src/data/object_events/kanto_graphics_info.h', ''.join(info_lines))
    eom = f'{EM}/src/event_object_movement.c'
    text = rd(eom)
    for inc, after in [('kanto_graphics.h', 'object_event_graphics.h'),
                       ('kanto_pic_tables.h', 'object_event_pic_tables.h'),
                       ('kanto_graphics_info.h', 'object_event_graphics_info.h')]:
        line = f'#include "data/object_events/{inc}"'
        if line not in text:
            text = text.replace(f'#include "data/object_events/{after}"\n', f'#include "data/object_events/{after}"\n{line}\n', 1)
    wr(eom, text)
    marked_block(f'{EM}/include/constants/event_objects.h', '\n'.join(defines), anchor=r'^#endif', before=True)

# ---------------------------------------------------------------- tileset-animationer
def write_tileset_anims():
    src = f'{EM}/data/tilesets/primary/kanto_general/anim'
    if not os.path.isdir(src):
        return
    def frames(sub):
        return sorted(int(f[:-4]) for f in os.listdir(f'{src}/{sub}') if f.endswith('.png'))
    code = ['// Genererad av tools/kanto_import – FireReds General-animationer (blommor, vatten, sandkant)\n']
    for sub, sym in [('flower', 'Flower'), ('water_current_landwatersedge', 'Water'), ('sandwatersedge', 'SandWatersEdge')]:
        fr = frames(sub)
        for i in fr:
            code.append(f'static const u16 sTilesetAnims_KantoGeneral_{sym}_Frame{i}[] = INCBIN_U16("data/tilesets/primary/kanto_general/anim/{sub}/{i}.4bpp");\n')
        code.append(f'static const u16 *const sTilesetAnims_KantoGeneral_{sym}[] = {{\n')
        for i in fr:
            code.append(f'    sTilesetAnims_KantoGeneral_{sym}_Frame{i},\n')
        code.append('};\n\n')
    code.append('''static void QueueAnimTiles_KantoGeneral_Flower(u16 timer)
{
    AppendTilesetAnimToBuffer(sTilesetAnims_KantoGeneral_Flower[timer % ARRAY_COUNT(sTilesetAnims_KantoGeneral_Flower)], (u16 *)(BG_VRAM + TILE_OFFSET_4BPP(508)), 4 * TILE_SIZE_4BPP);
}

static void QueueAnimTiles_KantoGeneral_Water(u16 timer)
{
    AppendTilesetAnimToBuffer(sTilesetAnims_KantoGeneral_Water[timer % ARRAY_COUNT(sTilesetAnims_KantoGeneral_Water)], (u16 *)(BG_VRAM + TILE_OFFSET_4BPP(416)), 48 * TILE_SIZE_4BPP);
}

static void QueueAnimTiles_KantoGeneral_SandWatersEdge(u16 timer)
{
    AppendTilesetAnimToBuffer(sTilesetAnims_KantoGeneral_SandWatersEdge[timer % ARRAY_COUNT(sTilesetAnims_KantoGeneral_SandWatersEdge)], (u16 *)(BG_VRAM + TILE_OFFSET_4BPP(464)), 18 * TILE_SIZE_4BPP);
}

static void TilesetAnim_KantoGeneral(u16 timer)
{
    if (timer % 8 == 0)
        QueueAnimTiles_KantoGeneral_SandWatersEdge(timer / 8);
    if (timer % 16 == 1)
        QueueAnimTiles_KantoGeneral_Water(timer / 16);
    if (timer % 16 == 2)
        QueueAnimTiles_KantoGeneral_Flower(timer / 16);
}

void InitTilesetAnim_KantoGeneral(void)
{
    sPrimaryTilesetAnimCounter = 0;
    sPrimaryTilesetAnimCounterMax = 640;
    sPrimaryTilesetAnimCallback = TilesetAnim_KantoGeneral;
}
''')
    wr(f'{EM}/src/data/kanto/tileset_anims.h', ''.join(code))
    marked_block(f'{EM}/src/tileset_anims.c', '#include "data/kanto/tileset_anims.h"')
    marked_block(f'{EM}/include/tileset_anims.h', 'void InitTilesetAnim_KantoGeneral(void);', anchor=r'^#endif', before=True)

# ---------------------------------------------------------------- main
def main():
    map_names = CFG['maps']
    fr_layouts_all = {l['id']: l for l in load_json(f'{FR}/data/layouts/layouts.json')['layouts'] if l}
    layouts = []
    seen = set()
    for name in map_names:
        d = load_json(f'{FR}/data/maps/{name}/map.json')
        if d['layout'] not in seen:
            seen.add(d['layout'])
            layouts.append(fr_layouts_all[d['layout']])
    tileset_map = build_tilesets(layouts)
    import_layouts(layouts, tileset_map)
    map_ids = import_maps(map_names, fr_layouts_all)
    import_wild(map_ids)
    port_gfx()
    write_tileset_anims()
    write_flag_var_aliases()
    dump_json(ALLOC_PATH, alloc)
    for f in ['tileset_anims', 'tilesets', 'event_object_movement']:
        dp = f'{EM}/build/emerald/src/{f}.d'
        if os.path.exists(dp):
            os.remove(dp)
    report = '\n'.join(log_lines) + '\n'
    wr(os.path.join(ROOT, 'last_report.txt'), report)
    cats = {}
    for l in log_lines:
        cats[l.split(']')[0][1:]] = cats.get(l.split(']')[0][1:], 0) + 1
    print(f'Importerade {len(map_names)} kartor, {len(layouts)} layouter, {len(tileset_map)} tilesets.')
    print('Anmärkningar per kategori:', cats)
    print(f'Fullständig rapport: {os.path.relpath(os.path.join(ROOT, "last_report.txt"), REPO)}')

if __name__ == '__main__':
    main()
