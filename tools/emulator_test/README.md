# Testrigg: kör spelet headless i mGBA

Används för att testa ROM:en utan skärm, t.ex. i en molnsession eller i CI.
Kräver `mgba-sdl`, `xvfb`, `xdotool` och `scrot`:

```bash
sudo apt install mgba-sdl xvfb xdotool scrot
```

## Starta

```bash
tools/emulator_test/run.sh pokeemerald-expansion/pokeemerald.gba
```

Skriptet startar en virtuell skärm (Xvfb på `:99`), kör mGBA med GDB-stubben
påslagen och startar `gdbd.py` som håller anslutningen öppen.

## Kommandon

| Kommando | Vad det gör |
|---|---|
| `tools/emulator_test/key.sh <tangent> [antal] [paus_ms] [håll_ms]` | Skickar knapptryck |
| `tools/emulator_test/pos.sh` | Skriver ut karta (grupp, nummer) och spelarens position |
| `tools/emulator_test/regs.sh` | Dumpar CPU-register (för kraschanalys) |
| `DISPLAY=:99 scrot -o bild.png` | Tar en skärmdump |

Tangenter i mGBA: `x` = A, `z` = B, `Return` = Start, `BackSpace` = Select,
`s` = R, `a` = L, piltangenter = styrkors, `Tab` = snabbspolning.

**Viktigt:** varje knapptryck måste hållas i minst ~70 ms, annars hinner spelet
(60 Hz) inte läsa det. `key.sh` gör det åt dig, håll inte via `xdotool key`.

## Kraschanalys

```bash
tools/emulator_test/regs.sh > regs.txt
arm-none-eabi-addr2line -f -e pokeemerald-expansion/pokeemerald.elf 0x<r15-värdet>
```

`gdbd.py` läser spelarens position ur `gSaveBlock1Ptr`. Adressen står i
`pokeemerald-expansion/pokeemerald.map` och sätts automatiskt av `run.sh`.
