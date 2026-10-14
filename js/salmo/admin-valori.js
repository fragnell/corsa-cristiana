// admin-valori.js
// Salmo 133:1 — i valori del pannello Admin. Passa da "quello che c'e' scritto
// nei campi" a "una configurazione valida" (oppure all'elenco di cio' che non va),
// e viceversa. Contiene anche i due gruppi di valori pronti: quelli "di prova"
// (per provare con soli due telefoni) e quelli "di base" (la serata normale).
// Solo funzioni pure: niente pagina, niente Firebase. Cosi' si provano con i test.

import { configSalmoSicura } from './regola.js';

// [minimo, massimo] accettati dal pannello.
export const LIMITI = {
  giocatoriMinimi: [2, 12],
  distacco: [1, 99],
  primoMassimo: [1, 200],
  giriDiPausa: [0, 20],
  maxPerPartita: [0, 20],
  bonusUltimo: [0, 50],
  malusPrimo: [0, 50],
  tentativi: [1, 5],
  prontoS: [10, 300],
  sbirciataS: [1, 60],
  esitoS: [3, 60],
  riquadri: [2, 22],
  provaS: [10, 600],
  anteprimaS: [1, 120]
};

// Quanti riquadri conviene proporre: quelli che riempiono bene una griglia.
export const RIQUADRI_CONSIGLIATI = [4, 6, 9, 12, 16, 20];

// I distacchi, nell'ordine in cui il pannello li mostra: [nome del campo, chiave nella config].
export const DISTACCHI = [
  ['distacco4', 'finoA4'],
  ['distacco6', 'finoA6'],
  ['distacco8', 'finoA8'],
  ['distacco10', 'finoA10'],
  ['distacco12', 'finoA12']
];

// Quello che il pannello cambia quando si preme "valori di prova": fa scattare
// la prova anche con due soli telefoni e con pochissime caselle di distacco.
export const CAMPI_DI_PROVA = {
  attivo: true,
  giocatoriMinimi: 2,
  distacco4: 3,
  distacco6: 3,
  distacco8: 3,
  distacco10: 3,
  distacco12: 3,
  primoMassimo: 90,
  giriDiPausa: 0,
  maxPerPartita: 10
};

// ---------- da millisecondi a secondi e ritorno ----------

export function msInSecondi(ms) {
  return Math.round(Number(ms) / 100) / 10;
}

export function secondiInMs(secondi) {
  return Math.round(Number(secondi) * 1000);
}

// ---------- dalla configurazione ai campi del pannello ----------

// Tutti i campi come li mostra il pannello (numeri e veri/falsi). Anche se la
// configurazione e' incompleta o storta, ogni campo riceve un valore sensato.
export function campiDaConfig(salmo) {
  const c = configSalmoSicura(salmo);
  const campi = {
    attivo: c.attivo,
    giocatoriMinimi: c.giocatoriMinimi,
    primoMassimo: c.primoMassimo,
    giriDiPausa: c.giriDiPausa,
    maxPerPartita: c.maxPerPartita,
    bonusUltimo: c.bonusUltimo,
    malusPrimo: Math.abs(c.malusPrimo),        // nel pannello si scrive "10", non "-10"
    ultimoSaltaSeFallisce: c.ultimoSaltaSeFallisce,
    ultimoTiraDopoSuccesso: c.ultimoTiraDopoSuccesso,
    tentativi: c.tentativi,
    prontoS: msInSecondi(c.prontoMs),
    sbirciataS: msInSecondi(c.sbirciataMs),
    esitoS: msInSecondi(c.esitoMs)
  };
  for (const [campo, chiave] of DISTACCHI) campi[campo] = c.distacchi[chiave];
  for (const livello of ['bambini', 'normale']) {
    campi[livello + 'Riquadri'] = c.livelli[livello].riquadri;
    campi[livello + 'ProvaS'] = msInSecondi(c.livelli[livello].provaMs);
    campi[livello + 'AnteprimaS'] = msInSecondi(c.livelli[livello].anteprimaMs);
  }
  return campi;
}

// ---------- dai campi del pannello alla configurazione ----------

function numero(valore) {
  if (typeof valore === 'number') return valore;
  const testo = String(valore === null || valore === undefined ? '' : valore).trim().replace(',', '.');
  return testo === '' ? NaN : Number(testo);
}

function leggiIntero(campi, nome, etichetta, [minimo, massimo], errori) {
  const n = numero(campi[nome]);
  if (!Number.isInteger(n) || n < minimo || n > massimo) {
    errori.push(`${etichetta}: scrivi un numero intero da ${minimo} a ${massimo}.`);
    return null;
  }
  return n;
}

function leggiSecondi(campi, nome, etichetta, [minimo, massimo], errori) {
  const n = numero(campi[nome]);
  if (!Number.isFinite(n) || n < minimo || n > massimo) {
    errori.push(`${etichetta}: scrivi i secondi, da ${minimo} a ${massimo}.`);
    return null;
  }
  return secondiInMs(n);
}

function leggiLivello(campi, livello, nomeLivello, errori) {
  return {
    riquadri: leggiIntero(campi, livello + 'Riquadri', `${nomeLivello}, riquadri`, LIMITI.riquadri, errori),
    provaMs: leggiSecondi(campi, livello + 'ProvaS', `${nomeLivello}, tempo per il mosaico`, LIMITI.provaS, errori),
    anteprimaMs: leggiSecondi(campi, livello + 'AnteprimaS', `${nomeLivello}, anteprima del primo`, LIMITI.anteprimaS, errori)
  };
}

// Trasforma i campi del pannello nella configurazione da salvare.
// Restituisce { valori, errori }: se errori non e' vuoto, non si deve salvare.
export function configDaCampi(campi) {
  const c = campi || {};
  const errori = [];

  const distacchi = {};
  const nomiDistacchi = ['fino a 4 giocatori', '5 o 6 giocatori', '7 o 8 giocatori', '9 o 10 giocatori', '11 o 12 giocatori'];
  DISTACCHI.forEach(([campo, chiave], i) => {
    distacchi[chiave] = leggiIntero(c, campo, `Distacco per ${nomiDistacchi[i]}`, LIMITI.distacco, errori);
  });

  const malus = leggiIntero({ m: Math.abs(numero(c.malusPrimo)) }, 'm', 'Il primo arretra di', LIMITI.malusPrimo, errori);

  const valori = {
    attivo: c.attivo === true,
    giocatoriMinimi: leggiIntero(c, 'giocatoriMinimi', 'Giocatori in partita, almeno', LIMITI.giocatoriMinimi, errori),
    distacchi,
    primoMassimo: leggiIntero(c, 'primoMassimo', 'Casella massima del primo', LIMITI.primoMassimo, errori),
    giriDiPausa: leggiIntero(c, 'giriDiPausa', 'Giri di pausa', LIMITI.giriDiPausa, errori),
    maxPerPartita: leggiIntero(c, 'maxPerPartita', 'Massimo in una partita', LIMITI.maxPerPartita, errori),
    bonusUltimo: leggiIntero(c, 'bonusUltimo', "L'ultimo avanza di", LIMITI.bonusUltimo, errori),
    malusPrimo: malus === null ? null : (malus === 0 ? 0 : -malus),   // sempre negativo (o zero)
    ultimoSaltaSeFallisce: c.ultimoSaltaSeFallisce === true,
    ultimoTiraDopoSuccesso: c.ultimoTiraDopoSuccesso === true,
    tentativi: leggiIntero(c, 'tentativi', 'Tentativi', LIMITI.tentativi, errori),
    prontoMs: leggiSecondi(c, 'prontoS', 'Tempo per «Sono pronto»', LIMITI.prontoS, errori),
    sbirciataMs: leggiSecondi(c, 'sbirciataS', 'Sbirciata del primo', LIMITI.sbirciataS, errori),
    esitoMs: leggiSecondi(c, 'esitoS', "Tempo per leggere l'esito", LIMITI.esitoS, errori),
    livelli: {
      normale: leggiLivello(c, 'normale', 'Livello normale', errori),
      bambini: leggiLivello(c, 'bambini', 'Livello bambini', errori)
    }
  };

  return { valori, errori };
}

// ---------- valori di prova e valori di base ----------

// I campi attuali con sopra i valori di prova. Non cambia l'originale.
export function conValoriDiProva(campi) {
  return { ...campi, ...CAMPI_DI_PROVA };
}

// Vero se i campi sembrano fatti per PROVARE (pochi giocatori o distacchi minimi),
// cioe' non adatti a una serata vera. Serve ad avvisare l'amministratore.
export function sembranoValoriDiProva(campi) {
  const c = campi || {};
  if (c.attivo === false) return false;
  const minimi = numero(c.giocatoriMinimi);
  if (Number.isFinite(minimi) && minimi < 3) return true;
  return DISTACCHI.some(([campo]) => {
    const d = numero(c[campo]);
    return Number.isFinite(d) && d < 10;
  });
}
