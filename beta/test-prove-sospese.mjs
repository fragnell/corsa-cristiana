// test-prove-sospese.mjs
// Prove della striscia "In sospeso" sui telefoni (js/prove-sospese.js). Si lancia con:
//   node test-prove-sospese.mjs

import assert from 'node:assert/strict';
import { proveSospeseDegliAltri } from './js/prove-sospese.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${e.message}`); }
}

const stato = {
  giocatori: [
    { nome: 'Anna', provaInSospeso: { testo: '  Resta con gli occhi chiusi fino al tuo turno ' } },
    { nome: 'Marco', provaInSospeso: null },
    { nome: 'Luca', provaInSospeso: { testo: 'Non parlare' } },
    { nome: 'Sara', provaInSospeso: { testo: 'Canta' }, abbandonato: true }
  ]
};

prova('mostra le prove degli altri, non la mia', () => {
  assert.deepEqual(proveSospeseDegliAltri(stato, 0), [{ nome: 'Luca', testo: 'Non parlare' }]);
  assert.deepEqual(proveSospeseDegliAltri(stato, 1), [
    { nome: 'Anna', testo: 'Resta con gli occhi chiusi fino al tuo turno' },
    { nome: 'Luca', testo: 'Non parlare' }
  ]);
});

prova('chi ha abbandonato non conta', () => {
  assert.ok(!proveSospeseDegliAltri(stato, 1).some(p => p.nome === 'Sara'));
});

prova('nessuna prova: lista vuota', () => {
  assert.deepEqual(proveSospeseDegliAltri({ giocatori: [{ nome: 'A' }, { nome: 'B' }] }, 0), []);
});

prova('stato strano: mai un errore', () => {
  assert.deepEqual(proveSospeseDegliAltri(null, 0), []);
  assert.deepEqual(proveSospeseDegliAltri({}, 0), []);
  assert.deepEqual(proveSospeseDegliAltri({ giocatori: [null, { nome: 5, provaInSospeso: { testo: 7 } }] }, 0), [{ nome: '?', testo: '' }]);
});

console.log(`Prove in sospeso sui telefoni: ${provati - falliti.length}/${provati} ok`);
if (falliti.length) { console.log('❌ Qualche verifica non e\' passata'); process.exit(1); }
console.log('✅ Tutte le verifiche passate');
