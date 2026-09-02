#!/usr/bin/env bash
# Bygger pokeemerald.gba (pokeemerald-expansion, modern GCC-toolchain).
#
# Kräver (Ubuntu/Debian/WSL):
#   sudo apt install build-essential binutils-arm-none-eabi gcc-arm-none-eabi libnewlib-arm-none-eabi libpng-dev python3
set -euo pipefail
cd "$(dirname "$0")"
python3 ../tools/story/gen_story.py
echo ">> Bygger pokeemerald.gba (expansion) ..."
make -j"$(nproc)" "$@"
echo ">> Klart: $(pwd)/pokeemerald.gba"
