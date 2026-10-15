// test-avviso-connessione.mjs
// Prove dell'avviso "nessuna connessione" (js/avviso-connessione.js): compare solo se la connessione manca
// per qualche secondo, sparisce da solo quando torna. Si lancia con:  node test-avviso-connessione.mjs
//
// Niente Firebase e niente orologio vero: la connessione e i timer sono FINTI.

import assert from 'node:assert/strict';
import { avviaAvvisoConnessione, RITARDO_AVVISO_MS } from './js/avviso-connessione.js';

let provati = 0;
const falliti = [];
async function prova(nome, fn) {
  provati++;
  try { await fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.stack || e.message).split('\n').slice(0, 5).join('\n        ')}`); }
}

// Un orologio finto: i timer scattano quando si "fa passare il tempo"
function creaOrologio() {
  let adesso = 0, prossimo = 1;
  const timer = new Map();
  return {
    setTimeout: (f, ms) => { const id = prossimo++; timer.set(id, { quando: adesso + ms, f }); return id; },
    clearTimeout: (id) => { timer.delete(id); },
    passa(ms) {
      const fine = adesso + ms;
      for (;;) {
        const pronti = [...timer.entries()].filter(([, t]) => t.quando <= fine).sort((a, b) => a[1].quando - b[1].quando);
        if (!pronti.length) break;
        const [id, t] = pronti[0];
        timer.delete(id);
        adesso = t.quando;
        t.f();
      }
      adesso = fine;
    },
    inAttesa: () => timer.size
  };
}

// Un riquadro finto con le classi, e una "connessione" che si puo' cambiare a mano
function creaFinti({ iniziale } = {}) {
  const classi = new Set(['nascosta']);
  const elemento = { classList: { add: c => classi.add(c), remove: c => classi.delete(c), contains: c => classi.has(c) } };
  const ascoltatori = new Set();
  let smesso = 0;
  const ascolta = (cb) => {
    ascoltatori.add(cb);
    if (iniziale !== undefined) cb(iniziale);
    return () => { ascoltatori.delete(cb); smesso++; };
  };
  return { elemento, classi, ascolta, imposta: (v) => [...ascoltatori].forEach(cb => cb(v)), visibile: () => !classi.has('nascosta'), ascoltatori, smessoVolte: () => smesso };
}

await prova('collegato fin dall\'inizio: l\'avviso non compare mai', () => {
  const o = creaOrologio(); const f = creaFinti({ iniziale: true });
  avviaAvvisoConnessione({ elemento: f.elemento, ascolta: f.ascolta, ambiente: o });
  o.passa(60_000);
  assert.equal(f.visibile(), false);
});

await prova('senza collegamento per qualche secondo: l\'avviso compare, non subito', () => {
  const o = creaOrologio(); const f = creaFinti({ iniziale: true });
  avviaAvvisoConnessione({ elemento: f.elemento, ascolta: f.ascolta, ambiente: o });
  f.imposta(false);
  o.passa(RITARDO_AVVISO_MS - 1);
  assert.equal(f.visibile(), false, 'un attimo di interruzione non basta');
  o.passa(1);
  assert.equal(f.visibile(), true);
});

await prova('un\'interruzione breve non fa comparire niente', () => {
  const o = creaOrologio(); const f = creaFinti({ iniziale: true });
  avviaAvvisoConnessione({ elemento: f.elemento, ascolta: f.ascolta, ambiente: o });
  f.imposta(false);
  o.passa(1500);
  f.imposta(true);
  o.passa(60_000);
  assert.equal(f.visibile(), false);
  assert.equal(o.inAttesa(), 0, 'nessun timer rimasto in giro');
});

await prova('quando il collegamento torna l\'avviso sparisce da solo', () => {
  const o = creaOrologio(); const f = creaFinti({ iniziale: false });
  avviaAvvisoConnessione({ elemento: f.elemento, ascolta: f.ascolta, ambiente: o });
  o.passa(RITARDO_AVVISO_MS);
  assert.equal(f.visibile(), true);
  f.imposta(true);
  assert.equal(f.visibile(), false);
});

await prova('al caricamento della pagina (non ancora collegato): l\'avviso compare solo se ci mette troppo', () => {
  const o = creaOrologio(); const f = creaFinti({ iniziale: false });
  avviaAvvisoConnessione({ elemento: f.elemento, ascolta: f.ascolta, ambiente: o });
  o.passa(1000);
  f.imposta(true);                       // si collega dopo 1 secondo: come sempre
  o.passa(60_000);
  assert.equal(f.visibile(), false);
});

await prova('tanti "non collegato" di fila non accumulano timer', () => {
  const o = creaOrologio(); const f = creaFinti({ iniziale: true });
  avviaAvvisoConnessione({ elemento: f.elemento, ascolta: f.ascolta, ambiente: o });
  for (let i = 0; i < 10; i++) f.imposta(false);
  assert.equal(o.inAttesa(), 1);
  o.passa(RITARDO_AVVISO_MS);
  for (let i = 0; i < 10; i++) f.imposta(false);
  assert.equal(o.inAttesa(), 0, 'gia\' visibile: niente altri timer');
  assert.equal(f.visibile(), true);
});

await prova('piu\' interruzioni una dopo l\'altra: ogni volta compare e sparisce', () => {
  const o = creaOrologio(); const f = creaFinti({ iniziale: true });
  avviaAvvisoConnessione({ elemento: f.elemento, ascolta: f.ascolta, ambiente: o });
  for (let giro = 0; giro < 3; giro++) {
    f.imposta(false); o.passa(RITARDO_AVVISO_MS); assert.equal(f.visibile(), true, `giro ${giro}`);
    f.imposta(true); assert.equal(f.visibile(), false, `giro ${giro}`);
  }
});

await prova('smetti(): l\'avviso sparisce, il timer si ferma e non si ascolta piu\'', () => {
  const o = creaOrologio(); const f = creaFinti({ iniziale: false });
  const a = avviaAvvisoConnessione({ elemento: f.elemento, ascolta: f.ascolta, ambiente: o });
  o.passa(RITARDO_AVVISO_MS);
  assert.equal(f.visibile(), true);
  a.smetti();
  assert.equal(f.visibile(), false);
  assert.equal(f.smessoVolte(), 1);
  f.imposta(false); o.passa(60_000);
  assert.equal(f.visibile(), false);
});

await prova('valori strani dalla connessione contano come "non collegato"', () => {
  const o = creaOrologio(); const f = creaFinti({ iniziale: true });
  avviaAvvisoConnessione({ elemento: f.elemento, ascolta: f.ascolta, ambiente: o });
  f.imposta(null); o.passa(RITARDO_AVVISO_MS);
  assert.equal(f.visibile(), true);
  f.imposta('si');
  assert.equal(f.visibile(), true, '"si" non e\' true');
  f.imposta(true);
  assert.equal(f.visibile(), false);
});

await prova('mai errori verso chi chiama: riquadro mancante, ascolto che lancia, parametri assenti', () => {
  const o = creaOrologio();
  const avvisoVero = console.warn;
  console.warn = () => {};                 // l'ascolto che lancia fa scrivere un avviso in console: qui e' atteso
  try { provaSenzaErrori(o); } finally { console.warn = avvisoVero; }
});

function provaSenzaErrori(o) {
  assert.doesNotThrow(() => avviaAvvisoConnessione({ elemento: null, ascolta: (cb) => { cb(false); return () => {}; }, ambiente: o }));
  o.passa(RITARDO_AVVISO_MS);
  assert.doesNotThrow(() => avviaAvvisoConnessione({ elemento: {}, ascolta: () => { throw new Error('rete'); }, ambiente: o }));
  assert.doesNotThrow(() => avviaAvvisoConnessione({ ascolta: undefined, ambiente: o }));
  assert.doesNotThrow(() => avviaAvvisoConnessione());
  const a = avviaAvvisoConnessione({ elemento: { classList: { add() { throw new Error('x'); }, remove() { throw new Error('x'); } } }, ascolta: (cb) => { cb(false); return () => { throw new Error('y'); }; }, ambiente: o });
  assert.doesNotThrow(() => o.passa(RITARDO_AVVISO_MS));
  assert.doesNotThrow(() => a.smetti());
}

await prova('il ritardo di serie e\' di qualche secondo: ne\' immediato ne\' troppo lungo', () => {
  assert.ok(RITARDO_AVVISO_MS >= 2000 && RITARDO_AVVISO_MS <= 10_000, `RITARDO_AVVISO_MS = ${RITARDO_AVVISO_MS}`);
  const o = creaOrologio(); const f = creaFinti({ iniziale: true });
  avviaAvvisoConnessione({ elemento: f.elemento, ascolta: f.ascolta, ambiente: o });
  f.imposta(false);
  o.passa(1500);
  assert.equal(f.visibile(), false, 'dopo un secondo e mezzo non si vede ancora');
  o.passa(10_000);
  assert.equal(f.visibile(), true, 'dopo un po\' si');
});

await prova('dopo smetti() un cambiamento arrivato in ritardo non rimette niente in moto', () => {
  const o = creaOrologio(); const f = creaFinti({ iniziale: true });
  let richiamo = null;
  // smetti() non riesce a staccare l'ascolto (come se il cambiamento fosse gia' in viaggio): arriva lo stesso
  const ascolta = (cb) => { richiamo = cb; return () => {}; };
  const a = avviaAvvisoConnessione({ elemento: f.elemento, ascolta, ambiente: o });
  a.smetti();
  richiamo(false);
  assert.equal(a.stato().inAttesa, false, 'nessun timer partito');
  o.passa(60_000);
  assert.equal(f.visibile(), false);
  assert.equal(o.inAttesa(), 0);
});

await prova('anche se il timer non si lascia fermare, dopo smetti() l\'avviso non compare', () => {
  const o = creaOrologio(); const f = creaFinti({ iniziale: true });
  const senzaFreno = { setTimeout: o.setTimeout, clearTimeout: () => { throw new Error('questo timer non si ferma'); } };
  const a = avviaAvvisoConnessione({ elemento: f.elemento, ascolta: f.ascolta, ambiente: senzaFreno });
  f.imposta(false);            // parte il timer
  a.smetti();                  // prova a fermarlo (non ci riesce)
  o.passa(60_000);             // il timer scatta lo stesso
  assert.equal(f.visibile(), false);
});

console.log(`\nAvviso di connessione: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
