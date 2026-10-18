// testo-sicuro.js
// Piccole funzioni per mettere nella pagina i testi scritti da chi gioca (il nome, una risposta...)
// senza che qualcuno possa farci passare del codice.
//
// Il problema: quando un testo viene infilato "com'e'" dentro una pagina con innerHTML, il browser lo
// legge come HTML. Un nome come   <img src=x onerror=...>   non sarebbe piu' un nome: sarebbe un
// programmino che gira sullo schermo di tutti gli altri (e, se per caso e' aperto l'Admin, anche li').
//
// La regola:
//  - dove si puo', si usa textContent (scrive sempre e solo testo, e' gia' sicuro);
//  - dove serve per forza scrivere un pezzo di HTML con dentro il testo di qualcuno, il testo passa
//    prima da testoSicuro();
//  - un numero che arriva dal database passa da numeroSicuro(), un colore da coloreSicuro();
//  - le risposte che arrivano da un telefono passano da risposteSicure(): sono sempre un elenco di
//    testi di lunghezza ragionevole, qualunque cosa il telefono abbia scritto nel database.
//
// Nessuna di queste funzioni lancia errori, qualunque cosa riceva.

import { PALETTE } from './colori.js';

const SOSTITUZIONI = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Il testo, con i simboli speciali trasformati in semplici lettere da mostrare:
//   <   >   &   "   '        (valido sia dentro un paragrafo sia dentro un attributo tra virgolette)
// Se arriva "niente" (null, undefined) restituisce una stringa vuota.
export function testoSicuro(valore) {
  if (valore === null || valore === undefined) return '';
  let testo;
  try {
    testo = String(valore);
  } catch (errore) {
    return '';
  }
  return testo.replace(/[&<>"']/g, simbolo => SOSTITUZIONI[simbolo]);
}

// Un numero vero, oppure 0. Per i contatori letti dal database: se qualcuno ci avesse scritto del
// testo al posto di un numero, qui diventa 0.
export function numeroSicuro(valore) {
  const numero = typeof valore === 'number' ? valore : Number(valore);
  return Number.isFinite(numero) ? numero : 0;
}

// Il colore di un giocatore da mettere in uno stile: o un colore della tavolozza (rosso, blu...), o un
// codice esadecimale (#e74c3c). Tutto il resto diventa un grigio neutro, mai un testo qualsiasi.
export function coloreSicuro(colore) {
  if (typeof colore === 'string') {
    if (Object.prototype.hasOwnProperty.call(PALETTE, colore)) return PALETTE[colore];
    if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(colore)) return colore;
  }
  return '#999999';
}

// Le risposte inviate da un telefono: sempre un elenco di testi, non troppi e non lunghissimi.
// Se il telefono ha mandato altro (un solo testo, un numero, un oggetto...) si fa il possibile:
// un testo diventa un elenco di uno, il resto diventa un elenco vuoto (cioe' "nessuna risposta").
export const MASSIMO_RISPOSTE = 100;
export const MASSIMO_CARATTERI_RISPOSTA = 500;

export function risposteSicure(valore) {
  const elenco = Array.isArray(valore) ? valore : (typeof valore === 'string' ? [valore] : []);
  return elenco
    .filter(r => typeof r === 'string' || (typeof r === 'number' && Number.isFinite(r)))
    .slice(0, MASSIMO_RISPOSTE)
    .map(r => String(r).slice(0, MASSIMO_CARATTERI_RISPOSTA));
}
