// link-approfondimento.js
// Controlla il link del pulsante "Approfondisci" di una domanda Conoscenza.
//
// Il gioco non contiene testi di JW.org: si limita a condividere un
// collegamento che porta a una pagina del sito, scelta da chi gestisce le
// domande. Per questo il link viene controllato con regole strette, sia
// quando si salva (pannello Impostazioni, importazione Excel) sia prima di
// mostrare il pulsante sul telefono:
//  - solo indirizzi che cominciano con https://
//  - solo i siti www.jw.org, jw.org e wol.jw.org (la Biblioteca online)
//  - solo caratteri normali di un indirizzo web: niente spazi, niente lettere
//    accentate né caratteri invisibili, niente virgolette o parentesi
//    angolari, niente barre rovesciate
//  - niente nome utente e password, niente porte particolari
// Il link va incollato così com'è, per esempio dal pulsante "Condividi"
// della Biblioteca online: non serve togliere i parametri.

export const LUNGHEZZA_MASSIMA_LINK = 600;

const SITI_AMMESSI = ['www.jw.org', 'jw.org', 'wol.jw.org'];

// Un indirizzo web scritto solo con i caratteri visibili della tastiera
// inglese (dal punto esclamativo alla tilde): niente spazi, a capo,
// caratteri di controllo, lettere accentate o caratteri invisibili, di quelli
// che si portano dietro certi copia-incolla. Un indirizzo vero è già scritto
// così: una "é" diventa %C3%A9 e simili.
const SOLO_CARATTERI_VISIBILI = /^[\x21-\x7e]+$/;

// Dopo il nome del sito può esserci solo la fine del link oppure un / ? #
// seguito da altri caratteri (così "https://www.jw.org@altrosito.it" o
// "https://www.jw.org:8080" non passano). Mai virgolette, apici, apici
// inversi, parentesi angolari o barre rovesciate: in un link vero non
// servono, e darebbero problemi a chi un domani lo inserisse in una pagina.
const FORMA_DEL_LINK = /^https:\/\/(?:www\.|wol\.)?jw\.org(?:[/?#][^"'<>`\\]*)?$/i;

function rifiuta(motivo) {
  return { valido: false, link: '', motivo };
}

// Controlla il testo scritto o incollato come link. Restituisce sempre un
// oggetto, mai un errore:
//   { valido: true,  link: '' }              nessun link (campo vuoto): va
//                                            bene, il pulsante non comparirà
//   { valido: true,  link: 'https://...' }   link buono, senza gli spazi ai bordi
//   { valido: false, link: '', motivo }      da correggere; "motivo" è una
//                                            frase pensata per chi lo scrive
export function controllaLink(testo) {
  if (testo === undefined || testo === null) return { valido: true, link: '' };
  if (typeof testo !== 'string') return rifiuta('Il link deve essere un testo.');

  const link = testo.trim();
  if (link === '') return { valido: true, link: '' };

  if (link.length > LUNGHEZZA_MASSIMA_LINK) {
    return rifiuta(`Il link è troppo lungo (al massimo ${LUNGHEZZA_MASSIMA_LINK} caratteri).`);
  }
  if (!SOLO_CARATTERI_VISIBILI.test(link)) {
    return rifiuta('Il link contiene spazi, a capo o caratteri speciali o invisibili (anche le lettere accentate): copialo di nuovo dal pulsante Condividi del sito.');
  }
  if (!/^https:\/\//i.test(link)) {
    return rifiuta('Il link deve cominciare con https://');
  }

  let indirizzo;
  try {
    indirizzo = new URL(link);
  } catch (errore) {
    return rifiuta('Questo non sembra un indirizzo web valido.');
  }
  if (!SITI_AMMESSI.includes(indirizzo.hostname)) {
    return rifiuta('Il link deve portare a JW.org (www.jw.org, jw.org oppure wol.jw.org).');
  }
  if (!FORMA_DEL_LINK.test(link)) {
    return rifiuta('Il link non è nel formato previsto: copialo di nuovo dal pulsante Condividi del sito.');
  }

  return { valido: true, link };
}

// Per chi deve usare il link (il tabellone e il telefono): restituisce il
// link se è buono, altrimenti null. Un campo vuoto, mancante o sbagliato
// significa "per questa domanda niente pulsante Approfondisci".
export function linkDaUsare(valore) {
  const esito = controllaLink(valore);
  return esito.valido && esito.link !== '' ? esito.link : null;
}
