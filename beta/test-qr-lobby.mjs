// test-qr-lobby.mjs
// Prove del QR della lobby e del link per entrare in una partita:
//   js/link-partita.js  (costruire il link del QR e leggere il codice dal link)
//   js/qr-lobby.js      (il disegno del QR, e come finisce nella pagina)
// Si lancia con:  node test-qr-lobby.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { indirizzoPerEntrare, codiceDalLink, FORMATO_CODICE_PARTITA } from './js/link-partita.js';
import { disegnoQr, creaSvgQr, mostraQrLobby } from './js/qr-lobby.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.message).split('\n').join('\n        ')}`); }
}

const LETTERE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

// ================= il link per entrare =================

prova('indirizzoPerEntrare: nella beta il link resta nella cartella beta', () => {
  assert.equal(indirizzoPerEntrare('ABCD', 'https://fragnell.github.io/corsa-cristiana/beta/tabellone.html'),
    'https://fragnell.github.io/corsa-cristiana/beta/giocatore.html?codice=ABCD');
});

prova('indirizzoPerEntrare: nel gioco vero il link e\' quello del gioco vero', () => {
  assert.equal(indirizzoPerEntrare('QRST', 'https://fragnell.github.io/corsa-cristiana/tabellone.html'),
    'https://fragnell.github.io/corsa-cristiana/giocatore.html?codice=QRST');
});

prova('indirizzoPerEntrare: con un dominio nuovo non serve cambiare niente', () => {
  assert.equal(indirizzoPerEntrare('WXYZ', 'https://www.corsacristiana.it/tabellone.html'),
    'https://www.corsacristiana.it/giocatore.html?codice=WXYZ');
});

prova('indirizzoPerEntrare: ricerca e "#" della pagina del tabellone non finiscono nel link', () => {
  assert.equal(indirizzoPerEntrare('ABCD', 'https://x.example/beta/tabellone.html?prova=1&altro=2#in-fondo'),
    'https://x.example/beta/giocatore.html?codice=ABCD');
});

prova('indirizzoPerEntrare: funziona anche se la pagina e\' aperta senza ".html" o in una cartella', () => {
  assert.equal(indirizzoPerEntrare('ABCD', 'https://x.example/beta/tabellone'), 'https://x.example/beta/giocatore.html?codice=ABCD');
  assert.equal(indirizzoPerEntrare('ABCD', 'https://x.example/beta/tabellone.html/'), 'https://x.example/beta/tabellone.html/giocatore.html?codice=ABCD');
});

prova('indirizzoPerEntrare: in prova sul computer (indirizzo locale)', () => {
  assert.equal(indirizzoPerEntrare('ABCD', 'http://127.0.0.1:8080/tabellone.html'), 'http://127.0.0.1:8080/giocatore.html?codice=ABCD');
});

prova('indirizzoPerEntrare: un codice che non e\' un codice partita viene rifiutato', () => {
  for (const cattivo of ['abcd', 'ABC', 'ABCDE', '', 'AB1D', 'ABCO', 'ABCI', 'AB D', 'ABCD&x=1', 'ABCD\n', undefined, null, 1234, ['ABCD']]) {
    assert.throws(() => indirizzoPerEntrare(cattivo, 'https://x.example/tabellone.html'), /non valido/, `doveva rifiutare ${JSON.stringify(cattivo)}`);
  }
});

// ================= il codice letto dal link =================

prova('codiceDalLink: legge un codice buono', () => {
  assert.equal(codiceDalLink('?codice=ABCD'), 'ABCD');
  assert.equal(codiceDalLink('codice=ABCD'), 'ABCD');
  assert.equal(codiceDalLink('?x=1&codice=ABCD&y=2'), 'ABCD');
});

prova('codiceDalLink: minuscole e spazi non danno problemi', () => {
  assert.equal(codiceDalLink('?codice=abcd'), 'ABCD');
  assert.equal(codiceDalLink('?codice=%20abCd%20'), 'ABCD');
  assert.equal(codiceDalLink('?codice=+abcd+'), 'ABCD');
});

prova('codiceDalLink: tutto quello che non e\' un codice vero diventa null', () => {
  const cattivi = ['', '?', '?codice=', '?codice', '?codice=ABC', '?codice=ABCDE', '?codice=ABCO', '?codice=ABCI', '?codice=AB1D', '?codice=AB-D',
    '?altro=ABCD', '?Codice=ABCD', '?codice=ABCD%00', '?codice=' + encodeURIComponent('<img src=x onerror=alert(1)>'),
    '?codice=' + encodeURIComponent('"><script>alert(1)</script>'), '?codice=%E0%A4%A', '?codice=ＡＢＣＤ', '?codice=ÀBCD'];
  for (const c of cattivi) assert.equal(codiceDalLink(c), null, `doveva rifiutare ${JSON.stringify(c)}`);
});

prova('codiceDalLink: con piu\' codici nel link vale il primo', () => {
  assert.equal(codiceDalLink('?codice=ABCD&codice=WXYZ'), 'ABCD');
  assert.equal(codiceDalLink('?codice=ABC&codice=WXYZ'), null);
});

prova('il link costruito dal tabellone si legge sul telefono, per tutti i 331.776 codici possibili', () => {
  const pagina = 'https://x.example/beta/tabellone.html';
  let n = 0;
  for (const a of LETTERE) for (const b of LETTERE) {
    // tutti i codici con queste prime due lettere (24 x 24 = 576 per ogni coppia)
    for (const c of LETTERE) for (const d of LETTERE) {
      const codice = a + b + c + d;
      const ricerca = new URL(indirizzoPerEntrare(codice, pagina)).search;
      if (codiceDalLink(ricerca) !== codice) assert.fail('il codice ' + codice + ' non fa il giro completo');
      n++;
    }
  }
  assert.equal(n, 24 ** 4);
});

prova('il formato del codice coincide con le lettere che usa generaCodicePartita (e con le regole di Firebase)', () => {
  const sorgente = fs.readFileSync(new URL('./js/sincronizzazione.js', import.meta.url), 'utf8');
  const m = sorgente.match(/function generaCodicePartita\(\)\s*\{\s*const lettere = '([A-Z]+)';/);
  assert.ok(m, 'non trovo l\'elenco delle lettere in generaCodicePartita (sincronizzazione.js)');
  assert.equal(m[1], LETTERE, 'le lettere di generaCodicePartita sono cambiate: aggiornare FORMATO_CODICE_PARTITA e le regole di Firebase (partite/$codice)');
  for (const l of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    assert.equal(FORMATO_CODICE_PARTITA.test(l.repeat(4)), LETTERE.includes(l), `la lettera ${l}`);
  }
  assert.equal(sorgente.match(/Math\.floor\(Math\.random\(\) \* lettere\.length\)/g).length, 1);
});

// ================= il disegno del QR =================

// Rifa' la griglia dei quadratini a partire dal tracciato SVG (cosi' si controlla quello che si vede davvero)
function griglia(disegno) {
  const lato = disegno.dimensione;
  const g = Array.from({ length: lato }, () => Array(lato).fill(false));
  const tratti = disegno.tracciato.match(/M\d+ \d+h\d+v1h-\d+z/g) || [];
  assert.equal(tratti.join(''), disegno.tracciato, 'il tracciato contiene qualcosa di diverso dai tratti attesi');
  for (const t of tratti) {
    const [, x, y, w, w2] = t.match(/^M(\d+) (\d+)h(\d+)v1h-(\d+)z$/).map(Number);
    assert.equal(w, w2);
    for (let i = 0; i < w; i++) g[y][x + i] = true;
  }
  return g;
}

const LINK_DI_PROVA = 'https://fragnell.github.io/corsa-cristiana/beta/giocatore.html?codice=ABCD';

prova('disegnoQr: dimensioni giuste (4 x versione + 17 quadratini, piu\' il bordo bianco di 4 per lato)', () => {
  const d = disegnoQr(LINK_DI_PROVA);
  const lato = d.dimensione - 8;
  assert.ok((lato - 17) % 4 === 0 && lato >= 21 && lato <= 177, `lato strano: ${lato}`);
  assert.ok(lato <= 45, `per un link di ${LINK_DI_PROVA.length} caratteri il QR e' troppo fitto (${lato} quadratini)`);
});

prova('disegnoQr: il bordo bianco e\' vuoto e i tre riquadri di riconoscimento stanno agli angoli', () => {
  const d = disegnoQr(LINK_DI_PROVA);
  const g = griglia(d);
  const n = d.dimensione;
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) {
    assert.equal(g[k][i] || g[n - 1 - k][i] || g[i][k] || g[i][n - 1 - k], false, 'c\'e\' qualcosa nel bordo bianco');
  }
  // riquadro di riconoscimento: anello scuro 7x7, anello chiaro, centro scuro 3x3
  const riquadro = (r0, c0) => {
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const bordo = r === 0 || r === 6 || c === 0 || c === 6;
      const centro = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      assert.equal(g[r0 + r][c0 + c], bordo || centro, `riquadro in ${r0},${c0}: errore in ${r},${c}`);
    }
  };
  riquadro(4, 4);
  riquadro(4, n - 4 - 7);
  riquadro(n - 4 - 7, 4);
});

prova('disegnoQr: ne\' tutto scuro ne\' tutto chiaro (una buona miscela di quadratini)', () => {
  const d = disegnoQr(LINK_DI_PROVA);
  const g = griglia(d);
  const lato = d.dimensione - 8;
  let scuri = 0;
  for (const riga of g) for (const q of riga) if (q) scuri++;
  const quota = scuri / (lato * lato);
  assert.ok(quota > 0.35 && quota < 0.65, `quota di quadratini scuri: ${quota.toFixed(2)}`);
});

prova('disegnoQr: lo stesso testo da sempre lo stesso disegno; testi diversi disegni diversi', () => {
  assert.equal(disegnoQr(LINK_DI_PROVA).tracciato, disegnoQr(LINK_DI_PROVA).tracciato);
  assert.notEqual(disegnoQr(LINK_DI_PROVA).tracciato, disegnoQr(LINK_DI_PROVA.replace('ABCD', 'ABCE')).tracciato);
});

prova('disegnoQr: i link della beta, del gioco vero e di un dominio corto stanno in un QR leggibile (al massimo 37 quadratini)', () => {
  for (const pagina of ['https://fragnell.github.io/corsa-cristiana/beta/tabellone.html', 'https://fragnell.github.io/corsa-cristiana/tabellone.html', 'https://www.corsacristiana.it/tabellone.html']) {
    const d = disegnoQr(indirizzoPerEntrare('WXYZ', pagina));
    assert.ok(d.dimensione - 8 <= 37, `${pagina}: ${d.dimensione - 8} quadratini`);
  }
});

prova('disegnoQr: un testo troppo lungo non lascia un disegno a meta\': da\' un errore', () => {
  assert.throws(() => disegnoQr('x'.repeat(5000)));
});

// ================= il QR nella pagina (con una pagina finta) =================

function paginaFinta({ conRiquadro = true } = {}) {
  const elemento = (nome) => {
    const attributi = {};
    const figli = [];
    const classi = new Set(['nascosta']);
    return {
      nome, attributi, figli, dataset: {},
      classList: { add: c => classi.add(c), remove: c => classi.delete(c), contains: c => classi.has(c) },
      setAttribute: (k, v) => { attributi[k] = String(v); },
      append: (...x) => { figli.push(...x); },
      replaceChildren: (...x) => { figli.length = 0; figli.push(...x); }
    };
  };
  const riquadro = elemento('riquadro');
  const immagine = elemento('immagine');
  return {
    riquadro, immagine,
    createElementNS: (ns, nome) => Object.assign(elemento(nome), { ns }),
    getElementById: id => (conRiquadro ? { 'lobby-qr': riquadro, 'lobby-qr-immagine': immagine }[id] || null : null)
  };
}

prova('mostraQrLobby: disegna il QR, ricorda il link e mostra il riquadro', () => {
  const doc = paginaFinta();
  assert.ok(doc.riquadro.classList.contains('nascosta'), 'all\'inizio il riquadro e\' nascosto');
  const fatto = mostraQrLobby('ABCD', { pagina: 'https://x.example/beta/tabellone.html', documento: doc });
  assert.equal(fatto, true);
  assert.equal(doc.riquadro.classList.contains('nascosta'), false);
  assert.equal(doc.riquadro.dataset.indirizzo, 'https://x.example/beta/giocatore.html?codice=ABCD');
  assert.equal(doc.immagine.figli.length, 1);
  const svg = doc.immagine.figli[0];
  assert.equal(svg.nome, 'svg');
  assert.equal(svg.ns, 'http://www.w3.org/2000/svg');
  assert.match(svg.attributi.viewBox, /^0 0 (\d+) \1$/);
  assert.equal(svg.attributi['aria-label'], 'QR per entrare nella partita ABCD');
  assert.equal(svg.attributi.role, 'img');
  assert.deepEqual(svg.figli.map(f => f.nome), ['rect', 'path']);
  assert.equal(svg.figli[0].attributi.fill, '#ffffff');
  assert.equal(svg.figli[1].attributi.fill, '#000000');
});

prova('mostraQrLobby: chiamata una seconda volta sostituisce il disegno (non ne aggiunge un altro)', () => {
  const doc = paginaFinta();
  mostraQrLobby('ABCD', { pagina: 'https://x.example/tabellone.html', documento: doc });
  mostraQrLobby('WXYZ', { pagina: 'https://x.example/tabellone.html', documento: doc });
  assert.equal(doc.immagine.figli.length, 1);
  assert.equal(doc.riquadro.dataset.indirizzo, 'https://x.example/giocatore.html?codice=WXYZ');
});

prova('mostraQrLobby: se nella pagina non c\'e\' il riquadro non fa niente e non si rompe', () => {
  assert.equal(mostraQrLobby('ABCD', { pagina: 'https://x.example/tabellone.html', documento: paginaFinta({ conRiquadro: false }) }), false);
});

prova('mostraQrLobby: con un codice sbagliato da\' errore e non mostra niente', () => {
  const doc = paginaFinta();
  assert.throws(() => mostraQrLobby('abc', { pagina: 'https://x.example/tabellone.html', documento: doc }), /non valido/);
  assert.ok(doc.riquadro.classList.contains('nascosta'));
  assert.equal(doc.immagine.figli.length, 0);
});

prova('creaSvgQr: nel disegno entrano solo numeri (niente testo preso da fuori)', () => {
  const doc = paginaFinta();
  const svg = creaSvgQr(LINK_DI_PROVA, 'descrizione', doc);
  const tracciato = svg.figli[1].attributi.d;
  assert.match(tracciato, /^(M\d+ \d+h\d+v1h-\d+z)+$/);
});

// ================= esito =================

console.log(`\nQR della lobby: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
