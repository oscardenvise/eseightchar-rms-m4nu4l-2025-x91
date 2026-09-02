#!/usr/bin/env bash
# Bygger pokecrystal.gbc från källkoden i det här repot.
#
# Kräver (Ubuntu/Debian/WSL):
#   sudo apt install build-essential bison libpng-dev pkg-config git
#
# Första körningen hämtar och bygger assemblern rgbds 1.0.3 automatiskt
# (den läggs i ../rgbds och installeras inte globalt).
set -euo pipefail
cd "$(dirname "$0")"

RGBDS_VERSION=v1.0.3
RGBDS_DIR=../rgbds

if [ ! -x "$RGBDS_DIR/rgbasm" ]; then
  echo ">> rgbds saknas, hämtar och bygger $RGBDS_VERSION (görs bara en gång)..."
  if [ ! -d "$RGBDS_DIR" ]; then
    git clone --depth 1 --branch "$RGBDS_VERSION" https://github.com/gbdev/rgbds.git "$RGBDS_DIR"
  fi
  make -C "$RGBDS_DIR" -j"$(nproc)"
fi

echo ">> Bygger pokecrystal.gbc ..."
make RGBDS="$RGBDS_DIR/" -j"$(nproc)" "$@"
echo ">> Klart: $(pwd)/pokecrystal.gbc"
