// filtri-carte.js
// Il "cervello" dei filtri dell'elenco delle domande Conoscenza, nel pannello Admin.
// Non tocca la pagina: riceve l'elenco delle carte e i filtri scelti, e restituisce le carte
// da mostrare (e i conteggi). Cosi' si puo' provare con i test, senza aprire nessun browser.
//
// I filtri sono un semplice oggetto:
//   { testo: '', livello: 'tutte', tipo: 'tutti', link: 'tutti', ordine: 'inserimento' }
//   livello: 'tutte' | 'normali' | 'junior'
//   tipo:    'tutti' | 'diretta' | 'elenco' | 'scelta'
//   link:    'tutti' | 'con' (c'e' un link buono) | 'senza' (nessun link) | 'nonvalido' (scritto ma sbagliato)
//   ordine:  'inserimento' (come sono arrivate) | 'recenti' (le ultime per prime) | 'az' | 'senzalink'

import { linkDaUsare } from './link-approfondimento.js';

export const FILTRI_INIZIALI = Object.freeze({ testo: '', livello: 'tutte', tipo: 'tutti', link: 'tutti', ordine: 'inserimento' });

export const TIPI_DI_CARTA = ['diretta', 'elenco', 'scelta'];
const STATI_LINK = ['con', 'senza', 'nonvalido'];

// Un valore di filtro che non conosciamo (non puo' venire dai pulsanti, ma meglio non fidarsi) conta come "nessun filtro".
const livelloAttivo = f => f.livello === 'junior' || f.livello === 'normali';
const tipoAttivo = f => TIPI_DI_CARTA.includes(f.tipo);
const linkAttivo = f => STATI_LINK.includes(f.link);

// ---------- piccoli aiuti ----------

// Il testo "pulito" per cercare: tutto minuscolo, senza accenti, apostrofi tutti uguali, spazi singoli.
// Cosi' "Eta'" o "ETÀ" trovano "età", e "dell’Eden" trova "dell'Eden".
export function normalizzaTesto(testo) {
  return String(testo === undefined || testo === null ? '' : testo)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function livelloDi(carta) {
  return carta && carta.junior ? 'junior' : 'normale';
}

// Una carta con un tipo che non conosciamo si tratta come "diretta" (come fa l'elenco da sempre).
export function tipoDi(carta) {
  return carta && TIPI_DI_CARTA.includes(carta.tipo) ? carta.tipo : 'diretta';
}

// 'con' = c'e' un link buono (il pulsante Approfondisci comparira'), 'nonvalido' = c'e' scritto
// qualcosa ma non e' un link buono (il pulsante non comparira'), 'senza' = niente.
export function statoLink(carta) {
  const testo = carta ? carta.linkApprofondimento : undefined;
  if (testo === undefined || testo === null || String(testo).trim() === '') return 'senza';
  return linkDaUsare(testo) ? 'con' : 'nonvalido';
}

// Le risposte della carta come elenco di testi (accetta anche i dati un po' strani di Firebase).
function comeElenco(valore) {
  if (valore === undefined || valore === null) return [];
  if (Array.isArray(valore)) return valore.filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(String);
  if (typeof valore === 'object') return comeElenco(Object.values(valore));
  return String(valore).trim() === '' ? [] : [String(valore)];
}

// Tutte le risposte e le opzioni, per la ricerca.
export function risposteDi(carta) {
  if (!carta) return [];
  return [
    ...comeElenco(carta.risposta),
    ...comeElenco(carta.rispostePossibili),
    ...comeElenco(carta.opzioni),
    ...comeElenco(carta.rispostaCorretta)
  ];
}

// Una riga breve con la risposta giusta, da mostrare sotto la domanda nell'elenco.
export function descriviRisposta(carta) {
  if (!carta) return '';
  const tipo = tipoDi(carta);
  if (tipo === 'scelta') {
    return carta.rispostaCorretta ? `✔ ${carta.rispostaCorretta}` : '';
  }
  if (tipo === 'elenco') {
    const possibili = comeElenco(carta.rispostePossibili);
    const minimo = carta.minimoRichiesto || 1;
    return possibili.length > 0 ? `almeno ${minimo} tra ${possibili.length} risposte possibili` : '';
  }
  return comeElenco(carta.risposta).join(' · ');
}

// Il testo su cui cerca la casella "Cerca": la domanda e tutte le risposte.
export function testoDiRicerca(carta) {
  return normalizzaTesto([carta && carta.domanda, ...risposteDi(carta)].join(' '));
}

// ---------- filtrare ----------

// True se la carta passa i filtri (tutte le parole scritte nella ricerca devono comparire).
export function corrisponde(carta, filtri) {
  const f = { ...FILTRI_INIZIALI, ...(filtri || {}) };

  if (f.livello === 'junior' && livelloDi(carta) !== 'junior') return false;
  if (f.livello === 'normali' && livelloDi(carta) !== 'normale') return false;
  if (tipoAttivo(f) && tipoDi(carta) !== f.tipo) return false;
  if (linkAttivo(f) && statoLink(carta) !== f.link) return false;

  const parole = normalizzaTesto(f.testo).split(' ').filter(Boolean);
  if (parole.length > 0) {
    const testo = testoDiRicerca(carta);
    if (!parole.every(parola => testo.includes(parola))) return false;
  }
  return true;
}

const PESO_LINK = { senza: 0, nonvalido: 1, con: 2 };

// Mette le carte nell'ordine scelto. Non modifica l'elenco ricevuto.
export function ordinaCarte(carte, ordine) {
  const copia = [...carte];
  if (ordine === 'recenti') return copia.reverse();
  if (ordine === 'az') {
    return copia.sort((a, b) => String(a.domanda || '').localeCompare(String(b.domanda || ''), 'it', { sensitivity: 'base' }));
  }
  if (ordine === 'senzalink') {
    return copia.sort((a, b) => PESO_LINK[statoLink(a)] - PESO_LINK[statoLink(b)]);   // a parita' resta l'ordine di arrivo
  }
  return copia;   // 'inserimento' (o qualsiasi altro valore): come sono arrivate
}

// Le carte da mostrare: prima si filtra, poi si ordina.
export function filtraCarte(carte, filtri) {
  const f = { ...FILTRI_INIZIALI, ...(filtri || {}) };
  return ordinaCarte((carte || []).filter(carta => corrisponde(carta, f)), f.ordine);
}

// Quanti filtri sono accesi (la ricerca conta uno se c'e' qualcosa scritto): per il pulsante "Azzera".
export function filtriAttivi(filtri) {
  const f = { ...FILTRI_INIZIALI, ...(filtri || {}) };
  let n = 0;
  if (normalizzaTesto(f.testo) !== '') n++;
  if (livelloAttivo(f)) n++;
  if (tipoAttivo(f)) n++;
  if (linkAttivo(f)) n++;
  return n;
}

// I conteggi mostrati accanto ai pulsanti dei filtri (su tutte le carte, senza filtri).
export function contaCarte(carte) {
  const conti = {
    totale: 0,
    livello: { normali: 0, junior: 0 },
    tipo: { diretta: 0, elenco: 0, scelta: 0 },
    link: { con: 0, senza: 0, nonvalido: 0 }
  };
  for (const carta of carte || []) {
    conti.totale++;
    conti.livello[livelloDi(carta) === 'junior' ? 'junior' : 'normali']++;
    conti.tipo[tipoDi(carta)]++;
    conti.link[statoLink(carta)]++;
  }
  return conti;
}

// Il testo di una carta messo al sicuro per scriverlo dentro la pagina (HTML): una domanda che contiene < o &
// non deve mai diventare un pezzo di pagina.
export function proteggiHtml(testo) {
  return String(testo === undefined || testo === null ? '' : testo)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
