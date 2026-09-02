#!/usr/bin/env bash
# key.sh <tangent> [antal] [paus_ms] [håll_ms] – skickar knapptryck till mGBA.
# Håller varje tangent minst 150 ms så att spelet (60 Hz) hinner läsa den.
export DISPLAY=:99
W=$(xdotool search --name "mGBA" | head -1)
xdotool windowfocus --sync "$W" 2>/dev/null || true
n=${2:-1}; d=${3:-150}; h=${4:-150}
for ((i=0;i<n;i++)); do
  xdotool keydown "$1"; sleep "$(awk "BEGIN{print $h/1000}")"
  xdotool keyup "$1";   sleep "$(awk "BEGIN{print $d/1000}")"
done
