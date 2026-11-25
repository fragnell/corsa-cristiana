// test-recensioni-evidenza.mjs
// Prove delle recensioni "in evidenza" nella pagina principale (js/recensioni-evidenza.js).
// Si lancia con:  node test-recensioni-evidenza.mjs

import assert from 'node:assert/strict';
import { copiaPerEvidenza, elencoPerHome, dataBreve, stelline, MAX_IN_HOME } from './js/recensioni-evidenza.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${e.message}`); }
}

const vera = {
  stelle: 5, commento: '  Bellissimo, ci siamo divertiti!  ', nome: 'Luca', creataIl: 1763000000000,
  modalita: 'veloce', giocatori: 6, versione: 'beta', partite: 2, junior: false
};

prova('la copia porta solo voto, commento, data e soprannome', () => {
  const c = copiaPerEvidenza(vera, true, 1764000000000);
  assert.deepEqual(c, { stelle: 5, commento: 'Bellissimo, ci siamo divertiti!', nome: 'Luca', creataIl: 1763000000000, messaIl: 1764000000000 });
});

prova('senza soprannome se l\'Admin lo toglie', () => {
  const c = copiaPerEvidenza(vera, false, 1);
  assert.equal('nome' in c, false);
});

prova('recensione anonima: nessun campo nome', () => {
  const c = copiaPerEvidenza({ stelle: 4, commento: 'Ok', creataIl: 5 }, true, 9);
  assert.equal('nome' in c, false);
  assert.equal(c.creataIl, 5);
});

prova('data mancante: si usa il momento in cui e\' messa in evidenza', () => {
  assert.equal(copiaPerEvidenza({ stelle: 3 }, true, 777).creataIl, 777);
});

prova('elenco per la home: dalla piu\' recente, scarta le voci vuote o strane', () => {
  const e = elencoPerHome({
    a: { stelle: 4, commento: 'Vecchia', creataIl: 100 },
    b: { stelle: 5, commento: 'Nuova', creataIl: 300, nome: 'Anna' },
    c: { stelle: 0, commento: '' },
    d: 'testo strano',
    e: null,
    f: { stelle: 9, commento: 'voto impossibile ma commento sì', creataIl: 200 }
  });
  assert.deepEqual(e.map(x => x.chiave), ['b', 'f', 'a']);
  assert.equal(e[0].nome, 'Anna');
  assert.equal(e[1].stelle, 0);
  assert.equal(e[2].nome, '');
});

prova('elenco per la home: niente o qualcosa di strano -> lista vuota', () => {
  assert.deepEqual(elencoPerHome(null), []);
  assert.deepEqual(elencoPerHome('ciao'), []);
  assert.deepEqual(elencoPerHome({}), []);
});

prova('elenco per la home: al massimo MAX_IN_HOME', () => {
  const tante = {};
  for (let i = 0; i < MAX_IN_HOME + 10; i++) tante['k' + i] = { stelle: 5, commento: 'x', creataIl: i };
  assert.equal(elencoPerHome(tante).length, MAX_IN_HOME);
});

prova('data breve in italiano', () => {
  assert.equal(dataBreve(new Date(2026, 10, 12, 18, 30).getTime()), '12 novembre 2026');
  assert.equal(dataBreve(0), '');
  assert.equal(dataBreve('boh'), '');
  assert.equal(dataBreve(undefined), '');
});

prova('stelline', () => {
  assert.equal(stelline(4), '★★★★☆');
  assert.equal(stelline(0), '☆☆☆☆☆');
  assert.equal(stelline(12), '★★★★★');
  assert.equal(stelline('x'), '☆☆☆☆☆');
});

console.log(`Recensioni in evidenza: ${provati - falliti.length}/${provati} ok`);
if (falliti.length) { console.log('❌ Qualche verifica non e\' passata'); process.exit(1); }
console.log('✅ Tutte le verifiche passate');
