# Pokémon-modifieringar

Det här repot innehåller källkoden till tre Pokémon-spel, hämtad från
pret-projektens dekompileringar/disassemblies, med målet att göra egna
ändringar och bygga spelbara ROM-filer.

| Mapp             | Spel                       | Upstream                                                        | ROM-fil            | Spelas i                        |
|------------------|----------------------------|-----------------------------------------------------------------|--------------------|---------------------------------|
| `pokefirered/`   | Pokémon FireRed (GBA)      | [pret/pokefirered](https://github.com/pret/pokefirered) @ `c75f352` | `pokefirered.gba`  | mGBA, VisualBoyAdvance-M m.fl.  |
| `pokeemerald/`   | Pokémon Emerald (GBA)      | [pret/pokeemerald](https://github.com/pret/pokeemerald) @ `5eff786` | `pokeemerald.gba`  | mGBA, VisualBoyAdvance-M m.fl.  |
| `pokecrystal/`   | Pokémon Crystal (GBC)      | [pret/pokecrystal](https://github.com/pret/pokecrystal) @ `7a7881d`  | `pokecrystal.gbc`  | mGBA, SameBoy, BGB m.fl.        |

## Så bygger du

Varje push till GitHub bygger alla ROM-filer automatiskt. Gå till fliken
**Actions**, öppna senaste körningen och ladda ner artefakten
`pokefirered-gba`, `pokeemerald-gba` eller `pokecrystal-gbc`.

Lokalt (Ubuntu/Debian/WSL):

```bash
./pokefirered/build_rom.sh     # -> pokefirered/pokefirered.gba
./pokeemerald/build_rom.sh     # -> pokeemerald/pokeemerald.gba
./pokecrystal/build_rom.sh     # -> pokecrystal/pokecrystal.gbc
```

Skripten hämtar och bygger kompilatorn/assemblern (agbcc resp. rgbds 1.0.3)
första gången. Manuella instruktioner finns i respektive `INSTALL.md`.

Så länge inga ändringar gjorts matchar byggena originalen:

- `pokefirered.gba` sha1 `41cb23d8dccc8ebd7c649cd8fbb58eeace6e2fdc` (kontrollera med `make compare` i `pokefirered/`)
- `pokeemerald.gba` sha1 `f3ae088181bf583e55daf962a92bb46f4f1d07b7` (kontrollera med `make compare` i `pokeemerald/`)
- `pokecrystal.gbc` sha1 `f4cd194bdee0d04ca4eac29e09b8e4e9d818c133` (kontrollera med `make compare` i `pokecrystal/`)

## Var saker finns i koden

### Pokémon FireRed (`pokefirered/`, skrivet i C)

| Vill du ändra ...                  | Titta i ...                                                       |
|------------------------------------|-------------------------------------------------------------------|
| Startpokémon                       | `data/maps/PalletTown_ProfessorOaksLab/scripts.inc`, `src/data/`  |
| Pokémon-statistik, typer, EV       | `src/data/pokemon/species_info.h`                                 |
| Attacker som Pokémon lär sig       | `src/data/pokemon/level_up_learnsets.h`                           |
| Attackers styrka/effekt            | `src/data/battle_moves.h`                                         |
| Vilda Pokémon per område           | `src/data/wild_encounters.json`                                   |
| Tränare och deras lag              | `src/data/trainers.h`, `src/data/trainer_parties.h`               |
| Föremål (pris, effekt)             | `src/data/items.json`                                             |
| Dialog/text                        | `data/maps/<karta>/text.inc`, `data/text/`                        |
| Kartor och events                  | `data/maps/<karta>/` (redigeras enklast med Porymap)              |
| Grafik (sprites, tiles)            | `graphics/`                                                       |
| Spelmekanik (strid, XP, fångst)    | `src/battle_*.c`, `src/pokemon.c`                                 |
| Musik och ljud                     | `sound/`                                                          |

### Pokémon Emerald (`pokeemerald/`, skrivet i C)

Samma struktur som FireRed. Skillnaderna i tabellen ovan är:

| Vill du ändra ...                  | Titta i ...                                                       |
|------------------------------------|-------------------------------------------------------------------|
| Startpokémon                       | `src/starter_choose.c` (listan `sStarterMon`), `data/maps/Route101/scripts.inc` |
| Föremål (pris, effekt)             | `src/data/items.h`                                                |

Pret har en stor samling färdiga guider för Emerald (många fungerar även på
FireRed): <https://github.com/pret/pokeemerald/wiki/Tutorials>.

### Pokémon Crystal (`pokecrystal/`, skrivet i Game Boy-assembler)

| Vill du ändra ...                  | Titta i ...                                                       |
|------------------------------------|-------------------------------------------------------------------|
| Startpokémon                       | `maps/ElmsLab.asm`                                                |
| Pokémon-statistik, typer           | `data/pokemon/base_stats/<pokemon>.asm`                           |
| Attacker som Pokémon lär sig, evolutioner | `data/pokemon/evos_attacks.asm`                            |
| Attackers styrka/effekt            | `data/moves/moves.asm`                                            |
| Vilda Pokémon per område           | `data/wild/johto_grass.asm`, `kanto_grass.asm`, `*_water.asm`     |
| Tränare och deras lag              | `data/trainers/parties.asm`                                       |
| Föremål (pris, effekt)             | `data/items/attributes.asm`, `data/items/descriptions.asm`        |
| Dialog/text                        | `maps/<karta>.asm`, `data/text/`                                  |
| Kartor och events                  | `maps/<karta>.asm` + `.blk` (redigeras enklast med Polished Map)  |
| Grafik (sprites, tiles)            | `gfx/`                                                            |
| Spelmekanik (strid, XP, fångst)    | `engine/battle/`, `engine/pokemon/`                               |
| Musik och ljud                     | `audio/`                                                          |

Pret har dessutom en bra samling färdiga guider för vanliga ändringar i
Crystal: <https://github.com/pret/pokecrystal/wiki/Tutorials>.


## Kanto i Emerald (steg 1 av sammanslagningen)

Målet är ett spel med Hoenn, Kanto och Johto, byggt på Emerald-motorn. Steg 1 är
att flytta Kantos kartor från FireRed in i `pokeemerald/`. Det görs med
konverteringsverktyget **`tools/kanto_import/import_kanto.py`**.

### Vad verktyget gör

```bash
python3 tools/kanto_import/import_kanto.py     # kör från repo-roten (kräver Pillow)
```

- Läser `tools/kanto_import/config.json` (vilka kartor som ska importeras m.m.).
- **Tilesets:** FireRed delar tiles/metatiles vid 640, Emerald vid 512. Verktyget
  skapar nya Emerald-tilesets (`Kanto*`) genom att flytta FireRed-primärens
  sista 128 tiles/metatiles in i varje sekundärtileset. Tile-index och
  metatile-ID:n blir därmed oförändrade, så kartorna kan kopieras rakt av.
  Metatile-attribut konverteras från FireReds 32-bitarsformat till Emeralds
  16-bitarsformat och beteenden mappas namn för namn (fallbacktabell i configen).
- **Layouter och kartor:** kopieras till `data/layouts/Kanto*` och `data/maps/`,
  med `map.json` översatt (musik → `MUS_RG_*`, sprites, rörelsetyper, flaggor).
- **Flaggor/variabler:** FireReds `FLAG_*`/`VAR_*` får alias till oanvända
  Emerald-flaggor (`include/constants/flags.h`, `vars.h`). Tilldelningen sparas i
  `tools/kanto_import/allocations.json` så att den är stabil mellan körningar.
- **Sprites:** Prof. Oak, Daisy, Blue, Giovanni, Pokédex och Town Map portas till
  Emeralds oanvända sprite-platser. Övriga FireRed-sprites mappas till liknande
  Emerald-sprites.
- **Skript:** konverteras mekaniskt (FireRed-specifika kommandon tas bort,
  okända specials/etiketter loggas, tränarstrider mot FireRed-tränare blir text).
  Rapporten hamnar i `tools/kanto_import/last_report.txt`. Filer med
  `KANTO_IMPORT_BEGIN` på första raden skrivs om vid nästa körning; ta bort raden
  för att handjustera.
- **Vilda Pokémon:** FireReds mötestabeller läggs till i `wild_encounters.json`.
- **Motorändringar i Emerald:** FireReds trappvarpar (gå in i trappan från sidan)
  finns nu som `MB_*_STAIR_WARP` i `field_control_avatar.c`, och FireReds
  General-tileset-animationer (blommor, vatten) i `src/data/kanto/tileset_anims.h`.

### Vad som är importerat och testat i emulator

Pallet Town, Route 1, Viridian City samt interiörerna (spelarens hus 1F/2F,
rivalens hus, Oaks labb, Viridians hus, gym, skola, mart och Pokémon Center).
Kantos vilda Pokémon dyker upp på Route 1.

Koppling Hoenn ↔ Kanto: en sjöman i Littleroot Town (nedanför husen) seglar till
Pallet Town, och en sjöman i Pallet Town seglar tillbaka. Prof. Oak i labbet ger
en Kanto-starter (Bulbasaur, Charmander eller Squirtle).

Handjusterade skript: `PalletTown`, `Route1`, `ViridianCity`, `ViridianCity_School`,
`PalletTown_PlayersHouse_2F`, `PalletTown_ProfessorOaksLab` (helt omskrivet) och
`data/kanto/hoenn_hooks.inc` (sjömännen).

### Kända begränsningar just nu

- Route 2, Route 21, Route 22 och resten av Kanto är inte importerade än, så
  Viridian City saknar norra/västra utgångar. Att importera fler kartor är i
  huvudsak att lägga till dem i `config.json`, köra verktyget och handjustera
  skript som rapporten pekar ut.
- Gymtränarna i Viridian pratar bara (FireReds tränardata är inte portad).
- Regionkartan, Fly och Pokémon Center-respawn (`setrespawn`) för Kanto saknas.
- Lediga flaggor/variabler i Emerald räcker för några städer, inte hela Kanto.
  Save-blocket behöver utökas längre fram.
- Dörr- och trappanimationer från FireRed spelas inte upp (varpen fungerar).

## Ändringslogg

- **Emerald:** Kanto-import steg 1 – Pallet Town, Route 1, Viridian City med
  interiörer importerade från FireRed, sjömän mellan Littleroot och Pallet Town,
  Prof. Oak delar ut Kanto-starter. Se avsnittet ovan. FireRed och Crystal är
  oförändrade.
