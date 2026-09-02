# Pokémon-romhack: Johto → Kanto → Hoenn

Svara på **svenska**. Det här repot bygger ett Pokémon-romhack för Game Boy Advance.

## Vad projektet ska bli

Ett spel där storyn **börjar i Johto** (som i Pokémon Crystal), fortsätter
naturligt till **Kanto** efter Elite 4 (också som i Crystal), och avslutas med
en **ny story i Hoenn** som återanvänder Emeralds gym, tränare, legendarer och
Elite 4 men med egen handling, knuten till samma protagonist som startade i Johto.

Fattade beslut (ändra inte utan att fråga):

| Beslut | Val |
|---|---|
| Motor | pokeemerald-expansion (RHH) |
| Kantos kartor | Byggs om från **Crystals** layouter, inte FireReds |
| Musik | Crystals musik konverteras till GBA-format |
| Spelarkaraktär | Egen karaktärseditor för kläder, huvud- och kroppstyp |

## Repots struktur

| Mapp | Vad |
|---|---|
| `pokeemerald-expansion/` | **Spelet vi bygger.** RHH-expansion av Emerald |
| `pokecrystal/` | Referenskopia av Crystal. Källa för kartor, story, musik |
| `pokefirered/` | Referenskopia av FireRed. Källa för grafik och sprites |
| `story/milestones.json` | **Storyn definieras här:** flaggor och testpunkter |
| `tools/story/` | Genererar story-flaggor och testpunkter till spelet |
| `tools/crystal_import/` | Konverterar Crystal-kartor till Emerald-format |
| `tools/emulator_test/` | Kör spelet headless i mGBA för automatiska tester |

`pokecrystal/` och `pokefirered/` byggs som egna spel av GitHub-workflowen men
är i övrigt bara källmaterial. Ändra dem inte.

## Bygga och testa

```bash
./pokeemerald-expansion/build_rom.sh          # -> pokeemerald-expansion/pokeemerald.gba
```

Skriptet kör `tools/story/gen_story.py` först, sedan `make`. Ett fullständigt
bygge tar flera minuter; ändringar i enstaka filer går snabbt.

Beroenden (Ubuntu/Debian/WSL):

```bash
sudo apt install build-essential binutils-arm-none-eabi gcc-arm-none-eabi \
  libnewlib-arm-none-eabi libpng-dev python3 python3-pip git
pip3 install pillow
```

I spelet:

- **Select** på titelskärmen = snabbstart, hoppar över introt
- **R + Start** = debugmeny → *Utilities…* → *Story checkpoints…* för att hoppa
  till valfri punkt i storyn
- Båda stängs av automatiskt i release-byggen (`make RELEASE=1`)

Headless-test i emulator: se `tools/emulator_test/README.md`.

## Arbetsflöde

- **Kartor, byggnader, NPC:er, varpar, skyltar, vilda Pokémon:** redigeras
  visuellt i [Porymap](https://github.com/huderlem/porymap). Öppna mappen
  `pokeemerald-expansion/` som projekt.
- **Story, låsningar och testpunkter:** redigeras i `story/milestones.json`,
  därefter `python3 tools/story/gen_story.py`.
- **Nya kartor från Crystal:** lägg till i `tools/crystal_import/config.json`,
  kör `python3 tools/crystal_import/import_crystal.py`.

## Viktigt att veta

- **Genererade block.** Verktygen skriver in sig i befintliga Emerald-filer
  mellan markörer (`STORY_GEN_BEGIN`/`END`, `CRYSTAL_IMPORT_BEGIN`/`END`).
  Redigera inte innehållet mellan markörerna för hand, det skrivs över.
- **Handjusterade kartskript.** En genererad `scripts.inc` har
  `@ CRYSTAL_IMPORT_BEGIN` på första raden. Ta bort den raden om du vill
  handjustera filen, då lämnar verktyget den ifred.
- **Flaggor och variabler.** Både `tools/story` och `tools/crystal_import`
  delar ut oanvända Emerald-flaggor. Tilldelningarna sparas i
  `flag_allocations.json` respektive `allocations.json` så att de är stabila.
  Poolen är begränsad; när den tar slut måste save-blocket utökas.
- **MAPSEC-indexerade tabeller.** Nya regioner ger kartsektioner utanför
  Emeralds tabeller. `src/map_name_popup.c` är redan lagad med en
  gränskontroll; samma problem kan finnas i annan MAPSEC-indexerad kod.
- **Bygg och testa efter varje ändring.** Ett bygge som länkar kan ändå krascha
  i emulatorn, särskilt vid ny kart- eller tileset-data.

## Nuvarande status

Klart:

- Basen bytt till pokeemerald-expansion, bygger rent
- Story-milstolpar och testpunkter fungerar, verifierat i emulator
- Crystal-konverteraren importerar 14 Johto-kartor: New Bark Town med alla hus
  och Elms labb, Route 29 med grinden, Cherrygrove City med Pokémon Center,
  mart och de tre husen

**Aktivt problem:** testpunkten *Johto: New Bark Town* kraschar när kartan
laddas. ROM:en kompilerar och länkar utan fel, så felet ligger i datan som
`tools/crystal_import/import_crystal.py` skriver. Undersök i den här ordningen:

1. Tileset-paletter: Emerald väntar 16 paletter à 16 färger. Primärt tileset
   använder palett 0–5, sekundärt 6–12.
2. Antal tiles i `tiles.png` mot `-num_tiles` i `src/data/tilesets/crystal_graphics.h`,
   och att primärtileset inte överskrider 512 tiles.
3. Metatile-indexering: metatile-ID i primärt tileset måste vara under 512, och
   varje metatile är 8 st u16 (4 bottenlager + 4 topplager).
4. Att `data/layouts/layouts.json` stämmer med `map.bin` (2 byte per metatile,
   bredd × höjd).

Kvar därefter: resten av Johto, GSC-Kanto, Hoenn-storyn, karaktärseditorn och
musikkonverteringen.

Fullständig beskrivning finns i `MODIFIERINGAR.md`.
