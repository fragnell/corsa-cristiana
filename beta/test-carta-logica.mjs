// test-carta-logica.mjs
// Prove della parte "di calcolo" delle carte sul tabellone (js/carta-logica.js). Si lancia con:
//   node test-carta-logica.mjs

import assert from 'node:assert/strict';
import {
  trovaDimensione, rispostaGiustaDaMostrare, testoSpostamento,
  LIVELLI_TESTO, livelloSuccessivo, livelloValido
} from './js/carta-logica.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${e.message}`); }
}

// ---------- il testo che si adatta ----------

prova('testo corto: resta alla dimensione massima', () => {
  const r = trovaDimensione(() => true, { massima: 60, minima: 26 });
  assert.deepEqual(r, { dimensione: 60, entra: true });
});

prova('testo lungo: scende finche\' entra, non oltre', () => {
  // "entra" solo sotto i 40px: deve fermarsi al primo valore <= 40
  const provate = [];
  const r = trovaDimensione(px => { provate.push(px); return px <= 40; }, { massima: 60, minima: 26 });
  assert.equal(r.entra, true);
  assert.ok(r.dimensione <= 40 && r.dimensione > 40 * 0.93 - 0.001, `dimensione ${r.dimensione}`);
  assert.ok(provate.every((v, i) => i === 0 || v < provate[i - 1]), 'deve solo scendere');
});

prova('testo lunghissimo: si ferma alla minima e lo dice', () => {
  const r = trovaDimensione(() => false, { massima: 60, minima: 26 });
  assert.deepEqual(r, { dimensione: 26, entra: false });
});

prova('valori strani: mai un errore', () => {
  assert.equal(trovaDimensione(null, { massima: 50, minima: 20 }).dimensione, 50);
  assert.equal(trovaDimensione(() => true, { massima: 0, minima: 20 }).dimensione, 20);
  const r = trovaDimensione(() => false, { massima: 50, minima: 20, passo: 7 });
  assert.equal(r.dimensione, 20);
});

prova('pochi tentativi anche nel caso peggiore', () => {
  let tentativi = 0;
  trovaDimensione(() => { tentativi++; return false; }, { massima: 64, minima: 26 });
  assert.ok(tentativi < 20, `tentativi: ${tentativi}`);
});

// ---------- la risposta giusta ----------

prova('risposta libera con varianti: solo la principale', () => {
  assert.equal(rispostaGiustaDaMostrare({ tipo: 'diretta', risposta: ['30', 'Trenta', '30 monete'] }), '30');
  assert.equal(rispostaGiustaDaMostrare({ tipo: 'diretta', risposta: 'Uria' }), 'Uria');
  assert.equal(rispostaGiustaDaMostrare({ risposta: ['', 'Mosè'] }), 'Mosè');
});

prova('scelta multipla ed elenco', () => {
  assert.equal(rispostaGiustaDaMostrare({ tipo: 'scelta', opzioni: ['A', 'B'], rispostaCorretta: 'B' }), 'B');
  assert.equal(rispostaGiustaDaMostrare({ tipo: 'elenco', rispostePossibili: ['Giacomo', 'Giovanni', 'Giuda'] }), 'Giacomo, Giovanni, Giuda');
});

prova('carta strana: stringa vuota', () => {
  assert.equal(rispostaGiustaDaMostrare(null), '');
  assert.equal(rispostaGiustaDaMostrare({ tipo: 'elenco' }), '');
  assert.equal(rispostaGiustaDaMostrare({ tipo: 'scelta' }), '');
  assert.equal(rispostaGiustaDaMostrare({}), '');
});

// ---------- l'annuncio dello spostamento ----------

const etichetta = n => (n === 1 ? 'VIA!' : String(n - 1));

prova('avanti, indietro, una casella sola', () => {
  assert.deepEqual(testoSpostamento('Anna', 10, 13, etichetta), { testo: 'Anna avanza di 3 caselle', verso: 'avanti' });
  assert.deepEqual(testoSpostamento('Bruno', 16, 13, etichetta), { testo: 'Bruno torna indietro di 3 caselle', verso: 'indietro' });
  assert.deepEqual(testoSpostamento('Anna', 5, 6, etichetta), { testo: 'Anna avanza di 1 casella', verso: 'avanti' });
});

prova('nessuno spostamento: dice dove resta, con il numero scritto sul tabellone', () => {
  assert.deepEqual(testoSpostamento('Anna', 13, 13, etichetta), { testo: 'Anna resta sulla casella 12', verso: 'fermo' });
  assert.deepEqual(testoSpostamento('Anna', 1, 1, etichetta), { testo: 'Anna resta sulla casella VIA!', verso: 'fermo' });
});

prova('nome mancante o numeri strani: frase comunque sensata', () => {
  assert.equal(testoSpostamento('', 3, 5).testo, 'Il giocatore avanza di 2 caselle');
  assert.equal(testoSpostamento('Anna', 'x', 5).verso, 'fermo');
});

// ---------- A- / A+ ----------

prova('livelli: si sale e si scende senza uscire dai limiti', () => {
  assert.equal(livelloSuccessivo(1, +1), 1.15);
  assert.equal(livelloSuccessivo(1, -1), 0.85);
  assert.equal(livelloSuccessivo(LIVELLI_TESTO[0], -1), LIVELLI_TESTO[0]);
  const max = LIVELLI_TESTO[LIVELLI_TESTO.length - 1];
  assert.equal(livelloSuccessivo(max, +1), max);
  assert.equal(livelloSuccessivo(7, +1), 1.15, 'valore sconosciuto: si riparte da 1');
});

prova('livello salvato strano: torna normale', () => {
  assert.equal(livelloValido('1.3'), 1.3);
  assert.equal(livelloValido(null), 1);
  assert.equal(livelloValido('enorme'), 1);
  assert.equal(livelloValido('5'), 1);
});

console.log(`Carte sul tabellone (calcoli): ${provati - falliti.length}/${provati} ok`);
if (falliti.length) { console.log('❌ Qualche verifica non e\' passata'); process.exit(1); }
console.log('✅ Tutte le verifiche passate');
