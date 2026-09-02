#!/usr/bin/env bash
# debug_menu.sh – öppnar expansions debugmeny (håll R, tryck Start)
export DISPLAY=:99
cd "$(dirname "$0")"
W=$(xdotool search --name "mGBA" | head -1)
xdotool windowfocus --sync "$W" 2>/dev/null || true
xdotool keydown s; sleep 0.5; xdotool keydown Return; sleep 0.3
xdotool keyup Return; sleep 0.4; xdotool keyup s; sleep 1.5
