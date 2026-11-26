"""I suoni del tabellone di Corsa Cristiana: per ogni effetto 5 versioni (la 1 e' quella proposta "in uso").
Uso: python crea_effetti.py <cartella_wav> [solo_effetto]"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sintesi import (SR, vuoto, mescola, nota, marimba, glock, campana, carillon, morbido, pizzico, biquad,
                     biquad_mobile, rumore, inviluppo, sinusoide_mobile, ottone, colpo_legno, riverbero,
                     finalizza, salva_wav, hz)

USCITA = sys.argv[1]
SOLO = sys.argv[2] if len(sys.argv) > 2 else None


def accordo(funzione, note, inizio, b, gain=0.5, sfasamento=0.0, **kw):
    for k, n in enumerate(note):
        mescola(b, funzione(hz(n), **kw), inizio + k * sfasamento, gain)


def scintilla(b, inizio, seme=3, quante=7, gain=0.18):
    rnd = random.Random(seme)
    scala = ['C7', 'E7', 'G7', 'A7', 'D7', 'C8', 'G6']
    for k in range(quante):
        mescola(b, glock(hz(rnd.choice(scala)), 0.5, 0.25), inizio + k * 0.045 + rnd.uniform(0, 0.02), gain)


def fischio(f0, f1, durata, curva=1.0):
    def f(t):
        x = min(1.0, t / durata) ** curva
        return (f0 + (f1 - f0) * x) * (1 + 0.012 * math.sin(2 * math.pi * 7 * t))
    s = sinusoide_mobile(f, durata, lambda t: min(1, t / 0.03) * min(1, (durata - t) / 0.05 + 0.0001),
                         armoniche=((1, 1.0), (2, 0.08)))
    soffio = biquad(rumore(durata, 9), 'bp', (f0 + f1) / 2, q=2)
    return [v + 0.04 * n for v, n in zip(s, soffio)]


def timpano(f, durata=1.0, dec=0.5, seme=2):
    corpo = nota(f, durata, [(1, 1.0, dec), (1.5, 0.5, dec * 0.6), (1.98, 0.25, dec * 0.4)], attacco=0.002)
    pelle = inviluppo(biquad(rumore(0.08, seme), 'lp', 900), 0.001, 0.02)
    return mescola(corpo, pelle, 0, 0.4)


def piatto(durata=1.5, dec=0.6, seme=4):
    r = biquad(rumore(durata, seme), 'hp', 5000)
    return inviluppo(r, 0.002, dec)


def arpeggio_arpa(note, passo, b, inizio=0.0, gain=0.5, dec=0.9):
    for k, n in enumerate(note):
        mescola(b, pizzico(hz(n), dec + 0.3, chiaro=0.55, seme=k + 11, smorzo=0.998), inizio + k * passo, gain)


# ------------------------------------------------------------------ DADO (max 1.6 s)

def dadi_su_legno(seme=1):
    rnd = random.Random(seme)
    b = vuoto(1.7)
    for dado in range(2):
        t = 0.02 + dado * 0.035
        forza = 1.0
        # rimbalzi sempre piu' vicini e piu' deboli
        for k in range(6):
            f = rnd.uniform(1700, 3200)
            mescola(b, colpo_legno(f, 0.02, seme=k + dado * 10, corpo=rnd.uniform(160, 230)), t, forza * 0.9)
            t += 0.13 * (0.8 ** k)
            forza *= 0.78
        # rotola: tanti tic piccoli
        for k in range(14):
            mescola(b, colpo_legno(rnd.uniform(2500, 4200), 0.008, seme=100 + k + dado * 30), t, 0.25 * (1 - k / 16))
            t += rnd.uniform(0.025, 0.05)
        mescola(b, colpo_legno(rnd.uniform(1900, 2600), 0.02, seme=77 + dado, corpo=190), t + 0.04, 0.35)
    return b


def bicchiere_scosso(seme=2):
    rnd = random.Random(seme)
    b = vuoto(1.6)
    t = 0.0
    while t < 0.85:
        scuoti = 0.55 + 0.45 * math.sin(2 * math.pi * 3.2 * t) ** 2
        mescola(b, colpo_legno(rnd.uniform(3200, 6000), 0.006, seme=int(t * 1000)), t, 0.35 * scuoti)
        t += rnd.uniform(0.012, 0.03)
    for k, (dt, g) in enumerate([(0.95, 0.9), (1.08, 0.6), (1.18, 0.4), (1.25, 0.25)]):
        mescola(b, colpo_legno(rnd.uniform(1800, 2600), 0.02, seme=300 + k, corpo=200), dt, g)
    return b


def rullo_tamburo(seme=3):
    rnd = random.Random(seme)
    b = vuoto(1.6)
    t = 0.0
    while t < 1.15:
        forza = 0.25 + 0.75 * (t / 1.15) ** 1.5
        colpo = inviluppo(biquad(rumore(0.06, int(t * 1000)), 'bp', rnd.uniform(2500, 4000), q=1.2), 0.001, 0.02)
        corpo = nota(210, 0.06, [(1, 1.0, 0.02)], attacco=0.001)
        mescola(b, colpo, t, forza * 0.8)
        mescola(b, corpo, t, forza * 0.3)
        t += 0.032
    mescola(b, colpo_legno(1400, 0.035, seme=9, corpo=320), 1.25, 1.2)
    return b


def marimba_che_gira():
    b = vuoto(1.6)
    scala = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6']
    giro = scala + scala[-2::-1] + scala[1:]
    t = 0.0
    for k, n in enumerate(giro):
        mescola(b, marimba(hz(n), 0.25, 0.08), t, 0.45)
        t += 0.06 - 0.02 * (k / len(giro))
    mescola(b, marimba(hz('C6'), 0.5, 0.25), t + 0.05, 0.7)
    return b


def ruota_a_scatti():
    b = vuoto(1.6)
    t, passo = 0.0, 0.035
    while t < 1.2:
        mescola(b, colpo_legno(3800, 0.006, seme=int(t * 997)), t, 0.6)
        t += passo
        passo *= 1.09
    mescola(b, glock(hz('E6'), 0.5, 0.25), t + 0.03, 0.5)
    return b


# ------------------------------------------------------------------ CARTA PESCATA (Conoscenza / Prova)

def carta_e_campanellino():
    b = vuoto(0.9)
    fruscio = biquad_mobile(rumore(0.2, 5), 'bp', lambda t: 2500 + 9000 * t, q=0.8)
    mescola(b, inviluppo(fruscio, 0.03, 0.05), 0.0, 0.5)
    mescola(b, glock(hz('E6'), 0.6, 0.3), 0.12, 0.45)
    mescola(b, glock(hz('A6'), 0.7, 0.35), 0.21, 0.5)
    return b


def pagina_di_libro():
    b = vuoto(0.7)
    fruscio = biquad_mobile(rumore(0.35, 6), 'bp', lambda t: 1200 + 6000 * t / 0.35, q=0.7)
    mescola(b, inviluppo(fruscio, 0.08, 0.08), 0.0, 0.8)
    rnd = random.Random(6)
    for k in range(6):
        mescola(b, colpo_legno(rnd.uniform(4000, 7000), 0.004, seme=40 + k), 0.06 + k * 0.035, 0.12)
    mescola(b, inviluppo(biquad(rumore(0.05, 7), 'lp', 1500), 0.002, 0.02), 0.32, 0.4)
    return b


def arpa_magica():
    b = vuoto(1.0)
    arpeggio_arpa(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.045, b, 0.0, 0.4, dec=0.5)
    scintilla(b, 0.25, seme=8, quante=4, gain=0.12)
    return riverbero(b, 0.35, 0.5)


def domanda_da_quiz():
    b = vuoto(0.8)
    for k, n in enumerate(['C6', 'E6', 'G6']):
        mescola(b, nota(hz(n), 0.18, [(1, 1.0, 0.08), (2, 0.3, 0.05), (3, 0.15, 0.03)], attacco=0.002), k * 0.09, 0.5)
    mescola(b, nota(hz('C7'), 0.4, [(1, 1.0, 0.18), (2, 0.25, 0.1)], attacco=0.002), 0.3, 0.45)
    return b


def pop_morbido():
    b = vuoto(0.8)
    pop = sinusoide_mobile(lambda t: 300 + 900 * min(1, t / 0.03), 0.08, lambda t: math.exp(-t / 0.025))
    mescola(b, pop, 0.0, 0.7)
    mescola(b, morbido(hz('G5'), 0.25, 0.12, 0.02), 0.06, 0.4)
    mescola(b, morbido(hz('C6'), 0.45, 0.2, 0.02), 0.2, 0.45)
    return b


# ------------------------------------------------------------------ RISPOSTA GIUSTA

def marimba_felice():
    b = vuoto(1.9)
    for k, n in enumerate(['C5', 'E5', 'G5']):
        mescola(b, marimba(hz(n), 0.35, 0.12), k * 0.08, 0.6)
    accordo(marimba, ['C5', 'E5', 'G5', 'C6'], 0.26, b, gain=0.45, durata=1.2, dec=0.45)
    scintilla(b, 0.3, seme=4, quante=6, gain=0.16)
    return riverbero(b, 0.25, 0.6)


def fanfara_breve():
    b = vuoto(1.8)
    mescola(b, ottone(hz('G4'), 0.14, 0.02, 0.05), 0.0, 0.5)
    mescola(b, ottone(hz('G4'), 0.14, 0.02, 0.05), 0.16, 0.5)
    for n in ['C5', 'E5', 'G4']:
        mescola(b, ottone(hz(n), 1.0, 0.05, 0.4), 0.32, 0.38)
    mescola(b, timpano(hz('C3'), 0.8, 0.35), 0.32, 0.5)
    return riverbero(b, 0.3, 0.6)


def scintille():
    b = vuoto(1.7)
    for k, n in enumerate(['G6', 'E6', 'C6', 'E6', 'G6', 'C7', 'E7']):
        mescola(b, glock(hz(n), 0.8, 0.35), k * 0.06, 0.4)
    mescola(b, glock(hz('C7'), 1.2, 0.6), 0.45, 0.45)
    return riverbero(b, 0.4, 0.8)


def moneta():
    b = vuoto(0.9)
    tri = lambda f, d, dec: nota(f, d, [(1, 1.0, dec), (3, 0.11, dec), (5, 0.04, dec)], attacco=0.002)
    mescola(b, tri(hz('B5'), 0.09, 0.2), 0.0, 0.5)
    mescola(b, tri(hz('E6'), 0.6, 0.25), 0.08, 0.55)
    return b


def ukulele():
    b = vuoto(1.8)
    corde = ['G4', 'C4', 'E4', 'A4']          # accordatura del ukulele: accordo di Do con il La -> uso Do maggiore
    do = ['G4', 'C5', 'E5', 'C6']
    for colpo, inizio in ((0, 0.0), (1, 0.28)):
        for k, n in enumerate(do if colpo else do):
            mescola(b, pizzico(hz(n), 1.2, chiaro=0.6, seme=k + colpo * 10, smorzo=0.997), inizio + k * 0.022, 0.4)
    return riverbero(b, 0.2, 0.5)


# ------------------------------------------------------------------ RISPOSTA SBAGLIATA (gentile)

def oh_oh():
    b = vuoto(1.2)
    mescola(b, marimba(hz('E5'), 0.35, 0.15), 0.0, 0.6)
    mescola(b, marimba(hz('C5'), 0.8, 0.35), 0.2, 0.65)
    return riverbero(b, 0.15, 0.4)


def trombetta_triste():
    b = vuoto(2.0)
    note = [('Bb3', 0.0, 0.3), ('A3', 0.32, 0.3), ('Ab3', 0.64, 0.3)]
    for n, t, d in note:
        mescola(b, ottone(hz(n), d, 0.03, 0.08, chiaro=800), t, 0.6)
    mescola(b, ottone(hz('G3'), 0.95, 0.03, 0.3, vibrato=0.025, chiaro=750), 0.96, 0.6)
    return b


def toc_sordo():
    b = vuoto(0.7)
    mescola(b, colpo_legno(700, 0.05, seme=3, corpo=110), 0.0, 1.0)
    mescola(b, nota(98, 0.5, [(1, 1.0, 0.12)], attacco=0.002), 0.0, 0.6)
    return b


def pizzicato_giu():
    b = vuoto(1.3)
    for k, n in enumerate(['A4', 'F4', 'D4']):
        mescola(b, pizzico(hz(n), 0.9, chiaro=0.4, seme=k + 3), k * 0.17, 0.55)
    return b


def palloncino():
    b = vuoto(1.0)
    s = sinusoide_mobile(lambda t: (620 - 380 * min(1, t / 0.7)) * (1 + 0.05 * math.sin(2 * math.pi * 9 * t)), 0.85,
                         lambda t: min(1, t / 0.02) * (1 - t / 0.9), armoniche=((1, 1.0), (2, 0.15)))
    return mescola(b, s, 0.0, 0.7)


# ------------------------------------------------------------------ IMPREVISTO

def fischio_e_tonfo():
    b = vuoto(1.6)
    mescola(b, fischio(1700, 480, 0.7, curva=0.8), 0.0, 0.5)
    mescola(b, timpano(85, 0.8, 0.3), 0.72, 0.9)
    return riverbero(b, 0.15, 0.5)


def timpani_drammatici():
    b = vuoto(1.8)
    t = 0.0
    while t < 0.7:
        mescola(b, timpano(hz('A2'), 0.3, 0.15, seme=int(t * 100)), t, 0.2 + 0.5 * t)
        t += 0.045
    mescola(b, timpano(hz('D2'), 1.0, 0.5), 0.75, 1.0)
    mescola(b, piatto(1.0, 0.4), 0.75, 0.15)
    return riverbero(b, 0.2, 0.6)


def accordo_sorpresa():
    b = vuoto(1.4)
    for n in ['C4', 'Eb4', 'F#4', 'A4']:
        mescola(b, ottone(hz(n), 0.9, 0.015, 0.5, vibrato=0.0, chiaro=2200), 0.0, 0.3)
    mescola(b, timpano(hz('C2'), 0.8, 0.3), 0.0, 0.6)
    return riverbero(b, 0.25, 0.6)


def molla_giu():
    b = vuoto(1.0)
    s = sinusoide_mobile(lambda t: (500 - 300 * min(1, t / 0.6)) * (1 + 0.25 * math.sin(2 * math.pi * 18 * t) * math.exp(-t / 0.35)),
                         0.75, lambda t: min(1, t / 0.01) * math.exp(-t / 0.35), armoniche=((1, 1.0), (2, 0.3), (3, 0.1)))
    return mescola(b, s, 0.0, 0.7)


def scivolone():
    b = vuoto(1.5)
    discesa = ['C6', 'B5', 'Bb5', 'A5', 'Ab5', 'G5', 'F#5', 'F5', 'E5', 'Eb5', 'D5']
    for k, n in enumerate(discesa):
        mescola(b, pizzico(hz(n), 0.4, chiaro=0.5, seme=k), k * 0.045, 0.35)
    mescola(b, pizzico(hz('C3'), 0.9, chiaro=0.3, seme=50), len(discesa) * 0.045 + 0.05, 0.7)
    return b


# ------------------------------------------------------------------ SALTO

def fischio_e_scintilla():
    b = vuoto(1.5)
    mescola(b, fischio(480, 1800, 0.55, curva=1.3), 0.0, 0.5)
    scintilla(b, 0.5, seme=5, quante=6, gain=0.22)
    return riverbero(b, 0.25, 0.6)


def molla_su():
    b = vuoto(1.0)
    s = sinusoide_mobile(lambda t: (220 + 600 * min(1, t / 0.35)) * (1 + 0.2 * math.sin(2 * math.pi * 16 * t) * math.exp(-t / 0.3)),
                         0.7, lambda t: min(1, t / 0.01) * math.exp(-t / 0.3), armoniche=((1, 1.0), (2, 0.3), (3, 0.1)))
    return mescola(b, s, 0.0, 0.7)


def vento_veloce():
    b = vuoto(1.4)
    vento = biquad_mobile(rumore(0.6, 12), 'bp', lambda t: 400 + 5000 * (t / 0.6) ** 1.5, q=1.5)
    mescola(b, inviluppo(vento, 0.35, 0.12), 0.0, 1.0)
    mescola(b, glock(hz('G6'), 0.8, 0.4), 0.48, 0.4)
    mescola(b, glock(hz('C7'), 0.9, 0.45), 0.55, 0.4)
    return riverbero(b, 0.25, 0.6)


def scala_di_marimba():
    b = vuoto(1.5)
    scala = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7']
    for k, n in enumerate(scala):
        mescola(b, marimba(hz(n), 0.3, 0.1), k * 0.045, 0.45)
    mescola(b, marimba(hz('C7'), 0.7, 0.3), len(scala) * 0.045 + 0.02, 0.5)
    return riverbero(b, 0.2, 0.5)


def arpa_in_salita():
    b = vuoto(1.8)
    arpeggio_arpa(['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.04, b, 0.0, 0.4, dec=0.9)
    return riverbero(b, 0.4, 0.8)


# ------------------------------------------------------------------ SCORAGGIAMENTO (Fermo)

def sospiro_di_marimba():
    b = vuoto(1.9)
    for k, n in enumerate(['E5', 'C5', 'A4']):
        mescola(b, marimba(hz(n), 0.9, 0.4), k * 0.32, 0.55 - k * 0.05)
    return riverbero(b, 0.25, 0.8)


def orologio_che_si_ferma():
    b = vuoto(1.8)
    t, passo = 0.0, 0.2
    for k in range(7):
        mescola(b, colpo_legno(2600 if k % 2 == 0 else 2100, 0.012, seme=k), t, 0.7 * (1 - k / 9))
        t += passo
        passo *= 1.12
    return b


def ciotola_tibetana():
    b = vuoto(2.0)
    s = nota(hz('G4'), 1.9, [(1, 1.0, 1.0), (1.006, 0.6, 1.0), (2.71, 0.35, 0.6), (5.15, 0.15, 0.3)], attacco=0.04)
    return riverbero(mescola(b, s, 0.0, 0.6), 0.3, 0.8)


def sgonfiarsi():
    b = vuoto(1.6)
    s = sinusoide_mobile(lambda t: 440 * 2 ** (-t / 1.1), 1.3, lambda t: min(1, t / 0.08) * math.exp(-t / 0.7),
                         armoniche=((1, 1.0), (2, 0.2)))
    soffio = inviluppo(biquad(rumore(1.3, 13), 'bp', 900, q=0.9), 0.1, 0.5)
    mescola(b, s, 0.0, 0.6)
    mescola(b, soffio, 0.0, 0.15)
    return b


def carillon_che_rallenta():
    b = vuoto(2.0)
    note = ['E6', 'D6', 'C6', 'G5', 'E5']
    t, passo = 0.0, 0.18
    for k, n in enumerate(note):
        f = hz(n) * (1 - 0.012 * k)
        mescola(b, carillon(f, 0.9, 0.45), t, 0.45)
        t += passo
        passo *= 1.3
    return riverbero(b, 0.25, 0.6)


# ------------------------------------------------------------------ VITTORIA

def festa():
    b = vuoto(4.6)
    melodia = [('G4', 0.0), ('C5', 0.14), ('E5', 0.28), ('G5', 0.42), ('E5', 0.7), ('G5', 0.84)]
    for n, t in melodia:
        mescola(b, marimba(hz(n), 0.4, 0.15), t, 0.55)
        mescola(b, glock(hz(n) * 2, 0.4, 0.2), t, 0.18)
    accordo(marimba, ['C5', 'E5', 'G5', 'C6'], 1.05, b, gain=0.4, durata=2.6, dec=0.9)
    accordo(glock, ['C6', 'E6', 'G6', 'C7'], 1.05, b, gain=0.2, sfasamento=0.03, durata=2.6, dec=1.0)
    for k in range(3):
        for j, n in enumerate(['C4', 'G4', 'C5', 'E5']):
            mescola(b, pizzico(hz(n), 0.8, 0.5, seme=j + k * 10), 1.05 + k * 0.42 + j * 0.015, 0.22)
    t = 0.0
    while t < 1.0:
        mescola(b, timpano(hz('C3'), 0.3, 0.15, seme=int(t * 100)), t, 0.1 + 0.3 * t)
        t += 0.05
    mescola(b, timpano(hz('C3'), 1.4, 0.6), 1.05, 0.7)
    mescola(b, piatto(2.4, 0.9), 1.05, 0.12)
    scintilla(b, 1.2, seme=11, quante=10, gain=0.14)
    return riverbero(b, 0.35, 1.0)


def fanfara_di_ottoni():
    b = vuoto(4.4)
    frasi = [('G4', 0.0, 0.16), ('G4', 0.18, 0.16), ('G4', 0.36, 0.16), ('C5', 0.54, 0.5), ('G4', 1.1, 0.2), ('C5', 1.32, 1.5)]
    for n, t, d in frasi:
        mescola(b, ottone(hz(n), d, 0.03, 0.1), t, 0.45)
        mescola(b, ottone(hz(n) / 2, d, 0.03, 0.1, chiaro=1500), t, 0.25)
    for n in ['E4', 'G4', 'C4']:
        mescola(b, ottone(hz(n), 1.5, 0.05, 0.5, chiaro=1800), 1.32, 0.22)
    mescola(b, timpano(hz('C3'), 0.6, 0.3), 0.54, 0.6)
    mescola(b, timpano(hz('G2'), 0.6, 0.3), 1.1, 0.5)
    mescola(b, timpano(hz('C3'), 1.4, 0.6), 1.32, 0.8)
    mescola(b, piatto(2.2, 0.8), 1.32, 0.14)
    return riverbero(b, 0.35, 1.0)


def fuochi_artificio():
    b = vuoto(4.6)
    rnd = random.Random(21)
    for k, t in enumerate([0.0, 0.7, 1.35]):
        mescola(b, fischio(700, 2400 + 300 * k, 0.45, curva=1.2), t, 0.25)
        scoppio = inviluppo(biquad(rumore(0.5, 30 + k), 'lp', 1800), 0.001, 0.12)
        mescola(b, scoppio, t + 0.47, 0.9)
        mescola(b, timpano(70, 0.5, 0.2), t + 0.47, 0.5)
        tc = t + 0.55
        for j in range(18):
            mescola(b, colpo_legno(rnd.uniform(3000, 7000), 0.004, seme=k * 50 + j), tc + rnd.uniform(0, 0.6), 0.22)
    accordo(campana, ['C5', 'E5', 'G5', 'C6'], 2.2, b, gain=0.2, sfasamento=0.05, durata=2.2, dec=0.9)
    scintilla(b, 2.25, seme=13, quante=8, gain=0.12)
    return riverbero(b, 0.35, 1.0)


def carillon_vittoria():
    b = vuoto(4.2)
    melodia = [('C6', 0.0), ('E6', 0.2), ('G6', 0.4), ('C7', 0.6), ('B6', 0.9), ('G6', 1.1), ('A6', 1.3), ('C7', 1.6)]
    for n, t in melodia:
        mescola(b, carillon(hz(n), 1.0, 0.5), t, 0.45)
    accordo(carillon, ['C5', 'G5', 'E6'], 1.6, b, gain=0.25, durata=2.0, dec=1.0)
    return riverbero(b, 0.4, 1.0)


def arpa_e_campane():
    b = vuoto(4.4)
    arpeggio_arpa(['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.05, b, 0.0, 0.35, dec=1.4)
    accordo(campana, ['C5', 'E5', 'G5', 'B5', 'D6'], 0.6, b, gain=0.18, sfasamento=0.08, durata=3.0, dec=1.3)
    scintilla(b, 0.7, seme=17, quante=8, gain=0.1)
    return riverbero(b, 0.45, 1.2)


EFFETTI = {
    'dado': [dadi_su_legno, bicchiere_scosso, rullo_tamburo, marimba_che_gira, ruota_a_scatti],
    'conoscenza': [carta_e_campanellino, pagina_di_libro, arpa_magica, domanda_da_quiz, pop_morbido],
    'corretto': [marimba_felice, fanfara_breve, scintille, moneta, ukulele],
    'sbagliato': [oh_oh, trombetta_triste, toc_sordo, pizzicato_giu, palloncino],
    'imprevisto': [fischio_e_tonfo, timpani_drammatici, accordo_sorpresa, molla_giu, scivolone],
    'salto': [fischio_e_scintilla, molla_su, vento_veloce, scala_di_marimba, arpa_in_salita],
    'fermo': [sospiro_di_marimba, orologio_che_si_ferma, ciotola_tibetana, sgonfiarsi, carillon_che_rallenta],
    'vittoria': [festa, fanfara_di_ottoni, fuochi_artificio, carillon_vittoria, arpa_e_campane],
}

DURATA_MAX = {'dado': 1.6, 'conoscenza': 1.1, 'vittoria': 5.5}

for effetto, funzioni in EFFETTI.items():
    if SOLO and effetto != SOLO:
        continue
    for k, fn in enumerate(funzioni, start=1):
        campioni = finalizza(fn(), durata_max=DURATA_MAX.get(effetto, 2.5))
        salva_wav(os.path.join(USCITA, f'{effetto}-{k}.wav'), campioni)
        print(f'{effetto}-{k} {fn.__name__} {len(campioni) / SR:.2f}s', flush=True)
