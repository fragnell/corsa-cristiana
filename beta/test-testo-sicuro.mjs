// test-testo-sicuro.mjs
// Prove delle tre funzioni che rendono innocui i testi scritti dai giocatori:
//   js/testo-sicuro.js  (testoSicuro, numeroSicuro, coloreSicuro)
// e un controllo "di guardia" sul codice: in nessun file del sito un nome, una risposta o un colore
// puo' finire dentro un pezzo di HTML (innerHTML) senza passare da queste funzioni.
// Si lancia con:  node test-testo-sicuro.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { testoSicuro, numeroSicuro, coloreSicuro, risposteSicure, MASSIMO_RISPOSTE, MASSIMO_CARATTERI_RISPOSTA } from './js/testo-sicuro.js';
import { PALETTE } from './js/colori.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.message).split('\n').join('\n        ')}`); }
}

const QUI = path.dirname(fileURLToPath(import.meta.url));

// Nomi e risposte "cattivi" che qualcuno potrebbe scrivere. Servono a verificare che, dopo testoSicuro,
// non resti nessuno dei simboli con cui si apre un tag o si esce da un attributo.
const TESTI_CATTIVI = [
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '"><svg onload=alert(1)>',
  "' onmouseover='alert(1)",
  '</div><div onclick="x()">',
  '<a href="javascript:alert(1)">clic</a>',
  '<iframe src="https://example.com"></iframe>',
  '&lt;b&gt; gia\' scritto con le &amp; entita\'',
  '<<img src=x onerror=a()>',
  'a"b\'c<d>e&f'
];

// ================= testoSicuro =================

prova('testoSicuro: un testo normale resta com\'e\'', () => {
  assert.equal(testoSicuro('Anna Maria'), 'Anna Maria');
  assert.equal(testoSicuro('Mosè e Aronne'), 'Mosè e Aronne');
  assert.equal(testoSicuro('😀 Ugo'), '😀 Ugo');
  assert.equal(testoSicuro(''), '');
});

prova('testoSicuro: i cinque simboli speciali diventano lettere da mostrare', () => {
  assert.equal(testoSicuro('<'), '&lt;');
  assert.equal(testoSicuro('>'), '&gt;');
  assert.equal(testoSicuro('&'), '&amp;');
  assert.equal(testoSicuro('"'), '&quot;');
  assert.equal(testoSicuro("'"), '&#39;');
});

prova('testoSicuro: il caso classico del nome con un tag dentro', () => {
  assert.equal(testoSicuro('<i>Ugo</i>'), '&lt;i&gt;Ugo&lt;/i&gt;');
});

prova('testoSicuro: nei testi cattivi non resta nessun simbolo pericoloso', () => {
  for (const testo of TESTI_CATTIVI) {
    const sicuro = testoSicuro(testo);
    assert.ok(!/[<>"']/.test(sicuro), `restano simboli pericolosi in: ${sicuro}`);
    // e le "&" che restano aprono solo le sostituzioni scritte da noi
    const lettere = sicuro.replace(/&(amp|lt|gt|quot|#39);/g, '');
    assert.ok(!lettere.includes('&'), `una & non protetta in: ${sicuro}`);
  }
});

prova('testoSicuro: a ogni passaggio il testo si puo\' rileggere uguale (si torna al testo di partenza)', () => {
  const torna = t => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  for (const testo of TESTI_CATTIVI) assert.equal(torna(testoSicuro(testo)), testo);
});

prova('testoSicuro: "niente" diventa un testo vuoto', () => {
  assert.equal(testoSicuro(null), '');
  assert.equal(testoSicuro(undefined), '');
});

prova('testoSicuro: i numeri e i valori strani non fanno danni', () => {
  assert.equal(testoSicuro(42), '42');
  assert.equal(testoSicuro(0), '0');
  assert.equal(testoSicuro(false), 'false');
  assert.equal(testoSicuro(['<b>', 'x']), '&lt;b&gt;,x');
  assert.equal(testoSicuro({}), '[object Object]');
});

prova('testoSicuro: non lancia errori nemmeno con un oggetto che non si lascia trasformare in testo', () => {
  const ostile = { toString() { throw new Error('no'); } };
  assert.equal(testoSicuro(ostile), '');
  const senzaPrototipo = Object.create(null);
  assert.equal(testoSicuro(senzaPrototipo), '');
});

// ================= numeroSicuro =================

prova('numeroSicuro: i numeri veri restano uguali', () => {
  assert.equal(numeroSicuro(0), 0);
  assert.equal(numeroSicuro(7), 7);
  assert.equal(numeroSicuro(-3), -3);
  assert.equal(numeroSicuro(2.5), 2.5);
  assert.equal(numeroSicuro('12'), 12);
});

prova('numeroSicuro: tutto il resto diventa 0', () => {
  for (const v of ['<img src=x onerror=alert(1)>', 'abc', NaN, Infinity, -Infinity, undefined, {}, [1, 2], 'x1']) {
    assert.equal(numeroSicuro(v), 0, `con ${String(v)}`);
  }
  assert.equal(numeroSicuro(null), 0);
  assert.equal(numeroSicuro(''), 0);
});

// ================= coloreSicuro =================

prova('coloreSicuro: i colori della tavolozza danno il loro codice', () => {
  for (const [nome, codice] of Object.entries(PALETTE)) assert.equal(coloreSicuro(nome), codice);
});

prova('coloreSicuro: un codice esadecimale e\' accettato', () => {
  assert.equal(coloreSicuro('#e74c3c'), '#e74c3c');
  assert.equal(coloreSicuro('#FFF'), '#FFF');
});

prova('coloreSicuro: qualunque altra cosa diventa il grigio neutro', () => {
  const GRIGIO = '#999999';
  const cattivi = [
    'red;" onmouseover="alert(1)" x="',
    'red"><img src=x onerror=alert(1)>',
    'url(https://example.com/spia.png)',
    'rgb(1,2,3)', '#12', '#12345', '#1234567', '#gggggg', 'rosso ', 'ROSSO', '',
    'constructor', '__proto__', 'toString', 'hasOwnProperty',
    null, undefined, 0, 7, {}, ['rosso'], true
  ];
  for (const c of cattivi) assert.equal(coloreSicuro(c), GRIGIO, `con ${JSON.stringify(c)}`);
});

// ================= risposteSicure =================

prova('risposteSicure: un elenco normale di risposte resta uguale', () => {
  assert.deepEqual(risposteSicure(['Mosè']), ['Mosè']);
  assert.deepEqual(risposteSicure(['Genesi', 'Esodo', "L'arca di Noè"]), ['Genesi', 'Esodo', "L'arca di Noè"]);
  assert.deepEqual(risposteSicure([]), []);
});

prova('risposteSicure: le risposte "cattive" restano testo (a renderle innocue ci pensa testoSicuro quando si mostrano)', () => {
  assert.deepEqual(risposteSicure(TESTI_CATTIVI), TESTI_CATTIVI);
});

prova('risposteSicure: un solo testo diventa un elenco di uno', () => {
  assert.deepEqual(risposteSicure('Davide'), ['Davide']);
});

prova('risposteSicure: tutto quello che non e\' un elenco di testi diventa "nessuna risposta"', () => {
  for (const v of [null, undefined, 5, true, {}, { 0: 'a' }, () => 1]) assert.deepEqual(risposteSicure(v), [], `con ${String(v)}`);
});

prova('risposteSicure: dentro l\'elenco restano solo testi e numeri veri', () => {
  assert.deepEqual(risposteSicure(['a', { x: 1 }, null, 3, NaN, undefined, ['b'], 'c']), ['a', '3', 'c']);
});

prova('risposteSicure: non ne passano troppe e non passano lunghissime', () => {
  const tante = Array.from({ length: MASSIMO_RISPOSTE + 50 }, (_, i) => 'r' + i);
  assert.equal(risposteSicure(tante).length, MASSIMO_RISPOSTE);
  const lunga = 'x'.repeat(MASSIMO_CARATTERI_RISPOSTA + 700);
  assert.equal(risposteSicure([lunga])[0].length, MASSIMO_CARATTERI_RISPOSTA);
});

// ================= guardia sul codice =================
// Per ogni file del sito: ogni ${...} dentro un innerHTML che nomina un dato dei giocatori deve passare da una
// funzione sicura. Non e' una prova perfetta (non capisce il codice), ma intercetta la dimenticanza piu' comune:
// aggiungere un nuovo ${g.nome} senza proteggerlo.

const CARTELLE = ['js', 'js/salmo'];
const FILE_ESCLUSI = new Set(['migra-carte.js']);           // pagina di servizio, non usata dal gioco
const NOMI_DA_PROTEGGERE = /\$\{\s*(?:g|giocatore|player|r|risposta|risposte|riga|carta)\.(?:nome|colore|domanda|testo)\s*\}|\$\{\s*(?:nomeGiocatore|rispostaData|rispostaGiusta|nome|colore|r|opzione)\s*\}|\$\{\s*risposteDate\b[^}]*\}/;

function righeConInnerHtml(testo) {
  // un innerHTML che apre un template e lo chiude: lo guardiamo per intero (anche su piu' righe)
  const blocchi = [];
  const regex = /innerHTML\s*=\s*(`[\s\S]*?`|[^;]*?\.map\([\s\S]*?\)\.join\([^)]*\))\s*;/g;
  let m;
  while ((m = regex.exec(testo)) !== null) blocchi.push({ testo: m[0], riga: testo.slice(0, m.index).split('\n').length });
  return blocchi;
}

prova('guardia: nessun innerHTML del sito contiene un nome/colore/risposta "nudo"', () => {
  const problemi = [];
  for (const cartella of CARTELLE) {
    const dir = path.join(QUI, cartella);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js') && !FILE_ESCLUSI.has(x))) {
      const contenuto = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const b of righeConInnerHtml(contenuto)) {
        if (NOMI_DA_PROTEGGERE.test(b.testo)) problemi.push(`${cartella}/${f}, riga ${b.riga}: ${b.testo.split('\n')[0].trim().slice(0, 100)}`);
      }
    }
  }
  assert.deepEqual(problemi, [], 'dati dei giocatori non protetti:\n' + problemi.join('\n'));
});

prova('guardia: lo stile con il colore di un giocatore usa sempre coloreSicuro', () => {
  const problemi = [];
  for (const cartella of CARTELLE) {
    const dir = path.join(QUI, cartella);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js') && !FILE_ESCLUSI.has(x))) {
      const contenuto = fs.readFileSync(path.join(dir, f), 'utf8');
      const regex = /style="[^"]*\$\{[^}]*\}[^"]*"/g;
      let m;
      while ((m = regex.exec(contenuto)) !== null) {
        if (!/coloreSicuro\(/.test(m[0])) problemi.push(`${cartella}/${f}: ${m[0].slice(0, 100)}`);
      }
    }
  }
  assert.deepEqual(problemi, [], 'colori non protetti:\n' + problemi.join('\n'));
});

prova('guardia: la guardia stessa riconosce un caso sbagliato', () => {
  const sbagliato = 'el.innerHTML = `<li>${g.nome}</li>`;';
  const giusto = 'el.innerHTML = `<li>${testoSicuro(g.nome)}</li>`;';
  assert.ok(righeConInnerHtml(sbagliato).some(b => NOMI_DA_PROTEGGERE.test(b.testo)));
  assert.ok(!righeConInnerHtml(giusto).some(b => NOMI_DA_PROTEGGERE.test(b.testo)));
});

// ================= esito =================

console.log(`\nTesti sicuri: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
