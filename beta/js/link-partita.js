// link-partita.js
// Il "link per entrare in una partita": lo costruisce il tabellone (e' quello che sta dentro il
// QR della lobby) e lo legge il telefono (giocatore.html). Due funzioni semplici, senza pagina e
// senza Firebase, cosi' si provano da sole (vedi test-qr-lobby.mjs).

// Il codice partita: 4 lettere maiuscole, senza la I e la O (vedi generaCodicePartita in
// sincronizzazione.js). Lo stesso formato e' controllato anche dalle regole di sicurezza di Firebase.
export const FORMATO_CODICE_PARTITA = /^[A-HJ-NP-Z]{4}$/;

// Il link che porta il telefono dritto nella partita:  <cartella del tabellone>/giocatore.html?codice=ABCD
// L'indirizzo si ricava da dove e' aperto il tabellone (beta, gioco vero, un dominio nuovo...):
// non c'e' nessun indirizzo scritto a mano da cambiare in futuro.
export function indirizzoPerEntrare(codice, paginaDelTabellone) {
  if (typeof codice !== 'string' || !FORMATO_CODICE_PARTITA.test(codice)) throw new Error('Codice partita non valido: ' + codice);
  const indirizzo = new URL('giocatore.html', paginaDelTabellone);
  indirizzo.searchParams.set('codice', codice);
  return indirizzo.href;
}

// Legge il codice dalla parte del link che sta dopo il "?"  (per esempio "?codice=abcd").
// Se manca, o non e' un codice valido, restituisce null (e il telefono chiede il codice come sempre).
export function codiceDalLink(ricerca) {
  const valore = new URLSearchParams(ricerca).get('codice');
  if (!valore) return null;
  const codice = valore.trim().toUpperCase();
  return FORMATO_CODICE_PARTITA.test(codice) ? codice : null;
}
