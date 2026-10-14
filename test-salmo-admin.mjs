// test-salmo-admin.mjs
// Prove dei valori del pannello Admin di COLLABORIAMO! (js/salmo/admin-valori.js).
// Si lancia con:  node test-salmo-admin.mjs
// Solo numeri in ingresso e numeri in uscita: niente browser, niente Firebase.

import assert from 'node:assert/strict';
import { CONFIG, unisciConfig } from './js/config.js';
import { configSalmoSicura, valutaSalmo } from './js/salmo/regola.js';
import { creaStatoIniziale } from './js/stato.js';
import {
  LIMITI, RIQUADRI_CONSIGLIATI, CAMPI_DI_PROVA, DISTACCHI,
  msInSecondi, secondiInMs, campiDaConfig, configDaCampi,
  conValoriDiProva, sembranoValoriDiProva
} from './js/salmo/admin-valori.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.message).split('\n').join('\n        ')}`); }
}

const BASE = CONFIG.salmo;

// ================= secondi e millisecondi =================

prova('secondi <-> millisecondi', () => {
  assert.equal(msInSecondi(60000), 60);
  assert.equal(msInSecondi(7500), 7.5);
  assert.equal(msInSecondi(12345), 12.3, 'al massimo un decimale');
  assert.equal(secondiInMs(90), 90000);
  assert.equal(secondiInMs('7,5'.replace(',', '.')), 7500);
  assert.equal(secondiInMs(0.1), 100);
});

// ================= dalla configurazione ai campi =================

prova('campiDaConfig: i valori di base diventano campi leggibili', () => {
  const c = campiDaConfig(BASE);
  assert.equal(c.attivo, true);
  assert.equal(c.giocatoriMinimi, 3);
  assert.equal(c.distacco4, 16);
  assert.equal(c.distacco6, 18);
  assert.equal(c.distacco8, 20);
  assert.equal(c.distacco10, 20);
  assert.equal(c.distacco12, 20);
  assert.equal(c.primoMassimo, 50);
  assert.equal(c.giriDiPausa, 2);
  assert.equal(c.maxPerPartita, 2);
  assert.equal(c.bonusUltimo, 10);
  assert.equal(c.malusPrimo, 10, 'nel pannello il malus si scrive positivo');
  assert.equal(c.ultimoSaltaSeFallisce, true);
  assert.equal(c.ultimoTiraDopoSuccesso, false);
  assert.equal(c.tentativi, 2);
  assert.equal(c.prontoS, 60);
  assert.equal(c.sbirciataS, 10);
  assert.equal(c.esitoS, 8);
  assert.equal(c.normaleRiquadri, 16);
  assert.equal(c.normaleProvaS, 90);
  assert.equal(c.normaleAnteprimaS, 15);
  assert.equal(c.bambiniRiquadri, 4);
  assert.equal(c.bambiniProvaS, 75);
  assert.equal(c.bambiniAnteprimaS, 10);
});

prova('campiDaConfig: configurazione vuota, mancante o storta -> valori di base', () => {
  for (const grezza of [undefined, null, {}, 'x', 42, { distacchi: 'no', livelli: 7 }, { attivo: 'si', tentativi: 'molti' }]) {
    const c = campiDaConfig(grezza);
    assert.equal(c.giocatoriMinimi, 3);
    assert.equal(c.tentativi, 2);
    assert.equal(c.normaleRiquadri, 16);
    assert.equal(c.attivo, true);
    for (const v of Object.values(c)) assert.ok(typeof v === 'number' || typeof v === 'boolean', 'campo non valido: ' + v);
  }
});

prova('campiDaConfig: un malus scritto positivo o negativo si mostra sempre positivo', () => {
  assert.equal(campiDaConfig({ malusPrimo: -7 }).malusPrimo, 7);
  assert.equal(campiDaConfig({ malusPrimo: 7 }).malusPrimo, 7);
  assert.equal(campiDaConfig({ malusPrimo: 0 }).malusPrimo, 0);
});

// ================= dai campi alla configurazione =================

prova('configDaCampi: i campi di base tornano alla configurazione di base', () => {
  const { valori, errori } = configDaCampi(campiDaConfig(BASE));
  assert.deepEqual(errori, []);
  assert.deepEqual(valori, configSalmoSicura(BASE));
});

prova('configDaCampi: andata e ritorno su configurazioni diverse', () => {
  const variante = {
    attivo: false, giocatoriMinimi: 4,
    distacchi: { finoA4: 15, finoA6: 17, finoA8: 19, finoA10: 21, finoA12: 23 },
    primoMassimo: 60, giriDiPausa: 1, maxPerPartita: 3, bonusUltimo: 8, malusPrimo: -6,
    ultimoSaltaSeFallisce: false, ultimoTiraDopoSuccesso: true, tentativi: 3,
    prontoMs: 45000, sbirciataMs: 7500, esitoMs: 5000,
    livelli: { bambini: { riquadri: 6, provaMs: 100000, anteprimaMs: 12000 }, normale: { riquadri: 12, provaMs: 120000, anteprimaMs: 20000 } }
  };
  const { valori, errori } = configDaCampi(campiDaConfig(variante));
  assert.deepEqual(errori, []);
  assert.deepEqual(valori, variante);
});

prova('configDaCampi: il risultato non contiene mai undefined, NaN o -0 (Firebase non li accetta)', () => {
  const casi = [campiDaConfig(BASE), { ...campiDaConfig(BASE), malusPrimo: 0, maxPerPartita: 0, giriDiPausa: 0 }];
  for (const campi of casi) {
    const { valori } = configDaCampi(campi);
    const visita = (v, percorso) => {
      if (v && typeof v === 'object') return Object.entries(v).forEach(([k, x]) => visita(x, percorso + '.' + k));
      assert.notEqual(v, undefined, percorso + ' undefined');
      assert.notEqual(v, null, percorso + ' null');
      if (typeof v === 'number') { assert.ok(Number.isFinite(v), percorso + ' non finito'); assert.ok(!Object.is(v, -0), percorso + ' e\' -0'); }
    };
    visita(valori, 'salmo');
  }
});

prova('configDaCampi: il malus esce sempre negativo, scritto con o senza segno', () => {
  for (const scritto of [10, '10', '-10', ' 10 ', -10]) {
    const { valori, errori } = configDaCampi({ ...campiDaConfig(BASE), malusPrimo: scritto });
    assert.deepEqual(errori, [], 'scritto: ' + scritto);
    assert.equal(valori.malusPrimo, -10);
  }
  assert.equal(configDaCampi({ ...campiDaConfig(BASE), malusPrimo: 0 }).valori.malusPrimo, 0);
});

prova('configDaCampi: i campi del form arrivano come testo e vanno bene lo stesso', () => {
  const testo = {};
  for (const [k, v] of Object.entries(campiDaConfig(BASE))) testo[k] = typeof v === 'boolean' ? v : String(v);
  const { valori, errori } = configDaCampi(testo);
  assert.deepEqual(errori, []);
  assert.deepEqual(valori, configSalmoSicura(BASE));
});

prova('configDaCampi: virgola decimale accettata nei secondi', () => {
  const { valori, errori } = configDaCampi({ ...campiDaConfig(BASE), sbirciataS: '7,5' });
  assert.deepEqual(errori, []);
  assert.equal(valori.sbirciataMs, 7500);
});

// campo da rovinare, valore rovinato
const ROVINATI = [
  ['giocatoriMinimi', '1'], ['giocatoriMinimi', '13'], ['giocatoriMinimi', ''], ['giocatoriMinimi', 'tre'], ['giocatoriMinimi', '3.5'],
  ['distacco4', '0'], ['distacco6', '100'], ['distacco8', '-3'], ['distacco10', ''], ['distacco12', 'x'],
  ['primoMassimo', '0'], ['primoMassimo', '201'],
  ['giriDiPausa', '-1'], ['giriDiPausa', '21'], ['maxPerPartita', '-1'], ['maxPerPartita', '2.5'],
  ['bonusUltimo', '-1'], ['bonusUltimo', '51'], ['malusPrimo', '51'], ['malusPrimo', 'tanto'], ['malusPrimo', ''],
  ['tentativi', '0'], ['tentativi', '6'],
  ['prontoS', '9'], ['prontoS', '301'], ['prontoS', ''], ['sbirciataS', '0'], ['sbirciataS', '61'], ['esitoS', '2'], ['esitoS', '61'],
  ['normaleRiquadri', '1'], ['normaleRiquadri', '23'], ['normaleRiquadri', ''], ['normaleProvaS', '9'], ['normaleProvaS', '601'], ['normaleAnteprimaS', '0'], ['normaleAnteprimaS', '121'],
  ['bambiniRiquadri', '0'], ['bambiniRiquadri', '30'], ['bambiniProvaS', '5'], ['bambiniAnteprimaS', '500']
];

prova('configDaCampi: ogni campo fuori misura viene segnalato (e dice quale)', () => {
  for (const [campo, rovinato] of ROVINATI) {
    const { errori } = configDaCampi({ ...campiDaConfig(BASE), [campo]: rovinato });
    assert.equal(errori.length, 1, `${campo}=${JSON.stringify(rovinato)} -> ${errori.length} errori: ${errori.join(' | ')}`);
    assert.ok(/da \d+ a \d+/.test(errori[0]), 'il messaggio deve dire i limiti: ' + errori[0]);
  }
});

prova('configDaCampi: piu\' campi sbagliati -> piu\' messaggi', () => {
  const { errori } = configDaCampi({ ...campiDaConfig(BASE), giocatoriMinimi: '', tentativi: '9', prontoS: 'x' });
  assert.equal(errori.length, 3);
});

prova('configDaCampi: input assurdi non lanciano mai errori', () => {
  for (const campi of [undefined, null, {}, 'x', 7, [], { attivo: 'si' }, { giocatoriMinimi: {} , distacco4: [], prontoS: null }]) {
    const { valori, errori } = configDaCampi(campi);
    assert.ok(Array.isArray(errori), 'errori deve essere un elenco');
    assert.ok(valori && typeof valori === 'object', 'valori deve essere un oggetto');
  }
  // senza campi, tutto e' da correggere
  assert.ok(configDaCampi({}).errori.length >= 10);
});

prova('configDaCampi: le caselle (vero/falso) sono vere solo se sono proprio true', () => {
  const { valori } = configDaCampi({ ...campiDaConfig(BASE), attivo: 'true', ultimoSaltaSeFallisce: 1, ultimoTiraDopoSuccesso: 'si' });
  assert.equal(valori.attivo, false);
  assert.equal(valori.ultimoSaltaSeFallisce, false);
  assert.equal(valori.ultimoTiraDopoSuccesso, false);
});

prova('configDaCampi: i limiti accettano gli estremi', () => {
  const estremi = {
    ...campiDaConfig(BASE),
    giocatoriMinimi: LIMITI.giocatoriMinimi[0], primoMassimo: LIMITI.primoMassimo[1],
    giriDiPausa: LIMITI.giriDiPausa[0], maxPerPartita: LIMITI.maxPerPartita[1],
    tentativi: LIMITI.tentativi[1], prontoS: LIMITI.prontoS[0], sbirciataS: LIMITI.sbirciataS[1],
    normaleRiquadri: LIMITI.riquadri[1], bambiniRiquadri: LIMITI.riquadri[0]
  };
  const { errori } = configDaCampi(estremi);
  assert.deepEqual(errori, []);
});

prova('i riquadri consigliati stanno nei limiti e hanno una griglia piena', () => {
  for (const n of RIQUADRI_CONSIGLIATI) {
    assert.ok(n >= LIMITI.riquadri[0] && n <= LIMITI.riquadri[1]);
    const campi = { ...campiDaConfig(BASE), normaleRiquadri: n };
    assert.deepEqual(configDaCampi(campi).errori, []);
  }
});

// ================= valori di prova e di base =================

prova('valori di prova: cambiano solo quello che serve a provare in due', () => {
  const prima = campiDaConfig(BASE);
  const dopo = conValoriDiProva(prima);
  for (const k of Object.keys(prima)) {
    if (k in CAMPI_DI_PROVA) continue;
    assert.equal(dopo[k], prima[k], 'ha cambiato anche ' + k);
  }
  assert.equal(dopo.giocatoriMinimi, 2);
  for (const [campo] of DISTACCHI) assert.equal(dopo[campo], 3);
  assert.equal(dopo.giriDiPausa, 0);
  assert.ok(dopo.maxPerPartita >= 5);
  assert.notEqual(dopo, prima, 'deve essere una copia');
  assert.equal(prima.giocatoriMinimi, 3, "l'originale non si tocca");
});

prova('valori di prova: sono validi e fanno davvero scattare la prova con due soli giocatori', () => {
  const { valori, errori } = configDaCampi(conValoriDiProva(campiDaConfig(BASE)));
  assert.deepEqual(errori, []);
  const cfg = configSalmoSicura(valori);
  const stato = creaStatoIniziale([{ nome: 'A', colore: 'rosso' }, { nome: 'B', colore: 'blu' }]);
  stato.giocatori[0].posizione = 12;   // primo
  stato.giocatori[1].posizione = 5;    // ultimo (7 caselle indietro)
  stato.turnoDi = 1;
  const d = valutaSalmo(stato, cfg, { presenti: () => true });
  assert.equal(d.scatta, true, JSON.stringify(d));
  assert.equal(d.primo, 0);
  assert.equal(d.ultimo, 1);
  // con i valori di base, invece, con due giocatori non scatta
  const base = valutaSalmo(stato, configSalmoSicura(BASE), { presenti: () => true });
  assert.equal(base.scatta, false);
});

prova('sembranoValoriDiProva: avvisa con i valori di prova, mai con quelli di base', () => {
  assert.equal(sembranoValoriDiProva(campiDaConfig(BASE)), false);
  assert.equal(sembranoValoriDiProva(conValoriDiProva(campiDaConfig(BASE))), true);
  assert.equal(sembranoValoriDiProva({ ...campiDaConfig(BASE), giocatoriMinimi: 2 }), true);
  assert.equal(sembranoValoriDiProva({ ...campiDaConfig(BASE), distacco12: 9 }), true);
  assert.equal(sembranoValoriDiProva({ ...campiDaConfig(BASE), distacco12: 10 }), false);
  assert.equal(sembranoValoriDiProva({ ...conValoriDiProva(campiDaConfig(BASE)), attivo: false }), false, 'spento: nessun pericolo');
  // campi vuoti mentre si scrive: non e' un avviso
  assert.equal(sembranoValoriDiProva({ ...campiDaConfig(BASE), giocatoriMinimi: '' }), false);
  assert.equal(sembranoValoriDiProva(undefined), false);
});

prova('i valori di base di config.js passano il controllo del pannello', () => {
  const { errori } = configDaCampi(campiDaConfig(CONFIG.salmo));
  assert.deepEqual(errori, []);
  const unita = unisciConfig(CONFIG, {});
  assert.deepEqual(configDaCampi(campiDaConfig(unita.salmo)).valori, configSalmoSicura(CONFIG.salmo));
});

prova('salvare il pannello non cancella le sottosezioni quando si riunisce con la base', () => {
  const { valori } = configDaCampi(conValoriDiProva(campiDaConfig(BASE)));
  const unita = unisciConfig(CONFIG, { salmo: valori });
  assert.equal(unita.salmo.giocatoriMinimi, 2);
  assert.equal(unita.salmo.distacchi.finoA12, 3);
  assert.equal(unita.salmo.livelli.normale.riquadri, 16);
  assert.equal(unita.salmo.livelli.bambini.riquadri, 4);
});

// ================= esito finale =================

console.log(`\nSalmo 133:1 — pannello Admin: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
