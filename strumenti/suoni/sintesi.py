"""Piccolo laboratorio di sintesi sonora in Python puro (nessuna libreria esterna).
Tutto mono, 44.1 kHz, campioni float in liste."""
import math
import random
import struct
import wave

SR = 44100
DUE_PI = 2 * math.pi


def vuoto(secondi):
    return [0.0] * int(SR * secondi)


def mescola(dest, src, inizio_s=0.0, gain=1.0, sfuma_ms=25):
    """Somma src dentro dest a partire da inizio_s, con una breve sfumatura finale anti-clic."""
    n = len(src)
    sfuma = min(n, int(sfuma_ms / 1000 * SR))
    i0 = int(inizio_s * SR)
    lim = min(n, len(dest) - i0)
    for i in range(max(0, -i0), lim):
        f = 1.0 if i < n - sfuma else (n - i) / sfuma
        dest[i0 + i] += src[i] * gain * f
    return dest


def nota(f, durata, armoniche, attacco=0.003, vibrato=0.0, vib_hz=5.5):
    """Sintesi additiva: armoniche = [(rapporto, ampiezza, decadimento_s)]."""
    n = int(durata * SR)
    out = [0.0] * n
    # armoniche oltre ~20 kHz non si sentono e "si ripiegano" in note stonate (aliasing): si scartano
    armoniche = [a for a in armoniche if f * a[0] * (1 + abs(vibrato)) < 0.45 * SR]
    fasi = [0.0] * len(armoniche)
    for i in range(n):
        t = i / SR
        att = min(1.0, t / attacco) if attacco > 0 else 1.0
        mod = 1.0 + vibrato * math.sin(DUE_PI * vib_hz * t) if vibrato else 1.0
        s = 0.0
        for k, (r, a, d) in enumerate(armoniche):
            fasi[k] += DUE_PI * f * r * mod / SR
            s += a * math.sin(fasi[k]) * math.exp(-t / d)
        out[i] = s * att
    return out


def marimba(f, durata=0.6, dec=0.25):
    return nota(f, durata, [(1, 1.0, dec), (3.93, 0.35, 0.03), (9.2, 0.08, 0.008)])


def glock(f, durata=0.8, dec=0.4):
    return nota(f, durata, [(1, 1.0, dec), (2.76, 0.4, dec * 0.4), (5.4, 0.2, dec * 0.15), (8.9, 0.1, 0.02)], attacco=0.001)


def campana(f, durata=2.0, dec=0.9):
    return nota(f, durata, [(1, 1.0, dec), (2.0, 0.5, dec * 0.7), (2.76, 0.35, dec * 0.5), (4.07, 0.2, dec * 0.3), (5.43, 0.12, dec * 0.2)], attacco=0.002)


def carillon(f, durata=0.9, dec=0.5):
    return nota(f, durata, [(1, 1.0, dec), (3.0, 0.25, dec * 0.3), (5.0, 0.08, dec * 0.15)], attacco=0.001)


def morbido(f, durata, dec=0.4, attacco=0.01):
    """Un tono rotondo (tipo flauto di legno / ocarina)."""
    return nota(f, durata, [(1, 1.0, dec), (2, 0.18, dec), (3, 0.06, dec)], attacco=attacco)


def pizzico(f, durata=0.8, chiaro=0.45, seme=1, smorzo=0.996):
    rnd = random.Random(seme)
    periodo = max(2, int(SR / f))
    linea = [rnd.uniform(-1, 1) for _ in range(periodo)]
    out, idx = [], 0
    for _ in range(int(durata * SR)):
        a = linea[idx]
        b = linea[(idx + 1) % periodo]
        linea[idx] = smorzo * 0.5 * (a + b)
        out.append(a)
        idx = (idx + 1) % periodo
    return passa_basso_1(out, chiaro)


def passa_basso_1(x, k):
    out, prec = [], 0.0
    for v in x:
        prec += k * (v - prec)
        out.append(prec)
    return out


def biquad(x, tipo, f, q=0.707):
    w0 = DUE_PI * f / SR
    cw, sw = math.cos(w0), math.sin(w0)
    alfa = sw / (2 * q)
    if tipo == 'lp':
        b0, b1, b2 = (1 - cw) / 2, 1 - cw, (1 - cw) / 2
    elif tipo == 'hp':
        b0, b1, b2 = (1 + cw) / 2, -(1 + cw), (1 + cw) / 2
    else:  # 'bp' (guadagno costante al picco)
        b0, b1, b2 = alfa, 0.0, -alfa
    a0, a1, a2 = 1 + alfa, -2 * cw, 1 - alfa
    b0, b1, b2, a1, a2 = b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0
    out = [0.0] * len(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, y
        out[i] = y
    return out


def biquad_mobile(x, tipo, f_di_t, q=0.707):
    """Filtro con frequenza che cambia nel tempo (ricalcolato ogni 32 campioni)."""
    out = [0.0] * len(x)
    x1 = x2 = y1 = y2 = 0.0
    coeff = None
    for i, v in enumerate(x):
        if i % 32 == 0:
            f = max(40.0, min(SR * 0.45, f_di_t(i / SR)))
            w0 = DUE_PI * f / SR
            cw, sw = math.cos(w0), math.sin(w0)
            alfa = sw / (2 * q)
            if tipo == 'lp':
                b0, b1, b2 = (1 - cw) / 2, 1 - cw, (1 - cw) / 2
            elif tipo == 'hp':
                b0, b1, b2 = (1 + cw) / 2, -(1 + cw), (1 + cw) / 2
            else:
                b0, b1, b2 = alfa, 0.0, -alfa
            a0 = 1 + alfa
            coeff = (b0 / a0, b1 / a0, b2 / a0, -2 * cw / a0, (1 - alfa) / a0)
        b0, b1, b2, a1, a2 = coeff
        y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, y
        out[i] = y
    return out


def rumore(durata, seme=0):
    rnd = random.Random(seme)
    return [rnd.uniform(-1, 1) for _ in range(int(durata * SR))]


def inviluppo(x, attacco, decadimento, tenuta=0.0):
    out = []
    for i, v in enumerate(x):
        t = i / SR
        if t < attacco:
            g = t / attacco
        elif t < attacco + tenuta:
            g = 1.0
        else:
            g = math.exp(-(t - attacco - tenuta) / decadimento)
        out.append(v * g)
    return out


def sinusoide_mobile(f_di_t, durata, amp_di_t=None, armoniche=((1, 1.0),)):
    out, fase = [], 0.0
    for i in range(int(durata * SR)):
        t = i / SR
        fase += DUE_PI * f_di_t(t) / SR
        a = amp_di_t(t) if amp_di_t else 1.0
        out.append(a * sum(am * math.sin(fase * r) for r, am in armoniche))
    return out


def sega(f_di_t, durata):
    """Dente di sega con PolyBLEP (poco aliasing)."""
    out, fase = [], 0.0
    for i in range(int(durata * SR)):
        dt = f_di_t(i / SR) / SR
        fase += dt
        if fase >= 1.0:
            fase -= 1.0
        v = 2 * fase - 1
        if fase < dt:
            x = fase / dt
            v -= x + x - x * x - 1
        elif fase > 1 - dt:
            x = (fase - 1) / dt
            v -= x * x + x + x + 1
        out.append(v)
    return out


def ottone(f, durata, attacco=0.04, rilascio=0.15, vibrato=0.006, chiaro=2600):
    """Un ottone semplice: dente di sega filtrato con un filtro che si apre all'attacco."""
    base = sega(lambda t: f * (1 + vibrato * math.sin(DUE_PI * 5.2 * t) * min(1, t / 0.25)), durata)
    filt = biquad_mobile(base, 'lp', lambda t: 400 + chiaro * min(1.0, t / attacco) * (0.75 + 0.25 * math.exp(-t / 0.3)), q=1.1)
    out = []
    n = len(filt)
    for i, v in enumerate(filt):
        t = i / SR
        g = min(1.0, t / attacco) * min(1.0, (n - i) / (rilascio * SR))
        out.append(v * g * 0.6)
    return out


def colpo_legno(f, dec=0.018, seme=0, corpo=0.0):
    """Impatto su legno: rumore filtrato risonante + (opzionale) un tonfo grave."""
    n = rumore(dec * 8, seme)
    n = inviluppo(n, 0.0008, dec)
    out = biquad(n, 'bp', f, q=6)
    out = [v * 3.0 for v in out]
    if corpo:
        tonfo = nota(corpo, dec * 6, [(1, 1.0, dec * 1.6)], attacco=0.001)
        out = mescola(out + [0.0] * max(0, len(tonfo) - len(out)), tonfo, 0, 0.5)
    return out


def riverbero(x, quanto=0.25, coda=1.2):
    """Riverbero di Schroeder: 4 pettini + 2 passa-tutto."""
    ritardi = [1557, 1617, 1491, 1422]
    g = 0.84 if coda >= 1 else 0.78
    lunghezza = len(x) + int(coda * SR)
    ingresso = x + [0.0] * (lunghezza - len(x))
    somma = [0.0] * lunghezza
    for d in ritardi:
        buf = [0.0] * d
        idx, filt = 0, 0.0
        for i in range(lunghezza):
            y = buf[idx]
            filt = y * 0.8 + filt * 0.2
            buf[idx] = ingresso[i] + filt * g
            idx = (idx + 1) % d
            somma[i] += y
    for d in (225, 556):
        buf = [0.0] * d
        idx = 0
        for i in range(lunghezza):
            b = buf[idx]
            ingr = somma[i]
            y = -0.5 * ingr + b
            buf[idx] = ingr + 0.5 * y
            idx = (idx + 1) % d
            somma[i] = y
    return [ingresso[i] + quanto * 0.25 * somma[i] for i in range(lunghezza)]


def taglia_silenzio_finale(x, soglia=0.0005):
    fine = len(x)
    while fine > 1 and abs(x[fine - 1]) < soglia:
        fine -= 1
    return x[:min(len(x), fine + int(0.02 * SR))]


def finalizza(x, rms_db=-19.0, picco_db=-1.0, durata_max=None):
    """Volume uniforme: porta l'RMS (della parte che suona) a rms_db, poi limita i picchi morbidamente."""
    x = taglia_silenzio_finale(x)
    tagliato = bool(durata_max) and len(x) > int(durata_max * SR)
    if tagliato:
        # la coda (riverbero) va oltre il limite: si taglia, ma sfumando piano negli ultimi 0.4 s
        x = x[:int(durata_max * SR)]
        n = len(x)
        lunga = int(0.4 * SR)
        x = [v * (1.0 if i < n - lunga else ((n - i) / lunga) ** 2) for i, v in enumerate(x)]
    # Solo il picco a picco_db: nessuna saturazione (il volume percepito lo uniforma poi ffmpeg).
    picco = max((abs(v) for v in x), default=0.0) or 1e-9
    g = (10 ** (picco_db / 20)) / picco
    out = [v * g for v in x]
    n = len(out)
    sfuma = min(n, int(0.03 * SR))
    for i in range(n - sfuma, n):
        out[i] *= (n - i) / sfuma
    return out


def salva_wav(percorso, x):
    with wave.open(percorso, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1.0, min(1.0, v)) * 32767)) for v in x))


# frequenze delle note (la4 = 440)
def hz(nome):
    note = {'C': -9, 'C#': -8, 'Db': -8, 'D': -7, 'D#': -6, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'Gb': -3,
            'G': -2, 'G#': -1, 'Ab': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}
    lettera = nome[:-1]
    ottava = int(nome[-1])
    return 440.0 * 2 ** ((note[lettera] + (ottava - 4) * 12) / 12)
