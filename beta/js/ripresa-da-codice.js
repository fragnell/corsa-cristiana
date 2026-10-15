// ripresa-da-codice.js
// Riprendere una partita gia' iniziata scrivendo il suo codice sul tabellone: serve quando il tabellone si
// e' spento (o si e' chiuso la pagina per sbaglio) e si vuole continuare su un altro schermo, per esempio
// un altro computer o un tablet. I telefoni non devono fare niente: continuano a giocare nella stessa partita.
//
// Qui c'e' solo la parte che DECIDE: "questa partita si puo' riprendere?". Niente schermo e niente Firebase
// (le due cose che servono arrivano come parametri), cosi' si prova da sola (vedi test-ripresa-da-codice.mjs).
// L'aspetto (il pulsante, la casella del codice) e' in tabellone-ui.js.

import { FORMATO_CODICE_PARTITA } from './link-partita.js';

// Una partita ferma da piu' di questo tempo non si riprende. Il codice si scrive di proposito, quindi il
// limite e' piu' largo di quello della ripresa automatica sullo stesso schermo (20 minuti).
export const LIMITE_RIPRESA_DA_CODICE_MS = 6 * 60 * 60 * 1000;

export const MESSAGGI_RIPRESA = {
  formato: 'Il codice è di 4 lettere, come quello che vedi sui telefoni (per esempio ABCD).',
  'non-trovata': 'Non trovo nessuna partita già iniziata con questo codice.',
  finita: 'Questa partita è già finita.',
  vecchia: 'Questa partita è ferma da troppo tempo per essere ripresa.',
  'aperta-altrove': 'Questa partita risulta ancora aperta su un altro schermo. Se quello schermo non funziona più, aspetta un minuto e riprova.',
  errore: 'Non riesco a collegarmi in questo momento. Riprova tra poco.'
};

// Il codice come lo scrive la persona: senza spazi attorno, in maiuscolo.
export function normalizzaCodice(testo) {
  return String(testo === null || testo === undefined ? '' : testo).trim().toUpperCase();
}

// codiceScritto: quello che ha digitato la persona
// leggiStato(codice): lo stato della partita su Firebase (o null se la partita non e' ancora iniziata)
// tabellonePresente(codice): true se un tabellone e' collegato adesso a quella partita
// Restituisce { ok: true, codice } oppure { ok: false, motivo, messaggio }. Non lancia mai errori.
export async function controllaRipresaDaCodice(codiceScritto, { leggiStato, tabellonePresente, adesso = () => Date.now(), limiteMs = LIMITE_RIPRESA_DA_CODICE_MS } = {}) {
  const rifiuta = (motivo) => ({ ok: false, motivo, messaggio: MESSAGGI_RIPRESA[motivo] });

  const codice = normalizzaCodice(codiceScritto);
  if (!FORMATO_CODICE_PARTITA.test(codice)) return rifiuta('formato');

  try {
    const stato = await leggiStato(codice);
    if (!stato || typeof stato !== 'object' || !stato.giocatori) return rifiuta('non-trovata');
    if (stato.vincitore !== null && stato.vincitore !== undefined) return rifiuta('finita');

    // Senza data (partite salvate molto tempo fa) si considera ferma da sempre, per prudenza.
    const ultimo = typeof stato.ultimoAggiornamento === 'number' ? stato.ultimoAggiornamento : 0;
    if (adesso() - ultimo > limiteMs) return rifiuta('vecchia');

    // Se un tabellone e' ancora collegato, riprendere da un secondo schermo farebbe litigare i due.
    if (await tabellonePresente(codice)) return rifiuta('aperta-altrove');

    return { ok: true, codice };
  } catch (errore) {
    return rifiuta('errore');
  }
}
