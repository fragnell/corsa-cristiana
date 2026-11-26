#!/bin/bash
# Uniforma il volume percepito a -14 LUFS (al massimo +8 dB di guadagno, limitatore con anticipo) e codifica in MP3.
# La misura si fa con 0.6 s di silenzio in coda: la misura LUFS ha bisogno di almeno 0.4 s.
IN="$1"; OUT="$2"
misura() { ffmpeg -hide_banner -nostats -i "$1" -af "apad=pad_dur=0.6,ebur128" -f null - 2>&1 | grep -A1 "Integrated loudness" | grep "I:" | awk '{print $2}'; }
L=$(misura "$IN")
G=$(python -c "l=float('$L'); g=-14-l; print(round(min(g,8.0),2))")
ffmpeg -hide_banner -loglevel error -y -i "$IN" -af "volume=${G}dB,alimiter=limit=0.89:attack=5:release=60:level=false" -ac 1 -ar 44100 -b:a 112k "$OUT"
L2=$(misura "$OUT")
echo "$(basename "$OUT") ${L} -> ${L2} LUFS (guadagno ${G} dB)"
