// test-link-approfondimento.mjs
// Prova il controllo del link del pulsante "Approfondisci"
// (js/link-approfondimento.js): quali link accetta, quali rifiuta e che
// nessun trucco riesca a farne passare uno che non porta a JW.org.
// Si esegue con:
//   node test-link-approfondimento.mjs
// Termina con errore (codice 1) se anche una sola verifica non passa.

import { controllaLink, linkDaUsare, LUNGHEZZA_MASSIMA_LINK } from './js/link-approfondimento.js';

let fallite = 0;
function verifica(descrizione, vero) {
  console.log(`  ${vero ? '✅' : '❌'} ${descrizione}`);
  if (!vero) fallite++;
}

const SITI_AMMESSI = ['www.jw.org', 'jw.org', 'wol.jw.org'];

// --- Link che devono passare ---

console.log('\n--- Link buoni ---');
const buoni = [
  ['il link di esempio, preso da "Condividi"', 'https://www.jw.org/finder?wtlocale=I&docid=1995081&srctype=wol&srcid=share&par=12'],
  ['una pagina della Biblioteca online', 'https://wol.jw.org/it/wol/d/r6/lp-i/1995081'],
  ['un link finder con altri parametri', 'https://www.jw.org/finder?wtlocale=I&bible=19083018'],
  ['jw.org senza www', 'https://jw.org/it/condizioni-uso/'],
  ['solo il nome del sito', 'https://www.jw.org'],
  ['il sito con la barra finale', 'https://www.jw.org/'],
  ['con il cancelletto finale', 'https://wol.jw.org/it/wol/d/r6/lp-i/1995081#h=12'],
  ['solo parametri, senza percorso', 'https://www.jw.org?wtlocale=I'],
  ['maiuscole nel protocollo e nel sito', 'HTTPS://WWW.JW.ORG/it/'],
  ['lettere accentate scritte come nei link veri (%C3%A9)', 'https://www.jw.org/it/biblioteca-digitale/?q=perch%C3%A9'],
  ['lungo esattamente quanto il massimo', 'https://www.jw.org/it/' + 'a'.repeat(LUNGHEZZA_MASSIMA_LINK - 'https://www.jw.org/it/'.length)]
];
for (const [descrizione, link] of buoni) {
  const esito = controllaLink(link);
  verifica(`${descrizione}: accettato e restituito uguale`, esito.valido === true && esito.link === link);
  verifica(`${descrizione}: linkDaUsare lo restituisce`, linkDaUsare(link) === link);
}

console.log('\n--- Spazi e a capo ai bordi (tipici del copia-incolla) ---');
{
  const esito = controllaLink('  \n https://wol.jw.org/it/wol/d/r6/lp-i/1995081 \t\n');
  verifica('gli spazi ai bordi vengono tolti', esito.valido && esito.link === 'https://wol.jw.org/it/wol/d/r6/lp-i/1995081');
}

// --- Campo vuoto: valido, ma senza link ---

console.log('\n--- Campo vuoto: va bene, ma il pulsante non comparira\' ---');
for (const [descrizione, valore] of [['null', null], ['undefined', undefined], ['stringa vuota', ''], ['solo spazi', '   '], ['solo a capo', '\n\n'], ['solo spazi non separabili', '\u00a0\u00a0']]) {
  const esito = controllaLink(valore);
  verifica(`${descrizione}: valido e senza link`, esito.valido === true && esito.link === '');
  verifica(`${descrizione}: linkDaUsare restituisce null`, linkDaUsare(valore) === null);
}

// --- Link che devono essere rifiutati ---

console.log('\n--- Link da rifiutare ---');
const daRifiutare = [
  ['http invece di https', 'http://www.jw.org/it/'],
  ['senza protocollo', 'www.jw.org/it/'],
  ['solo con //', '//www.jw.org/it/'],
  ['javascript:', 'javascript:alert(1)'],
  ['javascript: travestito', 'JaVaScRiPt:alert(1)//https://www.jw.org'],
  ['data:', 'data:text/html,<script>alert(1)</script>'],
  ['file:', 'file:///C:/Windows/win.ini'],
  ['un altro sito', 'https://www.example.com/'],
  ['jw.org dentro il nome di un altro sito', 'https://www.jw.org.example.com/'],
  ['jw.org nel percorso di un altro sito', 'https://example.com/www.jw.org'],
  ['jw.org nei parametri di un altro sito', 'https://example.com/?vai=https://www.jw.org/'],
  ['nome simile con il trattino', 'https://www.jw-org.com/'],
  ['nome che finisce uguale', 'https://notjw.org/'],
  ['un altro sottodominio di jw.org', 'https://tv.jw.org/'],
  ['un sottodominio di wol.jw.org', 'https://x.wol.jw.org/'],
  ['nome utente nel link (il sito vero e\' dopo la chiocciola)', 'https://www.jw.org@example.com/'],
  ['nome utente e password', 'https://utente:password@www.jw.org/'],
  ['nome utente che sembra il sito', 'https://wol.jw.org:pw@example.com/'],
  ['porta particolare', 'https://www.jw.org:8080/'],
  ['porta standard scritta per esteso', 'https://www.jw.org:443/'],
  ['barra rovesciata prima della chiocciola', 'https://www.jw.org\\@example.com/'],
  ['barra rovesciata nel percorso', 'https://www.jw.org\\it'],
  ['barra rovesciata dopo una barra', 'https://www.jw.org/it/\\x'],
  ['barra rovesciata nei parametri', 'https://www.jw.org/?q=\\x'],
  ['lettere accentate scritte per esteso (vanno copiate dal pulsante Condividi)', 'https://www.jw.org/it/biblioteca-digitale/?q=perché'],
  ['virgolette nel percorso', 'https://www.jw.org/it/"x'],
  ['apice nel percorso', "https://www.jw.org/it/'x"],
  ['parentesi angolare aperta nel percorso', 'https://www.jw.org/it/<x'],
  ['parentesi angolare chiusa nei parametri', 'https://www.jw.org/?q=>'],
  ['apice inverso nel percorso', 'https://www.jw.org/it/`x'],
  ['virgolette nel cancelletto finale', 'https://www.jw.org/it/#"x'],
  ['tentativo di uscire da un attributo HTML', 'https://www.jw.org/"><svg/onload=alert(1)>'],
  ['tentativo di aggiungere un attributo HTML', 'https://www.jw.org/"onfocus=alert(1)'],
  ['punto finale nel nome del sito', 'https://www.jw.org./'],
  ['spazio dentro il link', 'https://www.jw.org/it/ ciao'],
  ['a capo dentro il link', 'https://www.jw.org/it/\nhttps://example.com'],
  ['tabulazione dentro il link', 'https://www.jw.org/it/\tciao'],
  ['spazio non separabile dentro il link', 'https://www.jw.org/it/\u00a0x'],
  ['carattere invisibile dentro il link', 'https://www.jw.org/it/\u200bx'],
  ['carattere di controllo dentro il link', 'https://www.jw.org/it/\u0001x'],
  ['lettera cirillica al posto della o di "org"', 'https://www.jw.\u043erg/'],
  ['lettere a larghezza intera nel nome del sito', 'https://\uff57\uff57\uff57.jw.org/'],
  ['due link incollati uno dopo l\'altro', 'https://www.jw.org/ https://www.jw.org/'],
  ['solo il nome del sito, senza https://', 'www.jw.org'],
  ['una frase qualsiasi', 'vedi la Torre di Guardia'],
  ['https:// e basta', 'https://'],
  ['un solo carattere di troppo oltre il massimo', 'https://www.jw.org/it/' + 'a'.repeat(LUNGHEZZA_MASSIMA_LINK - 'https://www.jw.org/it/'.length + 1)]
];
// Caratteri invisibili o che cambiano il link senza vedersi (li portano certe
// app di messaggi e certi siti nel copia-incolla): tutti da rifiutare.
const invisibili = [0x00ad, 0x034f, 0x061c, 0x115f, 0x17b4, 0x180e, 0x200b, 0x200e, 0x2028, 0x2060, 0x2061, 0x2064, 0x2066, 0x2069, 0x206a, 0x206f,
  0x3164, 0xfe0f, 0xfeff, 0xffa0, 0xfff9, 0xfffc];
for (const codice of invisibili) {
  const nome = 'U+' + codice.toString(16).padStart(4, '0');
  daRifiutare.push([`carattere invisibile ${nome} nel percorso`, 'https://www.jw.org/it/' + String.fromCharCode(codice) + 'x']);
  daRifiutare.push([`carattere invisibile ${nome} nei parametri`, 'https://www.jw.org/?q=a' + String.fromCharCode(codice) + 'b']);
}
daRifiutare.push(['carattere "tag" invisibile (U+e0001, coppia di surrogati)', 'https://www.jw.org/it/' + String.fromCodePoint(0xe0001) + 'x']);
daRifiutare.push(['una emoji', 'https://www.jw.org/it/' + String.fromCodePoint(0x1f44d)]);
daRifiutare.push(['un surrogato isolato', 'https://www.jw.org/it/' + String.fromCharCode(0xd800)]);
daRifiutare.push(['carattere invisibile all\'inizio del link', String.fromCharCode(0x200b) + 'https://www.jw.org/it/']);
daRifiutare.push(['carattere invisibile alla fine del link', 'https://www.jw.org/it/' + String.fromCharCode(0x200b)]);

for (const [descrizione, link] of daRifiutare) {
  const esito = controllaLink(link);
  verifica(`${descrizione}: rifiutato, con una spiegazione`,
    esito.valido === false && esito.link === '' && typeof esito.motivo === 'string' && esito.motivo.length > 0);
  verifica(`${descrizione}: linkDaUsare restituisce null`, linkDaUsare(link) === null);
}

console.log('\n--- Valori che non sono testo ---');
for (const [descrizione, valore] of [['un numero', 5], ['vero', true], ['un oggetto', { link: 'https://www.jw.org/' }], ['un elenco di link', ['https://www.jw.org/']], ['una funzione', () => 'https://www.jw.org/']]) {
  const esito = controllaLink(valore);
  verifica(`${descrizione}: rifiutato senza errori`, esito.valido === false && typeof esito.motivo === 'string');
  verifica(`${descrizione}: linkDaUsare restituisce null`, linkDaUsare(valore) === null);
}

// --- Prova a tappeto: link storpiati a caso, nessuno deve uscire da JW.org ---

console.log('\n--- Prova a tappeto (30.000 link storpiati a caso) ---');
function creaCasuale(seme) {
  let a = seme;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const casuale = creaCasuale(20261006);
const caratteriStrani = ['@', ':', '/', '\\', '?', '#', '%', '.', '-', ' ', '\t', '\n', '\u00a0', '\u200b', '\ufeff', '\uff0e', '\u3002', '\u0001', '\u0085', '\u00ad', '\u2066', '\u3164', '\ufe0f', '\ud83d\udc4d', '\udb40\udc01', 'x', 'é', '\u043e', '%40', '%2e', '..', '//', 'https://', 'jw.org', '[', ']', '<', '>', '"', "'", '|', '^', '`', '{', '}'];
const basi = [...buoni.map(b => b[1]), ...daRifiutare.map(b => b[1])];
const scegli = (elenco) => elenco[Math.floor(casuale() * elenco.length)];

let validi = 0, rifiutati = 0, problemi = [];
for (let n = 0; n < 30000; n++) {
  let testo = scegli(basi);
  const modifiche = 1 + Math.floor(casuale() * 3);
  for (let m = 0; m < modifiche; m++) {
    const posto = Math.floor(casuale() * (testo.length + 1));
    const quale = Math.floor(casuale() * 4);
    if (quale === 0) testo = testo.slice(0, posto) + scegli(caratteriStrani) + testo.slice(posto);
    else if (quale === 1) testo = testo.slice(0, posto) + testo.slice(posto + 1);
    else if (quale === 2) testo = testo.slice(0, posto) + scegli(caratteriStrani) + testo.slice(posto + 1);
    else testo = casuale() < 0.5 ? testo.toUpperCase() : testo.slice(0, posto) + testo.slice(Math.floor(casuale() * (testo.length + 1)));
  }

  let esito;
  try {
    esito = controllaLink(testo);
  } catch (errore) {
    problemi.push(`errore con ${JSON.stringify(testo)}: ${errore.message}`);
    continue;
  }
  if (esito.valido && esito.link !== '') {
    validi++;
    let url = null;
    try { url = new URL(esito.link); } catch (e) { /* resta null */ }
    const ok = url !== null
      && esito.link === testo.trim()
      && url.protocol === 'https:'
      && SITI_AMMESSI.includes(url.hostname)
      && url.username === '' && url.password === '' && url.port === ''
      && !/\s/.test(esito.link)
      && /^[\x21-\x7e]+$/.test(esito.link)         // solo caratteri visibili della tastiera inglese
      && !/["'<>`\\]/.test(esito.link)             // niente virgolette, apici, parentesi angolari, barre rovesciate
      && controllaLink(esito.link).link === esito.link   // ricontrollato, resta uguale
      && linkDaUsare(testo) === esito.link;
    if (!ok) problemi.push(`passato ma non va bene: ${JSON.stringify(testo)}`);
  } else if (esito.valido) {
    if (testo.trim() !== '' || linkDaUsare(testo) !== null) problemi.push(`vuoto per sbaglio: ${JSON.stringify(testo)}`);
  } else {
    rifiutati++;
    if (esito.link !== '' || !esito.motivo || linkDaUsare(testo) !== null) problemi.push(`rifiutato in modo strano: ${JSON.stringify(testo)}`);
  }
}
verifica(`nessun errore e nessun link uscito da JW.org (${validi} accettati, ${rifiutati} rifiutati)`, problemi.length === 0);
verifica('la prova a tappeto non e\' vuota: ci sono sia link accettati sia rifiutati', validi > 500 && rifiutati > 500);
if (problemi.length > 0) console.log('     ' + problemi.slice(0, 8).join('\n     '));

console.log('');
if (fallite > 0) {
  console.log(`❌ ${fallite} verifiche non passate`);
  process.exitCode = 1;
} else {
  console.log('✅ Tutte le verifiche passate');
}
