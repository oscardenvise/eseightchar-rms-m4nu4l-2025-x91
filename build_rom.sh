#!/usr/bin/env bash
# Bygger pokefirered.gba från källkoden i det här repot.
#
# Kräver (Ubuntu/Debian/WSL):
#   sudo apt install build-essential binutils-arm-none-eabi git libpng-dev
#
# Första körningen hämtar och bygger kompilatorn agbcc automatiskt.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x tools/agbcc/bin/agbcc ]; then
  echo ">> agbcc saknas, hämtar och bygger den (görs bara en gång)..."
  if [ ! -d ../agbcc ]; then
    git clone --depth 1 https://github.com/pret/agbcc.git ../agbcc
  fi
  (cd ../agbcc && ./build.sh && ./install.sh "$OLDPWD")
fi

echo ">> Bygger pokefirered.gba ..."
make -j"$(nproc)" "$@"
echo ">> Klart: $(pwd)/pokefirered.gba"
