// recensioni-logica.js
// Il "cervello" delle recensioni di fine partita, lato telefono. Non tocca la pagina e non parla
// con Firebase: decide SE chiedere la recensione, tiene il conto delle partite fatte con quel
// telefono, pulisce e controlla quello che la persona scrive e prepara il pacchetto da spedire.
// Cosi' si prova tutto con i test (test-recensioni.mjs), senza aprire nessun browser.
//
// La recensione NON porta mai cognome, codice della partita, colore o altri dati personali. Si salvano il voto,
// il commento, qualche dato sulla partita (quanti giocatori, normale o veloce, ecc.) e, se l'Admin lascia accesa
// la spunta "conNome", il SOPRANNOME che la persona ha scelto in quella partita: il telefono lo dice chiaramente
// prima dell'invio. Con la spunta spenta la recensione resta del tutto anonima.

// La "memoria" del telefono (localStorage): una sola voce, valida per tutto il sito.
export const CHIAVE_ARCHIVIO = 'corsa-cristiana-recensioni';

export const STELLE_MINIME = 1;
export const STELLE_MASSIME = 5;
export const MAX_CARATTERI_COMMENTO = 600;
export const MAX_CARATTERI_NOME = 30;      // il campo del nome in lobby non ha limiti: nella recensione si tengono i primi 30

// Due "fine partita" con lo stesso codice entro questo tempo sono la STESSA partita
// (per esempio: la pagina del telefono e' stata ricaricata dopo la vittoria): si contano una volta sola.
export const STESSA_PARTITA_ENTRO_MS = 12 * 60 * 60 * 1000;

const PRIME_PARTITE_DI_BASE = 3;

// ---------- le impostazioni (arrivano da config.js e dall'Admin) ----------

// Rimette in ordine le impostazioni anche se su Firebase c'e' scritto qualcosa di strano:
// una cosa che non si capisce vale come il valore di base.
export function sistemaConfigRecensioni(grezza) {
  const g = grezza && typeof grezza === 'object' ? grezza : {};
  const n = Number(g.primePartite);
  return {
    attiva: g.attiva !== false,
    soloNuovi: g.soloNuovi !== false,
    primePartite: Number.isInteger(n) && n >= 1 && n <= 50 ? n : PRIME_PARTITE_DI_BASE,
    // Se non c'e' scritto niente vale il valore di base (acceso). Se c'e' scritto qualcosa di strano si sta dalla parte
    // della riservatezza: niente soprannome. Solo "true" lo accende.
    conNome: g.conNome === undefined ? true : g.conNome === true
  };
}

// ---------- la memoria del telefono ----------
// Forma: { partite: 2, inviata: false, ultimaPartita: { codice: 'ABCD', quando: 1760000000000, chiesta: true } }
//   partite        quante partite finite ha visto questo telefono (ognuna conta una volta sola)
//   inviata        true quando la persona ha mandato una recensione: da quel momento non la si disturba piu'
//   ultimaPartita  l'ultima partita vista, per non contarla due volte e non chiedere due volte nella stessa

export function archivioVuoto() {
  return { partite: 0, inviata: false, ultimaPartita: null };
}

// Legge la memoria dal testo salvato nel telefono. Qualunque cosa ci sia scritta (niente, un testo
// rotto, un formato vecchio...) restituisce sempre una memoria valida.
export function leggiArchivio(testo) {
  const archivio = archivioVuoto();
  let grezzo = null;
  try {
    grezzo = testo ? JSON.parse(testo) : null;
  } catch (errore) {
    return archivio;
  }
  if (!grezzo || typeof grezzo !== 'object' || Array.isArray(grezzo)) return archivio;

  if (Number.isInteger(grezzo.partite) && grezzo.partite >= 0 && grezzo.partite <= 100000) archivio.partite = grezzo.partite;
  archivio.inviata = grezzo.inviata === true;

  const u = grezzo.ultimaPartita;
  if (u && typeof u === 'object' && typeof u.codice === 'string' && u.codice.length > 0 && u.codice.length <= 20 && Number.isFinite(u.quando)) {
    archivio.ultimaPartita = { codice: u.codice, quando: u.quando, chiesta: u.chiesta === true };
  }
  return archivio;
}

export function scriviArchivio(archivio) {
  return JSON.stringify(archivio);
}

// Il telefono ha visto la fine della partita "codice". Restituisce { archivio, nuova }:
//   nuova = true  -> e' una partita mai vista: il conto sale di uno;
//   nuova = false -> e' la stessa di poco fa (pagina ricaricata): niente cambia.
export function registraFinePartita(archivio, codice, adesso) {
  const u = archivio.ultimaPartita;
  const stessa = !!u && u.codice === codice && Math.abs(adesso - u.quando) < STESSA_PARTITA_ENTRO_MS;
  if (stessa) return { archivio, nuova: false };
  return {
    archivio: { ...archivio, partite: archivio.partite + 1, ultimaPartita: { codice, quando: adesso, chiesta: false } },
    nuova: true
  };
}

// La richiesta e' stata mostrata per questa partita: se la pagina si ricarica non la si rimostra.
export function segnaChiesta(archivio) {
  if (!archivio.ultimaPartita) return archivio;
  return { ...archivio, ultimaPartita: { ...archivio.ultimaPartita, chiesta: true } };
}

// La persona ha mandato la sua recensione: da qui in poi niente piu' richieste su questo telefono.
export function segnaInviata(archivio) {
  return { ...archivio, inviata: true };
}

// ---------- chiedere o no? ----------

// "archivio" e' quello GIA' aggiornato con questa partita (partite include la partita appena finita);
// "nuova" viene da registraFinePartita; "forzata" e' l'interruttore di prova (?recensioni=prova).
// Restituisce { chiedere, motivo }: il motivo serve solo ai test e alla console.
export function decidiRichiesta({ config, archivio, nuova, forzata = false }) {
  if (forzata) return { chiedere: true, motivo: 'prova' };

  const c = sistemaConfigRecensioni(config);
  if (!c.attiva) return { chiedere: false, motivo: 'spenta' };
  if (archivio.inviata) return { chiedere: false, motivo: 'gia-inviata' };
  if (!nuova && archivio.ultimaPartita && archivio.ultimaPartita.chiesta) return { chiedere: false, motivo: 'gia-chiesta' };
  if (c.soloNuovi && archivio.partite > c.primePartite) return { chiedere: false, motivo: 'non-piu-nuovo' };
  return { chiedere: true, motivo: 'ok' };
}

// ---------- il commento ----------

// Un carattere che non deve finire nel commento: quelli "di controllo" (invisibili), quelli che girano
// il verso della scrittura, le mezze coppie di caratteri speciali. L'a capo si tiene.
function caratterePermesso(carattere) {
  const n = carattere.codePointAt(0);
  if (n === 10) return true;                                   // a capo
  if (n === 9) return true;                                    // tabulazione (poi diventa uno spazio)
  if (n < 32 || (n >= 127 && n <= 159)) return false;         // caratteri di controllo
  if (n >= 0xD800 && n <= 0xDFFF) return false;               // meta' di un carattere speciale rimasta sola
  if (n === 0x200B || n === 0x200E || n === 0x200F || n === 0xFEFF) return false;   // invisibili
  if ((n >= 0x202A && n <= 0x202E) || (n >= 0x2066 && n <= 0x2069)) return false;   // cambi di verso della scrittura
  return true;
}

// Mette il commento in ordine: toglie i caratteri strani, gli spazi in piu' e le righe vuote in eccesso,
// e lo accorcia a MAX_CARATTERI_COMMENTO. Mai un errore: se non c'e' niente restituisce ''.
export function pulisciCommento(testo) {
  let t = String(testo === undefined || testo === null ? '' : testo).replace(/\r\n?/g, '\n');
  t = Array.from(t).filter(caratterePermesso).join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const caratteri = Array.from(t);
  if (caratteri.length > MAX_CARATTERI_COMMENTO) t = caratteri.slice(0, MAX_CARATTERI_COMMENTO).join('').trim();
  return t;
}

// ---------- il soprannome ----------

// Il soprannome che la persona ha scelto in lobby, messo in ordine: a capo e tabulazioni diventano spazi, via i
// caratteri strani (invisibili, di controllo, che girano il verso della scrittura), via gli spazi in piu',
// al massimo MAX_CARATTERI_NOME caratteri. Mai un errore: se non e' un testo, o resta vuoto, restituisce ''
// e la recensione parte senza soprannome.
export function pulisciNome(nome) {
  if (typeof nome !== 'string') return '';
  const t = Array.from(nome.replace(/[\r\n\t]+/g, ' ')).filter(caratterePermesso).join('').replace(/ {2,}/g, ' ').trim();
  const caratteri = Array.from(t);
  return caratteri.length > MAX_CARATTERI_NOME ? caratteri.slice(0, MAX_CARATTERI_NOME).join('').trim() : t;
}

// La riga sotto il modulo, che dice con chiarezza cosa viene salvato. Con un soprannome lo scrive per intero
// (chi legge vede esattamente cosa partira'); senza, dice che la recensione e' anonima.
export function testoRiservatezza(nome) {
  const soprannome = pulisciNome(nome);
  return soprannome
    ? `Sarà firmata con il tuo soprannome «${soprannome}». Salviamo solo quello, il voto, il commento e il tipo di partita.`
    : 'È anonima: salviamo solo il voto, il commento e il tipo di partita, non il tuo nome.';
}

// ---------- da quale versione del gioco arriva ----------

// La copia di prova vive nella cartella /beta/ del sito; il gioco ufficiale no.
// Cosi' la stessa pagina, quando la copia di prova diventa il gioco ufficiale, si comporta da sola nel modo giusto.
export function versioneDalPercorso(percorso) {
  return String(percorso === undefined || percorso === null ? '' : percorso).includes('/beta/') ? 'beta' : 'ufficiale';
}

// ---------- il pacchetto da spedire ----------

export function stelleValide(stelle) {
  return Number.isInteger(stelle) && stelle >= STELLE_MINIME && stelle <= STELLE_MASSIME;
}

// Costruisce quello che va scritto su Firebase (percorso recensioni/<chiave>).
// Firebase non accetta "undefined": un dato che manca non si scrive proprio.
//   versione: 'beta' | 'ufficiale'      modalita: 'normale' | 'veloce'
//   nome: il soprannome della persona in quella partita; chi chiama lo passa solo se la spunta "conNome" e' accesa.
//         Si scrive solo se dopo la pulizia resta qualcosa.
// Restituisce { ok: true, recensione } oppure { ok: false, errore: 'stelle' | 'ora' }.
export function costruisciRecensione({ stelle, commento, nome, adesso, versione, modalita, giocatori, junior, partite }) {
  if (!stelleValide(stelle)) return { ok: false, errore: 'stelle' };
  if (!Number.isFinite(adesso)) return { ok: false, errore: 'ora' };

  const recensione = { stelle, creataIl: Math.round(adesso) };
  const testo = pulisciCommento(commento);
  if (testo) recensione.commento = testo;
  const soprannome = pulisciNome(nome);
  if (soprannome) recensione.nome = soprannome;
  recensione.versione = versione === 'beta' ? 'beta' : 'ufficiale';
  recensione.modalita = modalita === 'veloce' ? 'veloce' : 'normale';
  if (Number.isInteger(giocatori) && giocatori >= 1 && giocatori <= 99) recensione.giocatori = giocatori;
  if (junior === true) recensione.junior = true;
  if (Number.isInteger(partite) && partite >= 0 && partite <= 100000) recensione.partite = partite;
  return { ok: true, recensione };
}

// ---------- quando l'invio non riesce ----------

// 'permessi' = Firebase ha risposto "non puoi scrivere qui" (di solito: le regole non sono ancora state aggiornate);
// 'rete' = problema di collegamento; 'altro' = tutto il resto.
export function tipoErroreInvio(errore) {
  const pezzi = typeof errore === 'string' ? [errore] : [errore && errore.code, errore && errore.message];
  const testo = pezzi.filter(Boolean).join(' ').toLowerCase();
  if (/permission[_ -]?denied/.test(testo)) return 'permessi';
  if (/offline|network|timeout|disconnect|unavailable/.test(testo)) return 'rete';
  return 'altro';
}
