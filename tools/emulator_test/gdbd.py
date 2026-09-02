#!/usr/bin/env python3
"""Håller en permanent GDB-anslutning till mGBA (-g). Kommandon via fil:
   skriv 'pos' till gdbd.cmd -> svar i gdbd.out"""
import socket, time, re, struct, os, sys
SB1PTR = 0x030051c4  # gSaveBlock1Ptr; sätts automatiskt av run.sh ur .map-filen
s = socket.create_connection(('127.0.0.1', 2345), timeout=5); time.sleep(0.2)
def pkt(d): s.sendall(f'${d}#{sum(d.encode())&0xff:02x}'.encode())
def rx(timeout=2):
    s.settimeout(timeout); buf=b''
    while True:
        try: b = s.recv(4096)
        except Exception: return None
        if not b: return None
        buf += b
        m = re.search(rb'\$([^#]*)#[0-9a-fA-F]{2}', buf)
        if m: s.sendall(b'+'); return m.group(1).decode()
def mem(addr, n):
    pkt(f'm{addr:x},{n:x}'); return bytes.fromhex(rx())
pkt('?'); rx(); pkt('c')
open('gdbd.out','w').write('running\n')
while True:
    if os.path.exists('gdbd.cmd'):
        cmd = open('gdbd.cmd').read().strip(); os.remove('gdbd.cmd')
        s.sendall(b'\x03'); time.sleep(0.15); rx()
        if cmd == 'regs':
            pkt('g'); regs = rx()
            vals = [struct.unpack('<I', bytes.fromhex(regs[i*8:i*8+8]))[0] for i in range(16)]
            open('gdbd.out','w').write(' '.join(f'r{i}={v:08x}' for i, v in enumerate(vals)) + '\n')
            pkt('c'); continue
        sb1 = struct.unpack('<I', mem(SB1PTR, 4))[0]
        d = mem(sb1, 12); x, y = struct.unpack_from('<hh', d, 0); grp, num = struct.unpack_from('<bb', d, 4)
        open('gdbd.out','w').write(f'map group={grp} num={num} pos=({x},{y})\n')
        pkt('c')
    time.sleep(0.1)
