# Pokémon-modifieringar

Det här repot innehåller källkoden till tre Pokémon-spel. `pokeemerald-expansion/` är själva spelet vi bygger; FireRed och Crystal är källor för kartor, grafik, musik och story, hämtad från
pret-projektens dekompileringar/disassemblies, med målet att göra egna
ändringar och bygga spelbara ROM-filer.

| Mapp             | Spel                       | Upstream                                                        | ROM-fil            | Spelas i                        |
|------------------|----------------------------|-----------------------------------------------------------------|--------------------|---------------------------------|
| `pokefirered/`   | Pokémon FireRed (GBA)      | [pret/pokefirered](https://github.com/pret/pokefirered) @ `c75f352` | `pokefirered.gba`  | mGBA, VisualBoyAdvance-M m.fl.  |
| `pokeemerald-expansion/` | **Huvudprojektet.** Emerald-motorn med RHH:s expansion | [rh-hideout/pokeemerald-expansion](https://github.com/rh-hideout/pokeemerald-expansion) @ `fbe12db` | `pokeemerald.gba` | mGBA, VisualBoyAdvance-M m.fl. |
| `pokecrystal/`   | Pokémon Crystal (GBC)      | [pret/pokecrystal](https://github.com/pret/pokecrystal) @ `7a7881d`  | `pokecrystal.gbc`  | mGBA, SameBoy, BGB m.fl.        |

## Så bygger du

Varje push till GitHub bygger alla ROM-filer automatiskt. Gå till fliken
**Actions**, öppna senaste körningen och ladda ner artefakten
`pokefirered-gba`, `pokeemerald-gba` eller `pokecrystal-gbc`.

Lokalt (Ubuntu/Debian/WSL):

```bash
./pokefirered/build_rom.sh     # -> pokefirered/pokefirered.gba
./pokeemerald-expansion/build_rom.sh   # -> pokeemerald-expansion/pokeemerald.gba (kräver gcc-arm-none-eabi)
./pokecrystal/build_rom.sh     # -> pokecrystal/pokecrystal.gbc
```

Skripten hämtar och bygger kompilatorn/assemblern (agbcc resp. rgbds 1.0.3)
första gången. Manuella instruktioner finns i respektive `INSTALL.md`.

Så länge inga ändringar gjorts matchar byggena originalen:

- `pokefirered.gba` sha1 `41cb23d8dccc8ebd7c649cd8fbb58eeace6e2fdc` (kontrollera med `make compare` i `pokefirered/`)
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

### Pokémon Emerald (`pokeemerald-expansion/`, skrivet i C)

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


## Planen: ett spel med Johto, Kanto och Hoenn

Storyn börjar i Johto (som i Crystal), fortsätter naturligt till Kanto efter
Elite 4, och avslutas med en ny story i Hoenn som använder Emeralds gym,
tränare, legendarer och Elite 4. Motorn är **pokeemerald-expansion** (RHH).

Varför expansion: den har redan utökade flaggor, 16-bitars sprite-ID:n,
dag/natt med riktig klocka, mötestabeller per tid på dygnet (Johto!), alla
Pokémon, en debugmeny, och **alla FireRed-kartor och Kanto-tilesets i
GBA-format** (byggs i dag bara som FireRed-version, men datan finns).

### Arbetsflöde

| Vad | Verktyg |
|---|---|
| Kartor, byggnader, städer, NPC:er, varpar, skyltar, vilda Pokémon | **[Porymap](https://github.com/huderlem/porymap)** – öppna mappen `pokeemerald-expansion/` som projekt |
| Story: milstolpar, låsningar och testpunkter | `story/milestones.json` + `python3 tools/story/gen_story.py` (se nedan) |
| Testa från en viss punkt i spelet | I spelet: håll **R** och tryck **Start** → *Utilities…* → *Story checkpoints…* |
| Hoppa över introt vid test | På titelskärmen: tryck **Select** (Quickstart) |
| Övrig debug (ge Pokémon/items, sätt flaggor, varpa) | Samma debugmeny (R + Start) |
| Karaktärseditor (kläder, huvud, kropp) | Kommer – egen editor som skriver Emerald-sprites |
| Crystals musik i GBA-format | Kommer – konverterare från pokecrystals ljuddata till `mid2agb` |
| Johto- och Kanto-kartor från Crystals layouter | Kommer – konverterare med block→metatile-tabeller per tileset |

Debugmenyn och Quickstart är avstängda i release-byggen automatiskt.

### Storyfilen `story/milestones.json`

Här bestämmer vi storyn. Två delar:

- **`story_flags`** – flaggor som skripten använder för att låsa och öppna
  spelet, t.ex. `FLAG_STORY_KANTO_UNLOCKED`. Generatorn ger dem lediga
  flaggnummer och skriver `FLAG_STORY_*` in i `include/constants/flags.h`.
  I ett kartskript blir en låst väg t.ex.
  `goto_if_unset FLAG_STORY_KANTO_UNLOCKED, Route_EventScript_RoadClosed`.
- **`checkpoints`** – testpunkter. Varje punkt beskriver spelläget: flaggor,
  variabler, antal badges, lag, föremål, Pokédex och var spelaren står. En punkt
  kan bygga på en annan med `includes`. Generatorn gör ett skript per punkt och
  lägger dem i debugmenyn.

Kör `python3 tools/story/gen_story.py` efter ändringar (GitHub-bygget och
`build_rom.sh` gör det automatiskt). Tilldelade flaggnummer sparas i
`tools/story/flag_allocations.json`.

### Status

- Repot bytte bas till pokeemerald-expansion. Den tidigare Kanto-importen till
  vanliga pokeemerald är borttagen eftersom expansion redan innehåller
  FireReds kartor och tilesets (finns kvar i git-historiken).
- Milstolpesystemet finns med fyra Hoenn-testpunkter som platshållare tills
  Johto-kartorna finns.


## Johto från Crystal (pågående)

`tools/crystal_import/import_crystal.py` konverterar kartor från `pokecrystal/`
(Game Boy Color) till pokeemerald-expansion.

```bash
python3 tools/crystal_import/import_crystal.py    # kör från repo-roten (kräver Pillow)
```

Hur den fungerar:

- **Block → metatiles.** Ett Crystal-block är 32x32 pixlar (4x4 tiles). Emerald
  har 16x16-metatiles, så varje block blir 2x2 metatiles. Kartans storlek
  dubbleras därför i båda led.
- **Grafik.** Crystals tiles behålls pixel för pixel. GBC har 4 färger per
  palett, GBA 16, så tre GBC-paletter packas i varje GBA-palett. Utseendet blir
  alltså GBC-likt tills vi ritar om tilesetet i Emerald-stil. Dag-paletterna
  används; natt-paletterna finns i Crystal och kan kopplas till expansionens
  dag/natt-system senare.
- **Kollision.** Crystals kollisionsvärden (`COLL_*`) mappas till Emeralds
  beteenden (`MB_*`) via `collision_map` i configen. Höjd sätts automatiskt:
  spärrat 0, vatten 1, mark 3, med kant mot vatten som 0.
- **Events.** Varpar, skyltar, NPC:er och triggers översätts. NPC-skript blir
  tills vidare textrutor med Crystals dialog. Tränarstrider blir vanliga NPC:er.
- **Flaggor och variabler.** Crystals `EVENT_*` och scen-ID:n får alias till
  oanvända Emerald-flaggor/variabler (`tools/crystal_import/allocations.json`).
- **Vilda Pokémon.** Crystals dag-tabeller läggs in i `wild_encounters.json`.

Importerat hittills: New Bark Town, spelarens hus 1F/2F, Elms labb, Elms hus,
grannens hus, Route 29 med grinden, Cherrygrove City med Pokémon Center, mart
och de tre husen.

**Känt problem:** ROM:en byggs, men testpunkten *Johto: New Bark Town* kraschar
när kartan laddas. Felsökning pågår; troligen tileset- eller metatile-data som
inte matchar Emeralds förväntningar (paletter, antal tiles eller
metatile-indexering).


## Ändringslogg

- **Johto-import från Crystal** påbörjad: konverterare, 14 kartor, ny testpunkt.
  Kraschar när Johto-kartan laddas (under felsökning).
- **Byte till pokeemerald-expansion** som huvudprojekt. Story-milstolpar och
  testpunkter via `story/milestones.json` och en ny post i debugmenyn.
- *(Tidigare)* Kanto-import steg 1 till vanliga pokeemerald: Pallet Town,
  Route 1, Viridian City. Ersatt av expansions inbyggda FireRed-data.
