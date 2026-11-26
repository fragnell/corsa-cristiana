"""Crea i suoni di avviso del telefono (sintesi pura, nessun campione esterno).
Uso: python -I crea_suoni.py <cartella_uscita>
Scrive file WAV mono 44.1 kHz: marimba, pizzicato, bolle, arpa."""
import math
import random
import struct
import sys
import wave

SR = 44100
uscita = sys.argv[1]


def vuoto(secondi):
    return [0.0] * int(SR * secondi)


def aggiungi(buf, campioni, inizio_s):
    # ogni nota finisce sfumando (40 ms): se fosse tagliata di netto si sentirebbe un "clic"
    n = len(campioni)
    sfuma = min(n, int(0.04 * SR))
    campioni = [v * (1.0 if i < n - sfuma else (n - i) / sfuma) for i, v in enumerate(campioni)]
    i0 = int(inizio_s * SR)
    for i, v in enumerate(campioni):
        if i0 + i < len(buf):
            buf[i0 + i] += v


def normalizza(buf, picco_db=-3.0):
    picco = max(abs(v) for v in buf) or 1.0
    g = (10 ** (picco_db / 20)) / picco
    # dissolvenza finale di 30 ms, per non avere "clic"
    n = len(buf)
    coda = int(0.03 * SR)
    out = []
    for i, v in enumerate(buf):
        f = 1.0 if i < n - coda else (n - i) / coda
        out.append(v * g * f)
    return out


def salva(nome, buf):
    with wave.open(f"{uscita}/{nome}.wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v)) * 32767)) for v in buf))


def nota_marimba(f, durata, decadimento):
    out = []
    for i in range(int(durata * SR)):
        t = i / SR
        attacco = min(1.0, t / 0.003)
        fond = math.sin(2 * math.pi * f * t) * math.exp(-t / decadimento)
        legno = 0.35 * math.sin(2 * math.pi * f * 3.93 * t) * math.exp(-t / 0.025)
        colpo = 0.08 * math.sin(2 * math.pi * f * 9.2 * t) * math.exp(-t / 0.008)
        out.append(attacco * (fond + legno + colpo))
    return out


def marimba():
    buf = vuoto(0.95)
    note = [523.25, 659.25, 783.99, 1046.50]          # do5 mi5 sol5 do6
    for k, f in enumerate(note):
        ultima = k == len(note) - 1
        aggiungi(buf, [v * (1.0 if ultima else 0.8) for v in nota_marimba(f, 0.7 if ultima else 0.35, 0.3 if ultima else 0.12)], k * 0.075)
    return buf


def pizzico(f, durata, seme):
    rnd = random.Random(seme)
    periodo = int(SR / f)
    linea = [rnd.uniform(-1, 1) for _ in range(periodo)]
    out = []
    idx = 0
    for i in range(int(durata * SR)):
        a = linea[idx]
        b = linea[(idx + 1) % periodo]
        nuovo = 0.996 * 0.5 * (a + b)
        out.append(a)
        linea[idx] = nuovo
        idx = (idx + 1) % periodo
    # passa-basso leggero: suono piu' morbido, da corda di nylon
    morbido, prec = [], 0.0
    for v in out:
        prec = prec + 0.45 * (v - prec)
        morbido.append(prec)
    return morbido


def pizzicato():
    buf = vuoto(0.9)
    aggiungi(buf, pizzico(783.99, 0.8, 1), 0.0)       # sol5
    aggiungi(buf, pizzico(1174.66, 0.75, 2), 0.12)    # re6
    return buf


def bolla(f0, f1, durata):
    out, fase = [], 0.0
    for i in range(int(durata * SR)):
        t = i / SR
        f = f0 + (f1 - f0) * min(1.0, t / 0.07)
        fase += 2 * math.pi * f / SR
        env = min(1.0, t / 0.004) * math.exp(-t / 0.07)
        out.append(env * (math.sin(fase) + 0.15 * math.sin(2 * fase)))
    return out


def bolle():
    buf = vuoto(0.5)
    aggiungi(buf, bolla(480, 1250, 0.25), 0.0)
    aggiungi(buf, bolla(700, 1850, 0.28), 0.13)
    return buf


def arpa():
    buf = vuoto(1.1)
    note = [1046.50, 1174.66, 1318.51, 1567.98, 1760.00]   # do6 re6 mi6 sol6 la6 (pentatonica)
    for k, f in enumerate(note):
        dur = 0.9 if k == len(note) - 1 else 0.5
        out = []
        for i in range(int(dur * SR)):
            t = i / SR
            env = min(1.0, t / 0.004) * math.exp(-t / (0.35 if k == len(note) - 1 else 0.18))
            out.append(env * (math.sin(2 * math.pi * f * t) + 0.25 * math.sin(4 * math.pi * f * t)))
        aggiungi(buf, [v * 0.7 for v in out], k * 0.055)
    # un'eco leggera, come in una stanza
    eco = int(0.09 * SR)
    for i in range(eco, len(buf)):
        buf[i] += 0.25 * buf[i - eco]
    return buf


for nome, funzione in (("marimba", marimba), ("pizzicato", pizzicato), ("bolle", bolle), ("arpa", arpa)):
    salva(nome, normalizza(funzione()))
    print("creato", nome)
