// recensioni-evidenza.js
// Le recensioni "in evidenza": quelle che l'amministratore sceglie (con la stellina nella scheda
// Recensioni dell'Admin) per farle scorrere nella pagina principale, sotto "Alcune recensioni".
//
// Come funziona: le recensioni vere (in "recensioni/") le puo' leggere solo l'amministratore. Quando
// ne mette una in evidenza, l'Admin ne scrive una COPIA ridotta in "recensioniInEvidenza/<chiave>":
// solo voto, commento, data e (se l'Admin lo lascia) il soprannome. Quella copia la puo' leggere
// chiunque, ed e' l'unica cosa che vede la pagina principale. Togliere la stellina cancella la copia.
//
// Qui c'e' solo la logica (niente pagina, niente Firebase): si prova con test-recensioni-evidenza.mjs.

import { votoDi, commentoDi, nomeDi, dataDi } from './filtri-recensioni.js';

export const MAX_IN_HOME = 30;             // al massimo tante recensioni scorrono in home
const MAX_COMMENTO = 600;
const MAX_NOME = 30;

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// La copia da scrivere in "recensioniInEvidenza/<chiave>". conNome: false = la recensione compare senza firma.
export function copiaPerEvidenza(recensione, conNome = true, adesso = Date.now()) {
  const copia = {
    stelle: votoDi(recensione),
    commento: commentoDi(recensione),
    creataIl: dataDi(recensione) || adesso,
    messaIl: adesso
  };
  const nome = nomeDi(recensione);
  if (conNome && nome) copia.nome = nome;
  return copia;
}

// Rimette in ordine quello che arriva da Firebase (che potrebbe contenere di tutto):
// solo voci valide, dalla piu' recente alla piu' vecchia, al massimo MAX_IN_HOME.
// Una recensione senza voto e senza commento non si mostra (non direbbe niente).
export function elencoPerHome(oggetto) {
  if (!oggetto || typeof oggetto !== 'object') return [];
  const elenco = [];
  for (const [chiave, grezza] of Object.entries(oggetto)) {
    if (!grezza || typeof grezza !== 'object') continue;
    const stelle = votoDi(grezza);
    const commento = commentoDi(grezza).slice(0, MAX_COMMENTO);
    if (!stelle && !commento) continue;
    const nome = nomeDi(grezza).slice(0, MAX_NOME);
    elenco.push({ chiave, stelle, commento, nome, creataIl: dataDi(grezza) });
  }
  elenco.sort((a, b) => b.creataIl - a.creataIl);
  return elenco.slice(0, MAX_IN_HOME);
}

// "12 novembre 2026" (senza ora). Data mancante o strana: ''.
export function dataBreve(millisecondi) {
  const n = Number(millisecondi);
  if (!Number.isFinite(n) || n <= 0) return '';
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

// "★★★★☆"
export function stelline(voto) {
  const v = Math.max(0, Math.min(5, Math.round(Number(voto) || 0)));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
}
