// sessione.js
// Salmo 133:1 — la "sessione" di una prova: i dati che la descrivono, quelli
// segreti (la soluzione e l'ordine mescolato) e il controllo delle consegne.
// Solo funzioni pure: niente Firebase, niente pagina, niente orologio vero
// (l'ora arriva sempre da fuori).
//
// Come viaggiano i dati:
//   - la parte PUBBLICA (fase, nomi, scadenze...) sta dentro lo stato della
//     partita, in "salmoInCorso": la vedono tutti i telefoni;
//   - la parte SEGRETA sta in due nodi a parte: il primo legge solo la
//     soluzione, l'ultimo legge solo i riquadri mescolati. Il tabellone non
//     mostra mai ne' l'una ne' gli altri durante la prova.

import { creaProva, ordineValido, ordineCorretto } from './mosaico.js';

// Dopo la scadenza il tabellone aspetta ancora un attimo la consegna
// automatica del telefono dell'ultimo (quella che parte da sola a tempo scaduto).
export const GRAZIA_CONSEGNA_FINALE_MS = 4000;

// Quanto resta a schermo il messaggio "prova annullata".
export const DURATA_ANNULLAMENTO_MS = 4000;

// Spazio per l'animazione delle pedine dopo l'esito (10 caselle x 300 ms, con margine).
export const MARGINE_ANIMAZIONE_MS = 8000;

// Spazio di sicurezza in piu', oltre la somma di tutte le fasi.
export const MARGINE_SICUREZZA_MS = 30000;

// Toglie ricorsivamente ogni "undefined": Firebase rifiuta tutta la scrittura
// se ne trova anche uno solo, anche dentro un oggetto annidato.
export function senzaUndefined(valore) {
  if (Array.isArray(valore)) return valore.map(senzaUndefined);
  if (valore && typeof valore === 'object') {
    const pulito = {};
    for (const [chiave, v] of Object.entries(valore)) {
      if (v !== undefined) pulito[chiave] = senzaUndefined(v);
    }
    return pulito;
  }
  return valore;
}

// Crea la sessione per una decisione di valutaSalmo (scatta: true).
// Restituisce { pubblica, segretoPrimo, segretoUltimo, soluzione }.
//   pubblica       va dentro stato.salmoInCorso
//   segretoPrimo   va in partite/{codice}/salmo/segreti/primo
//   segretoUltimo  va in partite/{codice}/salmo/segreti/ultimo
//   soluzione      resta in memoria nel tabellone (per controllare le consegne)
export function creaSessione({ decisione, cfg, idDisegni, adesso, rng = Math.random }) {
  const livelloBase = cfg.livelli[decisione.livello] || cfg.livelli.normale;
  // Almeno 2 riquadri (con uno solo la prova sarebbe gia' finita) e mai piu'
  // dei disegni che abbiamo.
  const riquadri = Math.max(2, Math.min(livelloBase.riquadri, idDisegni.length));
  const livello = { ...livelloBase, riquadri };
  const prova = creaProva(livello, idDisegni, rng);
  const id = 's' + Math.floor(adesso).toString(36) + Math.floor(rng() * 36 ** 4).toString(36);

  const durataTotale = cfg.prontoMs + livello.anteprimaMs + livello.provaMs +
    GRAZIA_CONSEGNA_FINALE_MS + cfg.esitoMs + MARGINE_ANIMAZIONE_MS + MARGINE_SICUREZZA_MS;

  const pubblica = {
    id,
    fase: 'pronti',
    primoId: decisione.primo,
    ultimoId: decisione.ultimo,
    livello: decisione.livello,
    riquadri: prova.tessere.length,
    righe: prova.righe,
    colonne: prova.colonne,
    scadenza: adesso + cfg.prontoMs,
    scadenzaMassima: adesso + durataTotale,
    tentativiMax: cfg.tentativi,
    tentativiFatti: 0,
    anteprimaMs: livello.anteprimaMs,
    provaMs: livello.provaMs,
    sbirciataMs: cfg.sbirciataMs,
    esitoMs: cfg.esitoMs,
    bonus: cfg.bonusUltimo,
    malus: Math.abs(cfg.malusPrimo),
    ultimoSalta: cfg.ultimoSaltaSeFallisce
  };

  return {
    pubblica: senzaUndefined(pubblica),
    segretoPrimo: { sid: id, tessere: prova.tessere },
    segretoUltimo: { sid: id, mescolata: prova.mescolata },
    soluzione: prova.tessere
  };
}

// Il ruolo di un giocatore nella sessione: 'primo', 'ultimo' oppure null.
export function ruoloDi(sessione, giocatoreId) {
  if (!sessione || typeof sessione !== 'object') return null;
  if (sessione.primoId === giocatoreId) return 'primo';
  if (sessione.ultimoId === giocatoreId) return 'ultimo';
  return null;
}

// Una sessione rimasta "appesa" (tabellone sparito) smette di valere dopo la
// scadenza massima: il telefono la ignora e torna a funzionare normalmente.
export function sessioneScaduta(sessione, adesso, graziaMs = 5000) {
  if (!sessione || !Number.isFinite(sessione.scadenzaMassima)) return true;
  return adesso > sessione.scadenzaMassima + graziaMs;
}

// ---------- leggere cio' che mandano i telefoni ----------
// Firebase restituisce a volte un array e a volte un oggetto con chiavi
// numeriche, a seconda di quali chiavi ci sono: si leggono tutte e due le forme.

function elemento(raccolta, indice) {
  if (raccolta === null || raccolta === undefined) return undefined;
  return raccolta[indice] !== undefined ? raccolta[indice] : raccolta[String(indice)];
}

export function eProntoDi(risposte, giocatoreId) {
  const pronto = risposte && risposte.pronto;
  return elemento(pronto, giocatoreId) === true;
}

export function consegnaNumero(risposte, indice) {
  const consegne = risposte && risposte.consegne;
  const c = elemento(consegne, indice);
  return c === undefined || c === null ? null : c;
}

export function sbirciataFatta(risposte) {
  return !!(risposte && risposte.sbirciata === true);
}

// Firebase restituisce un elenco a volte come array e a volte come oggetto con
// le chiavi "0", "1", "2"... Questa funzione li legge tutti e due. Restituisce
// null se l'oggetto non e' un elenco "pieno" (chiavi mancanti o strane).
export function comeElenco(valore) {
  if (Array.isArray(valore)) return valore;
  if (valore && typeof valore === 'object') {
    const quante = Object.keys(valore).length;
    const lista = [];
    for (let i = 0; i < quante; i++) {
      if (!Object.prototype.hasOwnProperty.call(valore, String(i))) return null;
      lista.push(valore[String(i)]);
    }
    return lista;
  }
  return null;
}

// Controlla una consegna ricevuta:
//   'giusta'     ordine valido e uguale alla soluzione
//   'sbagliata'  ordine valido ma diverso
//   'non-valida' dato rovinato (non conta come tentativo)
export function valutaConsegna(consegna, soluzione) {
  if (!consegna || typeof consegna !== 'object') return 'non-valida';
  const ordine = comeElenco(consegna.ordine);
  if (!ordine || !ordineValido(ordine, soluzione)) return 'non-valida';
  return ordineCorretto(ordine, soluzione) ? 'giusta' : 'sbagliata';
}
