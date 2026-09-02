# Fortsätt projektet lokalt i Claude Code

## Så kommer du igång

```bash
git clone https://github.com/oscardenvise/eseightchar-rms-m4nu4l-2025-x91.git
cd eseightchar-rms-m4nu4l-2025-x91
git checkout claude/pokemon-game-modification-rog9ez
claude
```

Beroenden (Ubuntu/Debian/WSL):

```bash
sudo apt install build-essential binutils-arm-none-eabi gcc-arm-none-eabi \
  libnewlib-arm-none-eabi libpng-dev python3 python3-pip git
pip3 install pillow
```

Bygg spelet:

```bash
./pokeemerald-expansion/build_rom.sh      # -> pokeemerald-expansion/pokeemerald.gba
```

Visuell kartredigering: installera [Porymap](https://github.com/huderlem/porymap)
och öppna mappen `pokeemerald-expansion/` som projekt.

## Klistra in det här i Claude Code

Prompten nedan ger Claude hela sammanhanget.

---

Jag bygger ett Pokémon-romhack i det här repot. Läs `MODIFIERINGAR.md` först,
den beskriver hela projektet. Svara på svenska.

**Målet:** ett spel som börjar i Johto (som i Crystal), fortsätter till Kanto
efter Elite 4, och avslutas med en ny story i Hoenn som återanvänder Emeralds
gym, tränare, legendarer och Elite 4. Motorn är pokeemerald-expansion (RHH).

**Repots struktur:**
- `pokeemerald-expansion/` – spelet vi bygger (RHH-expansion av Emerald)
- `pokecrystal/`, `pokefirered/` – källor för kartor, grafik, musik och story
- `tools/crystal_import/` – konverterar Crystal-kartor till Emerald-format
- `tools/story/gen_story.py` – genererar story-flaggor och testpunkter
- `story/milestones.json` – här bestämmer vi storyn
- `PROMPT_LOKALT.md` – den här filen

**Arbetsflöde:**
- Kartor och NPC:er redigeras visuellt i Porymap.
- Story och testpunkter redigeras i `story/milestones.json`, sedan
  `python3 tools/story/gen_story.py`.
- Bygg med `./pokeemerald-expansion/build_rom.sh`.
- I spelet: Select på titelskärmen = snabbstart, R + Start = debugmeny,
  där Utilities → Story checkpoints hoppar till valfri punkt i storyn.

**Nästa uppgift:** testpunkten *Johto: New Bark Town* kraschar när kartan
laddas. ROM:en byggs utan fel, men spelet hänger sig vid inladdning.
Felsök det. Troliga orsaker att undersöka i `tools/crystal_import/import_crystal.py`:

1. Tileset-paletternas format eller antal (Emerald väntar 16 paletter à 16 färger,
   primärt tileset använder palett 0–5, sekundärt 6–12).
2. Antalet tiles i `tiles.png` mot `-num_tiles` i `crystal_graphics.h`, och att
   primärtileset inte överskrider 512 tiles.
3. Metatile-indexering: metatiles i primärt tileset måste vara < 512, och
   varje metatile är 8 st u16 (4 bottenlager + 4 topplager).
4. Att `data/layouts/layouts.json` har rätt `layout_version` och att kartornas
   bredd/höjd matchar `map.bin` (2 byte per metatile).

Bygg om och testa i emulator efter varje ändring. När Johto-kartorna funkar,
fortsätt importera resten av Johto genom att lägga till kartor i
`tools/crystal_import/config.json`.
