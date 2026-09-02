#!/usr/bin/env bash
# run.sh <rom.gba> – startar mGBA headless med GDB-stubb och positionsavläsning.
set -euo pipefail
cd "$(dirname "$0")"
ROM=$(realpath "${1:-../../pokeemerald-expansion/pokeemerald.gba}")
MAP="${ROM%.gba}.map"
export DISPLAY=:99

# gSaveBlock1Ptr-adressen ur länkkartan, så att pos.sh vet var den ska leta
if [ -f "$MAP" ]; then
  ADDR=$(grep -E "^\s+0x[0-9a-f]+\s+gSaveBlock1Ptr$" "$MAP" | awk '{print $1}' | head -1)
  [ -n "$ADDR" ] && sed -i "s/^SB1PTR = .*/SB1PTR = $ADDR/" gdbd.py
fi

pkill -x mgba 2>/dev/null || true
pkill -xf "python3 gdbd.py" 2>/dev/null || true
pgrep -x Xvfb >/dev/null || (Xvfb :99 -screen 0 800x600x24 >/dev/null 2>&1 &)
sleep 1
(SDL_AUDIODRIVER=dummy nohup /usr/games/mgba -3 -g -C logLevel=0 "$ROM" >mgba.log 2>&1 &)
sleep 3
rm -f gdbd.cmd gdbd.out
(nohup python3 gdbd.py >gdbd.log 2>&1 &)
sleep 3
echo "mGBA kör med $ROM. Använd key.sh, pos.sh och regs.sh."
