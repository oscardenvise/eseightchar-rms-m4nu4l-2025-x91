#!/usr/bin/env python3
"""
Genererar story-flaggor och testpunkter (checkpoints) från story/milestones.json
in i pokeemerald-expansion.

  python3 tools/story/gen_story.py        # kör från repo-roten

Skapar/uppdaterar:
  include/constants/story_flags.h       FLAG_STORY_* (alias till oanvända flaggor)
  data/scripts/story_checkpoints.inc    ett event-skript per checkpoint
  src/data/story_checkpoints.h          debugmenyns lista
samt markerade block i include/constants/flags.h, data/event_scripts.s och src/debug.c.
Idempotent: kan köras om när som helst.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(ROOT, '..', '..'))
GAME = os.path.join(REPO, 'pokeemerald-expansion')
MILESTONES = os.path.join(REPO, 'story', 'milestones.json')
ALLOC = os.path.join(ROOT, 'flag_allocations.json')
BEGIN, END = 'STORY_GEN_BEGIN', 'STORY_GEN_END'

def rd(p): return open(p, encoding='utf-8').read()
def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(s)

def marked_block(path, content, comment='//', anchor=None, before=False):
    text = rd(path)
    block = f'{comment} {BEGIN}\n{content.rstrip()}\n{comment} {END}\n'
    pat = re.compile(re.escape(comment) + ' ' + BEGIN + r'\n.*?' + re.escape(comment) + ' ' + END + r'\n', re.S)
    if pat.search(text):
        text = pat.sub(lambda m: block, text)
    else:
        m = re.search(anchor, text, re.M)
        if not m: raise RuntimeError(f'hittade inte {anchor!r} i {path}')
        pos = m.start() if before else m.end()
        text = text[:pos] + block + ('\n' if before else '') + text[pos:] if before else text[:pos] + '\n' + block + text[pos:]
    wr(path, text)

def main():
    data = json.load(open(MILESTONES, encoding='utf-8'))
    flags_h = f'{GAME}/include/constants/flags.h'
    clean = re.sub(r'// ' + BEGIN + r'\n.*?// ' + END + r'\n', '', rd(flags_h), flags=re.S)
    existing = set(re.findall(r'#define (FLAG_\w+)', clean))
    pool = [n for n in re.findall(r'#define (FLAG_UNUSED_0x[0-9A-Fa-f]+)', clean)]
    alloc = json.load(open(ALLOC)) if os.path.exists(ALLOC) else {}
    used = set(alloc.values())
    for f in data.get('story_flags', []):
        name = f['name']
        if name in existing or name in alloc: continue
        cand = next(p for p in pool if p not in used)
        alloc[name] = cand; used.add(cand)
    json.dump(alloc, open(ALLOC, 'w'), indent=2)
    lines = ['// Story-flaggor från story/milestones.json (genererat av tools/story/gen_story.py)']
    for f in data.get('story_flags', []):
        lines.append(f'#define {f["name"]:<40} {alloc[f["name"]]} // {f.get("beskrivning", "")}')
    marked_block(flags_h, '\n'.join(lines), anchor=r'^#endif // GUARD_', before=True)

    # checkpoints
    cps = {c['id']: c for c in data['checkpoints']}
    def actions(c, seen):
        out = []
        for inc in c.get('includes', []):
            if inc in seen: continue
            seen.add(inc); out += actions(cps[inc], seen)
        for fl in c.get('flags_set', []): out.append(f'\tsetflag {fl}')
        for fl in c.get('flags_clear', []): out.append(f'\tclearflag {fl}')
        for k, v in c.get('vars', {}).items(): out.append(f'\tsetvar {k}, {v}')
        for i in range(1, c.get('badges', 0) + 1): out.append(f'\tsetflag FLAG_BADGE0{i}_GET')
        if c.get('pokedex'):
            out += ['\tsetflag FLAG_SYS_POKEDEX_GET', '\tspecial SetUnlockedPokedexFlags']
        if c.get('national_dex'):
            out += ['\tsetflag FLAG_SYS_NATIONAL_DEX', '\tspecial EnableNationalPokedex']
        if c.get('running_shoes'):
            out += ['\tsetflag FLAG_RECEIVED_RUNNING_SHOES', '\tsetflag FLAG_SYS_B_DASH']
        for m in c.get('party', []):
            out.append(f'\tgivemon {m["species"]}, {m["level"]}, {m.get("item", "ITEM_NONE")}')
        for it in c.get('items', []):
            out.append(f'\tadditem {it["item"]}, {it.get("count", 1)}')
        out += ['\t' + r for r in c.get('raw', [])]
        return out
    inc = ['@ Genererat av tools/story/gen_story.py från story/milestones.json – ändra inte för hand.', '']
    hdr = ['// Genererat av tools/story/gen_story.py från story/milestones.json – ändra inte för hand.']
    menu = ['static const struct DebugMenuOption sDebugMenu_Actions_Story[] =', '{']
    for c in data['checkpoints']:
        label = 'Story_Checkpoint_' + re.sub(r'\W', '_', c['id'])
        inc.append(f'{label}::')
        inc += actions(c, set())
        w = c.get('warp')
        if w:
            inc += [f'\twarp {w["map"]}, {w["x"]}, {w["y"]}', '\twaitstate']
        inc += ['\treleaseall', '\tend', '']
        hdr.append(f'extern const u8 {label}[];')
        menu.append(f'    {{ COMPOUND_STRING("{c["name"]}"), DebugAction_ExecuteScript, {label} }},')
    menu += ['    { NULL }', '};']
    wr(f'{GAME}/data/scripts/story_checkpoints.inc', '\n'.join(inc))
    wr(f'{GAME}/src/data/story_checkpoints.h', '\n'.join(hdr + [''] + menu) + '\n')
    marked_block(f'{GAME}/data/event_scripts.s', '\t.include "data/scripts/story_checkpoints.inc"', comment='@',
                 anchor=r'^\t\.include "data/scripts/debug\.inc"$')
    dbg = f'{GAME}/src/debug.c'
    marked_block(dbg, '#include "data/story_checkpoints.h"', anchor=r'^static const struct DebugMenuOption sDebugMenu_Actions_Utilities\[\]', before=True)
    text = rd(dbg)
    entry = '    { COMPOUND_STRING("Story checkpoints…"),      DebugAction_OpenSubMenu, sDebugMenu_Actions_Story }, // STORY_MENU_ENTRY'
    if '// STORY_MENU_ENTRY' not in text:
        text = re.sub(r'(    \{ COMPOUND_STRING\("Cheat start"\),[^\n]*\n)', lambda m: m.group(1) + entry + '\n', text, count=1)
        wr(dbg, text)
    print(f'{len(data["checkpoints"])} checkpoints, {len(data.get("story_flags", []))} story-flaggor.')

if __name__ == '__main__':
    main()
