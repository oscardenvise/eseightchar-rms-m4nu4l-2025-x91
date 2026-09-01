# Modifieringar

Det här repot är en kopia av [pret/pokefirered](https://github.com/pret/pokefirered)
(den dekompilerade källkoden till Pokémon FireRed/LeafGreen), utgående från
upstream-commit `c75f352304d529f6ba92d4f74b9cf8b5c3810788`.

Målet är att göra egna ändringar i spelet och bygga en spelbar `.gba`-fil.

## Så bygger du

```bash
./build_rom.sh            # bygger pokefirered.gba
```

eller manuellt enligt [INSTALL.md](INSTALL.md). Varje push till GitHub bygger
också ROM:en automatiskt (se fliken *Actions*, artefakten `pokefirered-gba`).

Så länge inga ändringar gjorts matchar bygget originalet:
`sha1: 41cb23d8dccc8ebd7c649cd8fbb58eeace6e2fdc` (kontrollera med `make compare`).

## Var saker finns i koden

| Vill du ändra ...                  | Titta i ...                                              |
|------------------------------------|----------------------------------------------------------|
| Startpokémon                       | `data/maps/PalletTown_ProfessorOaksLab/scripts.inc`, `src/data/`  |
| Pokémon-statistik, typer, EV       | `src/data/pokemon/species_info.h`                        |
| Attacker som Pokémon lär sig       | `src/data/pokemon/level_up_learnsets.h`                  |
| Attackers styrka/effekt            | `src/data/battle_moves.h`                                |
| Vilda Pokémon per område           | `src/data/wild_encounters.json`                          |
| Tränare och deras lag              | `src/data/trainers.h`, `src/data/trainer_parties.h`      |
| Föremål (pris, effekt)             | `src/data/items.json`                                    |
| Dialog/text                        | `data/maps/<karta>/text.inc`, `data/text/`               |
| Kartor och events                  | `data/maps/<karta>/` (redigeras enklast med Porymap)     |
| Grafik (sprites, tiles)            | `graphics/`                                              |
| Spelmekanik (strid, XP, fångst)    | `src/battle_*.c`, `src/pokemon.c`                        |
| Musik och ljud                     | `sound/`                                                 |

## Ändringslogg

*Inga ändringar än – bygget är identiskt med originalet.*
