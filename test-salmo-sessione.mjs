// test-salmo-sessione.mjs
// Prove dei dati della prova: sessione.js (cosa si pubblica, cosa resta segreto,
// come si leggono le risposte dei telefoni), testi.js (le frasi) e disegni.js
// (i 22 disegni). Si lancia con:  node test-salmo-sessione.mjs

import assert from 'node:assert/strict';
import { CONFIG } from './js/config.js';
import { configSalmoSicura } from './js/salmo/regola.js';
import { generatoreConSeme, stessoOrdine } from './js/salmo/mosaico.js';
import {
  creaSessione, ruoloDi, sessioneScaduta, eProntoDi, consegnaNumero, sbirciataFatta,
  valutaConsegna, senzaUndefined, comeElenco, GRAZIA_CONSEGNA_FINALE_MS, DURATA_ANNULLAMENTO_MS,
  MARGINE_ANIMAZIONE_MS, MARGINE_SICUREZZA_MS
} from './js/salmo/sessione.js';
import { DISEGNI, ID_DISEGNI, svgDisegno, nomeDisegno } from './js/salmo/disegni.js';
import { TITOLO, VERSETTO, caselle, secondi, tabellone, telefono } from './js/salmo/testi.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.message).split('\n').join('\n        ')}`); }
}

const CFG = configSalmoSicura(CONFIG.salmo);
const DECISIONE = { scatta: true, motivo: 'ok', primo: 1, ultimo: 0, distacco: 30, livello: 'normale' };
const crea = (extra = {}) => creaSessione({
  decisione: { ...DECISIONE, ...(extra.decisione || {}) },
  cfg: extra.cfg || CFG,
  idDisegni: extra.idDisegni || ID_DISEGNI,
  adesso: extra.adesso || 1_700_000_000_000,
  rng: extra.rng || generatoreConSeme(11)
});

// ================= creaSessione =================

prova('sessione normale: 16 riquadri, 4x4, tempi dalla configurazione', () => {
  const s = crea();
  const p = s.pubblica;
  assert.equal(p.fase, 'pronti');
  assert.equal(p.primoId, 1);
  assert.equal(p.ultimoId, 0);
  assert.equal(p.livello, 'normale');
  assert.equal(p.riquadri, 16);
  assert.equal(p.righe, 4);
  assert.equal(p.colonne, 4);
  assert.equal(p.anteprimaMs, 15000);
  assert.equal(p.provaMs, 90000);
  assert.equal(p.sbirciataMs, 10000);
  assert.equal(p.esitoMs, 8000);
  assert.equal(p.tentativiMax, 2);
  assert.equal(p.tentativiFatti, 0);
  assert.equal(p.bonus, 10);
  assert.equal(p.malus, 10);
  assert.equal(p.ultimoSalta, true);
  assert.equal(p.scadenza, 1_700_000_000_000 + 60000);
});

prova('sessione bambini: 4 riquadri, 2x2, 75s e anteprima 10s', () => {
  const p = crea({ decisione: { livello: 'bambini' } }).pubblica;
  assert.equal(p.riquadri, 4);
  assert.equal(p.righe, 2);
  assert.equal(p.colonne, 2);
  assert.equal(p.provaMs, 75000);
  assert.equal(p.anteprimaMs, 10000);
});

prova('i segreti non stanno nella parte pubblica', () => {
  const s = crea();
  const testo = JSON.stringify(s.pubblica);
  for (const id of s.soluzione) assert.equal(testo.includes(`"${id}"`), false, 'riquadro nella parte pubblica: ' + id);
  assert.equal('tessere' in s.pubblica, false);
  assert.equal('mescolata' in s.pubblica, false);
  assert.equal('soluzione' in s.pubblica, false);
});

prova('segreto del primo = soluzione; segreto dell\'ultimo = stessi riquadri in ordine diverso', () => {
  const s = crea();
  assert.deepEqual(s.segretoPrimo.tessere, s.soluzione);
  assert.equal(s.segretoPrimo.sid, s.pubblica.id);
  assert.equal(s.segretoUltimo.sid, s.pubblica.id);
  assert.equal(s.segretoUltimo.mescolata.length, 16);
  assert.deepEqual([...s.segretoUltimo.mescolata].sort(), [...s.soluzione].sort());
  assert.equal(stessoOrdine(s.segretoUltimo.mescolata, s.soluzione), false, 'la prova non deve partire gia\' risolta');
  assert.equal(new Set(s.soluzione).size, 16, 'riquadri tutti diversi');
  s.soluzione.forEach(id => assert.ok(ID_DISEGNI.includes(id)));
});

prova('il segreto dell\'ultimo non contiene la soluzione e viceversa', () => {
  const s = crea();
  assert.equal('tessere' in s.segretoUltimo, false);
  assert.equal('mescolata' in s.segretoPrimo, false);
});

prova('l\'identificativo della sessione e\' diverso a ogni prova e fatto di caratteri semplici', () => {
  const ids = new Set();
  for (let i = 0; i < 50; i++) {
    const id = crea({ adesso: 1_700_000_000_000 + i * 977, rng: generatoreConSeme(i + 100) }).pubblica.id;
    assert.match(id, /^s[0-9a-z]+$/);
    ids.add(id);
  }
  assert.equal(ids.size, 50);
});

prova('con lo stesso seme la sessione e\' identica (cosi\' i collaudi si ripetono)', () => {
  const a = crea({ rng: generatoreConSeme(3) });
  const b = crea({ rng: generatoreConSeme(3) });
  assert.deepEqual(a, b);
  const c = crea({ rng: generatoreConSeme(4) });
  assert.notDeepEqual(a.soluzione, c.soluzione);
});

prova('mai piu\' riquadri dei disegni disponibili, mai meno di 2', () => {
  const cfg = configSalmoSicura({ ...CONFIG.salmo, livelli: { ...CONFIG.salmo.livelli, normale: { riquadri: 500, provaMs: 90000, anteprimaMs: 15000 } } });
  const grande = crea({ cfg });
  assert.equal(grande.soluzione.length, ID_DISEGNI.length);
  const cfgUno = configSalmoSicura({ ...CONFIG.salmo, livelli: { ...CONFIG.salmo.livelli, normale: { riquadri: 1, provaMs: 90000, anteprimaMs: 15000 } } });
  const piccolo = crea({ cfg: cfgUno });
  assert.equal(piccolo.soluzione.length, 2);
  assert.equal(stessoOrdine(piccolo.segretoUltimo.mescolata, piccolo.soluzione), false);
});

prova('poche immagini disponibili: si adatta senza rompersi', () => {
  const s = crea({ idDisegni: ['a', 'b', 'c', 'd', 'e'] });
  assert.equal(s.soluzione.length, 5);
});

prova('il malus pubblicato e\' sempre positivo (e\' il testo "torna indietro di N")', () => {
  const cfg = configSalmoSicura({ ...CONFIG.salmo, malusPrimo: -7 });
  assert.equal(crea({ cfg }).pubblica.malus, 7);
  const cfg2 = configSalmoSicura({ ...CONFIG.salmo, malusPrimo: 7 });
  assert.equal(crea({ cfg: cfg2 }).pubblica.malus, 7);
});

prova('la scadenza massima copre tutte le fasi con i loro margini', () => {
  const p = crea().pubblica;
  const somma = 60000 + 15000 + 90000 + GRAZIA_CONSEGNA_FINALE_MS + 8000 + MARGINE_ANIMAZIONE_MS + MARGINE_SICUREZZA_MS;
  assert.equal(p.scadenzaMassima - 1_700_000_000_000, somma);
  assert.ok(somma > 60000 + 15000 + 90000 + 8000 + 10000, 'margine troppo stretto');
});

prova('nessun "undefined" nei dati pubblici e nei segreti (Firebase rifiuterebbe la scrittura)', () => {
  const haUndefined = v => {
    if (v === undefined) return true;
    if (Array.isArray(v)) return v.some(haUndefined);
    if (v && typeof v === 'object') return Object.values(v).some(haUndefined);
    return false;
  };
  for (const livello of ['normale', 'bambini']) {
    const s = crea({ decisione: { livello } });
    assert.equal(haUndefined(s.pubblica), false);
    assert.equal(haUndefined(s.segretoPrimo), false);
    assert.equal(haUndefined(s.segretoUltimo), false);
  }
});

prova('un livello sconosciuto ripiega sul normale', () => {
  const p = crea({ decisione: { livello: 'strano' } }).pubblica;
  assert.equal(p.riquadri, 16);
});

// ================= senzaUndefined =================

prova('senzaUndefined toglie gli undefined ovunque, anche annidati e negli array', () => {
  const sporco = { a: 1, b: undefined, c: { d: undefined, e: [1, undefined, { f: undefined, g: 2 }] }, h: null, i: false, l: 0, m: '' };
  const pulito = senzaUndefined(sporco);
  assert.deepEqual(pulito.c.e, [1, undefined, { g: 2 }].map(x => x === undefined ? undefined : x));
  assert.equal('b' in pulito, false);
  assert.equal('d' in pulito.c, false);
  assert.equal(pulito.h, null);
  assert.equal(pulito.i, false);
  assert.equal(pulito.l, 0);
  assert.equal(pulito.m, '');
  assert.equal(JSON.stringify(sporco).includes('undefined'), false);
});

prova('senzaUndefined non modifica l\'originale', () => {
  const o = { a: undefined, b: { c: undefined } };
  senzaUndefined(o);
  assert.equal('a' in o, true);
  assert.equal('c' in o.b, true);
});

// ================= ruoli e scadenza =================

prova('ruoloDi: primo, ultimo, nessuno, dati rovinati', () => {
  const p = crea().pubblica;
  assert.equal(ruoloDi(p, 1), 'primo');
  assert.equal(ruoloDi(p, 0), 'ultimo');
  assert.equal(ruoloDi(p, 2), null);
  assert.equal(ruoloDi(null, 0), null);
  assert.equal(ruoloDi(undefined, 0), null);
  assert.equal(ruoloDi('x', 0), null);
});

prova('sessioneScaduta: valida fino alla scadenza massima (piu\' la grazia), poi no', () => {
  const p = crea().pubblica;
  assert.equal(sessioneScaduta(p, p.scadenzaMassima - 1), false);
  assert.equal(sessioneScaduta(p, p.scadenzaMassima + 4999), false);
  assert.equal(sessioneScaduta(p, p.scadenzaMassima + 5001), true);
  assert.equal(sessioneScaduta(null, 0), true);
  assert.equal(sessioneScaduta({}, 0), true);
  assert.equal(sessioneScaduta({ scadenzaMassima: 'boh' }, 0), true);
});

// ================= leggere i telefoni =================

prova('eProntoDi: array, oggetto con chiavi numeriche, vuoto', () => {
  assert.equal(eProntoDi({ pronto: [true, true] }, 0), true);
  assert.equal(eProntoDi({ pronto: [undefined, true] }, 1), true);
  assert.equal(eProntoDi({ pronto: [undefined, true] }, 0), false);
  assert.equal(eProntoDi({ pronto: { 3: true } }, 3), true);
  assert.equal(eProntoDi({ pronto: { 3: true } }, 2), false);
  assert.equal(eProntoDi({ pronto: { 3: false } }, 3), false);
  assert.equal(eProntoDi({ pronto: { 3: 'si' } }, 3), false);
  assert.equal(eProntoDi({ pronto: { 3: 1 } }, 3), false);
  assert.equal(eProntoDi({}, 0), false);
  assert.equal(eProntoDi(null, 0), false);
  assert.equal(eProntoDi(undefined, 0), false);
  assert.equal(eProntoDi({ pronto: null }, 0), false);
});

prova('consegnaNumero: array, oggetto con chiavi sparse, mancante', () => {
  const a = { ordine: ['x'] };
  assert.deepEqual(consegnaNumero({ consegne: [a] }, 0), a);
  assert.equal(consegnaNumero({ consegne: [a] }, 1), null);
  assert.deepEqual(consegnaNumero({ consegne: { 1: a } }, 1), a);
  assert.equal(consegnaNumero({ consegne: { 1: a } }, 0), null);
  assert.equal(consegnaNumero({}, 0), null);
  assert.equal(consegnaNumero(null, 0), null);
  assert.equal(consegnaNumero({ consegne: null }, 0), null);
  assert.equal(consegnaNumero({ consegne: [null, a] }, 0), null);
});

prova('sbirciataFatta: solo true vale', () => {
  assert.equal(sbirciataFatta({ sbirciata: true }), true);
  assert.equal(sbirciataFatta({ sbirciata: false }), false);
  assert.equal(sbirciataFatta({ sbirciata: 'true' }), false);
  assert.equal(sbirciataFatta({}), false);
  assert.equal(sbirciataFatta(null), false);
});

prova('comeElenco: legge array e oggetti "pieni", rifiuta quelli con buchi o strani', () => {
  assert.deepEqual(comeElenco(['a', 'b']), ['a', 'b']);
  assert.deepEqual(comeElenco({ 0: 'a', 1: 'b', 2: 'c' }), ['a', 'b', 'c'], 'forma a oggetto');
  assert.deepEqual(comeElenco({ 2: 'c', 0: 'a', 1: 'b' }), ['a', 'b', 'c'], 'chiavi in disordine');
  assert.equal(comeElenco({ 1: 'b', 2: 'c' }), null, 'manca lo 0');
  assert.equal(comeElenco({ 0: 'a', 2: 'c' }), null, 'buco in mezzo');
  assert.equal(comeElenco({ a: 1 }), null, 'chiavi che non sono numeri');
  assert.deepEqual(comeElenco({}), [], 'oggetto vuoto = elenco vuoto');
  for (const strano of [null, undefined, 5, 'abc', true]) assert.equal(comeElenco(strano), null, String(strano));
});

prova('valutaConsegna: giusta, sbagliata, non valida', () => {
  const sol = ['a', 'b', 'c', 'd'];
  assert.equal(valutaConsegna({ ordine: ['a', 'b', 'c', 'd'] }, sol), 'giusta');
  assert.equal(valutaConsegna({ ordine: ['b', 'a', 'c', 'd'] }, sol), 'sbagliata');
  assert.equal(valutaConsegna({ ordine: { 0: 'a', 1: 'b', 2: 'c', 3: 'd' } }, sol), 'giusta', 'forma a oggetto');
  assert.equal(valutaConsegna({ ordine: { 0: 'b', 1: 'a', 2: 'c', 3: 'd' } }, sol), 'sbagliata');
});

prova('valutaConsegna: ordine con chiavi numeriche in disordine viene rimesso in fila', () => {
  const sol = ['a', 'b', 'c', 'd'];
  // chiavi 0..3 date in disordine: la lettura le ordina per numero
  assert.equal(valutaConsegna({ ordine: { 3: 'd', 1: 'b', 0: 'a', 2: 'c' } }, sol), 'giusta');
});

prova('valutaConsegna: dati rovinati sono sempre "non-valida", mai un errore', () => {
  const sol = ['a', 'b', 'c', 'd'];
  const rovinati = [
    null, undefined, 5, 'ciao', [], {}, { ordine: null }, { ordine: 'abcd' }, { ordine: 7 },
    { ordine: [] }, { ordine: ['a', 'b', 'c'] }, { ordine: ['a', 'b', 'c', 'd', 'e'] },
    { ordine: ['a', 'a', 'c', 'd'] }, { ordine: ['a', 'b', 'c', 'x'] },
    { ordine: [1, 2, 3, 4] }, { ordine: [null, null, null, null] }, { ordine: [['a'], 'b', 'c', 'd'] },
    { ordine: { 0: 'a', 1: 'b' } }, { ordine: { a: 'a', b: 'b', c: 'c', d: 'd' } }
  ];
  for (const c of rovinati) {
    assert.doesNotThrow(() => valutaConsegna(c, sol));
    assert.equal(valutaConsegna(c, sol), 'non-valida', JSON.stringify(c));
  }
});

prova('valutaConsegna con soluzione vuota o rovinata non lancia', () => {
  assert.doesNotThrow(() => valutaConsegna({ ordine: ['a'] }, null));
  assert.equal(valutaConsegna({ ordine: ['a'] }, null), 'non-valida');
  assert.equal(valutaConsegna({ ordine: [] }, []), 'giusta');
});

prova('le costanti dei margini sono quelle decise', () => {
  assert.equal(GRAZIA_CONSEGNA_FINALE_MS, 4000);
  assert.equal(DURATA_ANNULLAMENTO_MS, 4000);
  assert.equal(MARGINE_ANIMAZIONE_MS, 8000);
  assert.equal(MARGINE_SICUREZZA_MS, 30000);
});

// ================= i testi =================

prova('titolo e versetto sono scritti ESATTAMENTE come li ha voluti Francesco', () => {
  assert.equal(TITOLO, 'COLLABORIAMO!');
  assert.equal(VERSETTO, "Salmo 133:1 - Ecco, com'è buono e com'è piacevole che i fratelli vivano insieme in unità!");
});

prova('caselle(): singolare e plurale', () => {
  assert.equal(caselle(1), '1 casella');
  assert.equal(caselle(10), '10 caselle');
  assert.equal(caselle(-10), '10 caselle');
  assert.equal(caselle(0), '0 caselle');
  assert.equal(caselle(undefined), '0 caselle');
  assert.equal(caselle('boh'), '0 caselle');
});

prova('secondi(): arrotonda e fa il singolare', () => {
  assert.equal(secondi(15000), '15 secondi');
  assert.equal(secondi(1000), '1 secondo');
  assert.equal(secondi(10400), '10 secondi');
  assert.equal(secondi(-5), '0 secondi');
  assert.equal(secondi(undefined), '0 secondi');
});

function nessunaPartePiena(oggetto, percorso = '') {
  if (typeof oggetto === 'string') {
    assert.equal(/\b(undefined|NaN|null)\b/.test(oggetto) || oggetto.includes('[object') || oggetto.includes('${'), false,
      `${percorso}: contiene un valore non scritto: ${oggetto}`);
    assert.ok(oggetto.trim().length > 0, `${percorso}: testo vuoto`);
  } else if (oggetto && typeof oggetto === 'object') {
    for (const [k, v] of Object.entries(oggetto)) nessunaPartePiena(v, percorso + '.' + k);
  }
}

const P = {
  primo: 'Marco', ultimo: 'Anna', riquadri: 16, anteprimaMs: 15000, provaMs: 90000, sbirciataMs: 10000,
  tentativiMax: 2, bonus: 10, malus: 10, ultimoSalta: true, spostamento: 10,
  primoPronto: true, ultimoPronto: false
};

prova('i testi del tabellone non hanno buchi (nessun "undefined", "NaN", vuoti)', () => {
  nessunaPartePiena(tabellone.annuncio(P), 'annuncio');
  nessunaPartePiena(tabellone.annuncio({ ...P, ultimoSalta: false }), 'annuncio senza salto');
  nessunaPartePiena(tabellone.statoPronti(P), 'statoPronti');
  nessunaPartePiena(tabellone.anteprima(P), 'anteprima');
  nessunaPartePiena(tabellone.prova(P), 'prova');
  nessunaPartePiena(tabellone.tentativo(0, 2), 'tentativo');
  nessunaPartePiena(tabellone.successo(P), 'successo');
  nessunaPartePiena(tabellone.successo({ ...P, spostamento: 0 }), 'successo senza spostamento');
  nessunaPartePiena(tabellone.fallimento(P), 'fallimento');
  nessunaPartePiena(tabellone.fallimento({ ...P, spostamento: 0, ultimoSalta: false }), 'fallimento minimo');
  nessunaPartePiena(tabellone.annullato(), 'annullato');
});

prova('i testi dei telefoni non hanno buchi', () => {
  for (const ruolo of ['primo', 'ultimo']) {
    const t = telefono[ruolo];
    nessunaPartePiena(t.pronti(P), ruolo + '.pronti');
    nessunaPartePiena(t.anteprima(P), ruolo + '.anteprima');
    const prova_ = t.prova(P);
    for (const [k, v] of Object.entries(prova_)) {
      if (typeof v === 'function') nessunaPartePiena(k === 'tentativo' ? v(0, 2) : (k === 'sbagliato' ? v(1) : v(12)), `${ruolo}.prova.${k}()`);
      else nessunaPartePiena(v, `${ruolo}.prova.${k}`);
    }
    for (const esito of ['successo', 'fallimento', 'annullato']) {
      nessunaPartePiena(t.esito({ ...P, esito }), `${ruolo}.esito.${esito}`);
      nessunaPartePiena(t.esito({ ...P, esito, spostamento: 0, ultimoSalta: false }), `${ruolo}.esito.${esito}.minimo`);
    }
  }
});

prova('i testi nominano le persone giuste', () => {
  const a = tabellone.annuncio(P);
  assert.ok(a.righe.join(' ').includes('Anna') && a.righe.join(' ').includes('Marco'));
  assert.ok(tabellone.successo(P).testo.includes('Anna'));
  assert.ok(tabellone.fallimento(P).testo.includes('Marco'));
  assert.ok(tabellone.fallimento(P).testo.includes('Anna'), 'dice che l\'ultimo salta il turno');
  assert.equal(tabellone.fallimento({ ...P, ultimoSalta: false }).testo.includes('salta il turno'), false);
});

prova('il tono non incolpa il primo (nessuna parola di colpa)', () => {
  const tutti = JSON.stringify([
    tabellone.annuncio(P), tabellone.fallimento(P), telefono.primo.esito({ ...P, esito: 'fallimento' }),
    telefono.ultimo.esito({ ...P, esito: 'fallimento' }), tabellone.annullato()
  ]).toLowerCase();
  for (const parola of ['colpa', 'sbagliato tu', 'hai sbagliato', 'perdente', 'fallito', 'scarso', 'peggio']) {
    assert.equal(tutti.includes(parola), false, 'parola di colpa: ' + parola);
  }
});

// ================= i disegni =================

prova('ci sono 22 disegni, tutti con id diverso e nome', () => {
  assert.equal(ID_DISEGNI.length, 22);
  assert.equal(new Set(ID_DISEGNI).size, 22);
  for (const id of ID_DISEGNI) {
    assert.match(id, /^[a-z]+$/, 'id con caratteri strani: ' + id);
    assert.ok(DISEGNI[id].nome.length > 0);
    assert.equal(nomeDisegno(id), DISEGNI[id].nome);
  }
});

prova('servono almeno 16 disegni per il livello normale', () => {
  assert.ok(ID_DISEGNI.length >= CONFIG.salmo.livelli.normale.riquadri);
});

prova('ogni disegno e\' un SVG 100x100 con il proprio sfondo e senza nulla di pericoloso', () => {
  const sfondi = new Set();
  for (const id of ID_DISEGNI) {
    const s = DISEGNI[id].svg;
    assert.ok(s.startsWith('<svg '), id);
    assert.ok(s.endsWith('</svg>'), id);
    assert.ok(s.includes('viewBox="0 0 100 100"'), id);
    assert.ok(/<rect width="100" height="100" fill="#[0-9a-fA-F]{3,8}"\/>/.test(s), id + ': manca lo sfondo');
    assert.equal(/<script|<foreignObject|<image|href=|\son[a-z]+=|javascript:|<style|url\(|<use|<iframe/i.test(s), false, id + ': contenuto non ammesso');
    assert.equal((s.match(/<svg/g) || []).length, 1, id + ': piu\' svg annidati');
    sfondi.add(s.match(/fill="(#[0-9a-fA-F]+)"/)[1]);
  }
  assert.ok(sfondi.size >= 8, 'sfondi troppo simili tra loro: ' + sfondi.size);
});

prova('i disegni sono tutti diversi tra loro', () => {
  const tutti = ID_DISEGNI.map(id => DISEGNI[id].svg);
  assert.equal(new Set(tutti).size, tutti.length);
});

prova('tag e virgolette bilanciati in ogni disegno', () => {
  for (const id of ID_DISEGNI) {
    const s = DISEGNI[id].svg;
    assert.equal((s.match(/"/g) || []).length % 2, 0, id + ': virgolette dispari');
    const aperti = (s.match(/<(?!\/|\?|!)[a-zA-Z]+[^>]*[^/]>/g) || []).filter(t => !/\/>$/.test(t)).length;
    const chiusi = (s.match(/<\/[a-zA-Z]+>/g) || []).length;
    assert.equal(aperti, chiusi, `${id}: tag aperti ${aperti} chiusi ${chiusi}`);
    assert.equal(/NaN|undefined|null/.test(s), false, id + ': numeri non validi');
  }
});

prova('svgDisegno: id sconosciuto -> riquadro grigio di ripiego, mai un errore', () => {
  for (const strano of ['boh', '', null, undefined, 5, '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    const s = svgDisegno(strano);
    assert.ok(typeof s === 'string' && s.startsWith('<svg '), String(strano));
    assert.equal(s.includes('#cfcfcf'), true, 'ripiego atteso per ' + String(strano));
    assert.equal(nomeDisegno(strano), '');
  }
  assert.equal(svgDisegno('colomba'), DISEGNI.colomba.svg);
});

// ================= esito =================

console.log(`\nSalmo 133:1 — dati e testi: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
