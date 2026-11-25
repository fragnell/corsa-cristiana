// test-vittoria-logica.mjs
// Prove dei calcoli della festa di fine partita (js/vittoria-logica.js). Si lancia con:
//   node test-vittoria-logica.mjs

import assert from 'node:assert/strict';
import { classificaFinale, lettereNome, testoRisposte } from './js/vittoria-logica.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${e.message}`); }
}

const giocatori = [
  { id: 0, nome: 'Anna', colore: 'rosso', posizione: 40, conoscenzaCorrette: 5, conoscenzaTotali: 8 },
  { id: 1, nome: 'Bruno', colore: 'giallo', posizione: 63, conoscenzaCorrette: 7, conoscenzaTotali: 9 },
  { id: 2, nome: 'Carlo', colore: 'blu', posizione: 40, conoscenzaCorrette: 6, conoscenzaTotali: 8 },
  { id: 3, nome: 'Dora', colore: 'verde', posizione: 22 },
  { id: 4, nome: 'Elia', colore: 'viola', posizione: 50, abbandonato: true }
];

prova('il vincitore e\' primo, poi per casella; chi ha lasciato non c\'e\'', () => {
  const c = classificaFinale(giocatori, 1);
  assert.deepEqual(c.map(g => g.nome), ['Bruno', 'Carlo', 'Anna', 'Dora']);
});

prova('stessa casella: stesso posto, come nelle gare (1, 2, 2, 4)', () => {
  const c = classificaFinale(giocatori, 1);
  assert.deepEqual(c.map(g => g.posto), [1, 2, 2, 4]);
});

prova('a parita\' di casella, prima chi ha risposto giusto a piu\' domande', () => {
  const c = classificaFinale(giocatori, 1);
  assert.equal(c[1].nome, 'Carlo');
});

prova('il vincitore e\' primo anche se (per errore) non e\' il piu\' avanti', () => {
  const c = classificaFinale(giocatori, 3);
  assert.equal(c[0].nome, 'Dora');
  assert.equal(c[0].posto, 1);
  assert.equal(c[1].posto, 2);
});

prova('un solo giocatore', () => {
  const c = classificaFinale([{ id: 0, nome: 'Solo', posizione: 63 }], 0);
  assert.equal(c.length, 1);
  assert.equal(c[0].posto, 1);
});

prova('dati strani: mai un errore', () => {
  assert.deepEqual(classificaFinale(null, 0), []);
  const c = classificaFinale([null, { nome: '  ', posizione: 'x' }, { id: 7, nome: 'Zoe', posizione: 10 }], 7);
  assert.equal(c[0].nome, 'Zoe');
  assert.equal(c[1].nome, '?');
  assert.equal(c[1].posizione, 0);
});

prova('lettere del nome: anche accenti ed emoji restano interi', () => {
  assert.deepEqual(lettereNome('Fefè'), ['F', 'e', 'f', 'è']);
  assert.equal(lettereNome('Ana 🙂').length, 5);
  assert.deepEqual(lettereNome(null), []);
  assert.equal(lettereNome('x'.repeat(100)).length, 40);
});

prova('testo delle risposte', () => {
  assert.equal(testoRisposte(7, 9), '✅ 7/9 risposte');
  assert.equal(testoRisposte(1, 1), '✅ 1/1 risposta');
  assert.equal(testoRisposte(0, 0), '');
  assert.equal(testoRisposte(undefined, undefined), '');
  assert.equal(testoRisposte(12, 9), '✅ 9/9 risposte');
});

console.log(`Festa di fine partita (calcoli): ${provati - falliti.length}/${provati} ok`);
if (falliti.length) { console.log('❌ Qualche verifica non e\' passata'); process.exit(1); }
console.log('✅ Tutte le verifiche passate');
