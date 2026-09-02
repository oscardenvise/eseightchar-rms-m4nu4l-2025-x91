#!/usr/bin/env bash
# pos.sh – skriver ut aktuell karta och spelarposition
cd "$(dirname "$0")"; rm -f gdbd.out; echo pos > gdbd.cmd
for _ in $(seq 1 50); do [ -f gdbd.out ] && { cat gdbd.out; exit 0; }; sleep 0.1; done
echo "timeout"
