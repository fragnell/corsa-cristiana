// test-salmo-protezione.mjs
// Prove dell'immagine "a torcia" di COLLABORIAMO! (js/salmo/protezione.js): solo i
// calcoli (dove si accende la torcia, quanto e' grande, la firma). Si lancia con:
//   node test-salmo-protezione.mjs

import assert from 'node:assert/strict';
import {
  raggioTorcia, sollevamentoTorcia, posizioneTorcia, testoFirma,
  RAGGIO_MINIMO_PX, SOLLEVAMENTO_MINIMO_PX, SOLLEVAMENTO_MASSIMO_PX
} from './js/salmo/protezione.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${e.message}`); }
}

prova('la torcia e\' piu\' piccola di due riquadri: non mostra mai l\'immagine intera (4x4)', () => {
  const lato = 80;                       // griglia larga 320px, 4 colonne
  const r = raggioTorcia(lato);
  assert.ok(r * 2 < lato * 2, `diametro ${r * 2} troppo grande`);
  assert.ok(r * 2 >= lato, 'deve almeno far vedere un riquadro intero');
});

prova('la torcia non mostra tutta l\'immagine nemmeno con 2x2 (bambini)', () => {
  const lato = 160;                      // griglia larga 320px, 2 colonne
  const r = raggioTorcia(lato);
  assert.ok(r * 2 < lato * 2 * 0.8);
});

prova('raggio: valori strani -> minimo, mai un errore', () => {
  assert.equal(raggioTorcia(0), RAGGIO_MINIMO_PX);
  assert.equal(raggioTorcia(-5), RAGGIO_MINIMO_PX);
  assert.equal(raggioTorcia('ciao'), RAGGIO_MINIMO_PX);
  assert.equal(raggioTorcia(undefined), RAGGIO_MINIMO_PX);
  assert.equal(raggioTorcia(10), RAGGIO_MINIMO_PX);
});

prova('con il dito la torcia sta sopra il dito, con il mouse esattamente sotto il puntatore', () => {
  assert.equal(sollevamentoTorcia(80, 'mouse'), 0);
  const su = sollevamentoTorcia(80, 'touch');
  assert.ok(su >= SOLLEVAMENTO_MINIMO_PX && su <= SOLLEVAMENTO_MASSIMO_PX);
  assert.equal(sollevamentoTorcia(1000, 'touch'), SOLLEVAMENTO_MASSIMO_PX);
  assert.equal(sollevamentoTorcia(1, 'pen'), SOLLEVAMENTO_MINIMO_PX);
  assert.equal(sollevamentoTorcia(NaN, 'touch'), SOLLEVAMENTO_MINIMO_PX);
});

prova('posizione: coordinate dentro la griglia, alzate del sollevamento', () => {
  const rettangolo = { left: 20, top: 100, width: 320, height: 320 };
  const p = posizioneTorcia({ x: 180, y: 400 }, rettangolo, 4, 'touch');
  assert.equal(p.x, 160);
  assert.equal(p.y, 300 - sollevamentoTorcia(80, 'touch'));
  assert.equal(p.r, raggioTorcia(80));
  const m = posizioneTorcia({ x: 180, y: 400 }, rettangolo, 4, 'mouse');
  assert.equal(m.y, 300);
});

prova('posizione: colonne mancanti o rettangolo vuoto non rompono niente', () => {
  const p = posizioneTorcia({ x: 10, y: 10 }, {}, 0, 'touch');
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.r));
  const q = posizioneTorcia(null, null, undefined, undefined);
  assert.ok(Number.isNaN(q.x) || Number.isFinite(q.x));
});

prova('firma: il nome di chi guarda, pulito e corto', () => {
  assert.equal(testoFirma('Marco'), 'Marco · COLLABORIAMO!');
  assert.equal(testoFirma('  Anna \n Maria  '), 'Anna Maria · COLLABORIAMO!');
  assert.equal(testoFirma(''), 'COLLABORIAMO!');
  assert.equal(testoFirma(null), 'COLLABORIAMO!');
  assert.ok(testoFirma('x'.repeat(100)).length <= 30 + ' · COLLABORIAMO!'.length);
});

console.log(`Salmo 133:1 — immagine a torcia: ${provati - falliti.length}/${provati} ok`);
if (falliti.length) { console.log('❌ Qualche verifica non e\' passata'); process.exit(1); }
console.log('✅ Tutte le verifiche passate');
