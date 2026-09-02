#!/usr/bin/env bash
# regs.sh – dumpar CPU-register (r15 = programräknaren, användbar vid krasch)
cd "$(dirname "$0")"; rm -f gdbd.out; echo regs > gdbd.cmd
for _ in $(seq 1 50); do [ -f gdbd.out ] && { cat gdbd.out; exit 0; }; sleep 0.1; done
echo "timeout"
