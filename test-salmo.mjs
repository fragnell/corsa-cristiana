// test-salmo.mjs
// Prove della logica pura del Salmo 133:1 (regola.js, mosaico.js, esito.js e la
// sezione "salmo" della configurazione). Si lancia con:  node test-salmo.mjs
// Non servono browser ne' Firebase: sono solo numeri in ingresso e numeri in uscita.

import assert from 'node:assert/strict';
import { CONFIG, unisciConfig } from './js/config.js';
import { creaStatoIniziale } from './js/stato.js';
import {
  configSalmoSicura, giocatoriAttivi, trovaPrimo, distaccoRichiesto, livelloPerCoppia,
  leggiContatori, contatoriDopoTurno, contatoriDopoAvvio, valutaSalmo
} from './js/salmo/regola.js';
import {
  dimensioniGriglia, scegliDisegni, mescola, scambia, ordineCorretto, ordineValido,
  creaProva, generatoreConSeme, stessoOrdine
} from './js/salmo/mosaico.js';
import { applicaEsitoSalmo } from './js/salmo/esito.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.message).split('\n').join('\n        ')}`); }
}

const CFG = configSalmoSicura(CONFIG.salmo);
const ULTIMA = 63;

// Crea uno stato con n giocatori, posizioni date, di chi e' il turno e i contatori.
function stato(posizioni, turnoDi, salmo, extra = {}) {
  const s = creaStatoIniziale(posizioni.map((_, i) => ({ nome: 'G' + i, colore: 'rosso' })));
  posizioni.forEach((p, i) => { s.giocatori[i].posizione = p; });
  s.turnoDi = turnoDi;
  if (salmo) s.salmo = salmo;
  Object.assign(s, extra);
  return s;
}

// ================= la configurazione =================

prova('config: la sezione salmo esiste e ha i valori decisi', () => {
  assert.equal(CONFIG.salmo.giocatoriMinimi, 3);
  // 3-4 giocatori: 16 caselle; 5-6: 18; da 7 a 12: 20
  assert.deepEqual(CONFIG.salmo.distacchi, { finoA4: 16, finoA6: 18, finoA8: 20, finoA10: 20, finoA12: 20 });
  assert.equal(CONFIG.salmo.primoMassimo, 50);
  assert.equal(CONFIG.salmo.giriDiPausa, 2);
  assert.equal(CONFIG.salmo.maxPerPartita, 2);
  assert.equal(CONFIG.salmo.bonusUltimo, 10);
  assert.equal(CONFIG.salmo.malusPrimo, -10);
  assert.equal(CONFIG.salmo.tentativi, 2);
  assert.equal(CONFIG.salmo.prontoMs, 60000);
  assert.equal(CONFIG.salmo.sbirciataMs, 10000);
  assert.deepEqual(CONFIG.salmo.livelli.bambini, { riquadri: 4, provaMs: 75000, anteprimaMs: 10000 });
  assert.deepEqual(CONFIG.salmo.livelli.normale, { riquadri: 16, provaMs: 90000, anteprimaMs: 15000 });
});

prova('config: unisciConfig senza personalizzazioni lascia il salmo com\'e\'', () => {
  assert.deepEqual(unisciConfig(CONFIG, {}).salmo, CONFIG.salmo);
});

prova('config: unisciConfig con una personalizzazione parziale unisce anche le sottosezioni', () => {
  const m = unisciConfig(CONFIG, { salmo: { bonusUltimo: 7, distacchi: { finoA4: 12 }, livelli: { normale: { riquadri: 9 } } } });
  assert.equal(m.salmo.bonusUltimo, 7);
  assert.equal(m.salmo.distacchi.finoA4, 12);
  assert.equal(m.salmo.distacchi.finoA6, 18);               // le altre righe restano
  assert.equal(m.salmo.livelli.normale.riquadri, 9);
  assert.equal(m.salmo.livelli.normale.provaMs, 90000);     // il resto del livello resta
  assert.deepEqual(m.salmo.livelli.bambini, CONFIG.salmo.livelli.bambini);
  assert.equal(m.salmo.malusPrimo, -10);
});

prova('config: le altre sezioni di unisciConfig non sono cambiate', () => {
  const m = unisciConfig(CONFIG, { conoscenza: { bonusRispostaCorretta: 5 } });
  assert.equal(m.conoscenza.bonusRispostaCorretta, 5);
  assert.deepEqual(m.dado, CONFIG.dado);
  assert.deepEqual(m.timeout, CONFIG.timeout);
  assert.deepEqual(m.giocatori, CONFIG.giocatori);
});

prova('config: unisciConfig con una base senza salmo non si rompe', () => {
  const { salmo, ...senza } = CONFIG;
  assert.equal(unisciConfig(senza, {}).salmo, undefined);
});

prova('configSalmoSicura: valori strani tornano ai valori di base', () => {
  const s = configSalmoSicura({
    attivo: 'si', giocatoriMinimi: 'abc', distacchi: { finoA4: -3, finoA6: null, finoA8: '30', finoA10: undefined },
    primoMassimo: 0, giriDiPausa: -1, maxPerPartita: 'x', bonusUltimo: NaN, malusPrimo: 10, tentativi: 0,
    prontoMs: 'boh', livelli: { bambini: { riquadri: 0 }, normale: null }
  });
  assert.equal(s.attivo, CONFIG.salmo.attivo);
  assert.equal(s.giocatoriMinimi, 3);
  assert.equal(s.distacchi.finoA4, 16);
  assert.equal(s.distacchi.finoA6, 18);
  assert.equal(s.distacchi.finoA8, 30);            // "30" e' un numero valido
  assert.equal(s.distacchi.finoA10, 20);
  assert.equal(s.primoMassimo, 50);
  assert.equal(s.giriDiPausa, 0);                  // meno di zero diventa zero
  assert.equal(s.maxPerPartita, 2);
  assert.equal(s.bonusUltimo, 10);
  assert.equal(s.malusPrimo, -10);                 // un malus positivo diventa negativo
  assert.equal(s.tentativi, 2);
  assert.equal(s.prontoMs, 60000);
  assert.equal(s.livelli.bambini.riquadri, 4);
  assert.deepEqual(s.livelli.normale, CONFIG.salmo.livelli.normale);
});

prova('configSalmoSicura: l\'interruttore "attivo" si rispetta se e\' vero o falso, altrimenti torna alla base', () => {
  assert.equal(configSalmoSicura({ attivo: false }).attivo, false);
  assert.equal(configSalmoSicura({ attivo: true }).attivo, true);
  assert.equal(configSalmoSicura({ attivo: 'false' }).attivo, CONFIG.salmo.attivo);
  assert.equal(configSalmoSicura({ attivo: 0 }).attivo, CONFIG.salmo.attivo);
  assert.equal(configSalmoSicura({ attivo: null }).attivo, CONFIG.salmo.attivo);
  // e una configurazione spenta passata dalla "sicura" spegne davvero la regola
  const spenta = configSalmoSicura({ attivo: false });
  assert.deepEqual(valutaSalmo(stato([40, 30, 22, 18, 25, 12], 5, { avviati: 0, turni: 50 }), spenta), { scatta: false, motivo: 'spento' });
});

prova('configSalmoSicura: ogni numero fuori misura torna al valore di base (zero, negativi, testo)', () => {
  for (const campo of ['giocatoriMinimi', 'primoMassimo', 'tentativi', 'prontoMs', 'sbirciataMs', 'esitoMs']) {
    for (const strano of [0, -5, 'ciao', null, NaN, Infinity]) {
      assert.equal(configSalmoSicura({ [campo]: strano })[campo], CONFIG.salmo[campo], `${campo} = ${String(strano)}`);
    }
  }
  for (const campo of ['riquadri', 'provaMs', 'anteprimaMs']) {
    for (const strano of [0, -5, 'ciao', null, NaN]) {
      assert.equal(configSalmoSicura({ livelli: { normale: { [campo]: strano } } }).livelli.normale[campo], CONFIG.salmo.livelli.normale[campo]);
      assert.equal(configSalmoSicura({ livelli: { bambini: { [campo]: strano } } }).livelli.bambini[campo], CONFIG.salmo.livelli.bambini[campo]);
    }
  }
});

prova('configSalmoSicura: senza niente restituisce la base', () => {
  assert.deepEqual(configSalmoSicura(undefined), CFG);
  assert.deepEqual(configSalmoSicura(null), CFG);
  assert.deepEqual(configSalmoSicura({}), CFG);
});

// ================= la regola di attivazione =================

// base: 6 giocatori, primo G0 a 40, ultimo G5 a 12 (distacco 28 >= 18), tocca a G5.
const BASE_POS = [40, 30, 22, 18, 25, 12];
const BASE = () => stato(BASE_POS, 5, { avviati: 0, turni: 50 });

prova('regola: la situazione di base scatta, con primo, ultimo e livello', () => {
  const v = valutaSalmo(BASE(), CFG);
  assert.equal(v.scatta, true);
  assert.equal(v.primo, 0);
  assert.equal(v.ultimo, 5);
  assert.equal(v.distacco, 28);
  assert.equal(v.livello, 'normale');
});

const casi = [
  ['non e\' il turno dell\'ultimo -> no', () => ({ ...BASE(), turnoDi: 3 }), 'non-ultimo'],
  ['distacco 17 (serve 18) -> no', () => stato([29, 28, 22, 18, 25, 12], 5, { avviati: 0, turni: 50 }), 'poco-distacco'],
  ['distacco esattamente 18 -> si', () => stato([30, 28, 22, 18, 25, 12], 5, { avviati: 0, turni: 50 }), null],
  ['gia\' due prove -> no', () => stato(BASE_POS, 5, { avviati: 2, turni: 90, ultimoAvvio: 10 }), 'massimo-raggiunto'],
  ['una prova fatta, pausa finita (12 passaggi su 12) -> si', () => stato(BASE_POS, 5, { avviati: 1, turni: 50, ultimoAvvio: 38 }), null],
  ['una prova fatta, pausa non finita (11 su 12) -> no', () => stato(BASE_POS, 5, { avviati: 1, turni: 50, ultimoAvvio: 39 }), 'pausa'],
  ['solo 2 giocatori -> no', () => stato([40, 12], 1, { avviati: 0, turni: 50 }), 'pochi-giocatori'],
  ['primo sulla 51 -> no', () => stato([51, 30, 22, 18, 25, 12], 5, { avviati: 0, turni: 50 }), 'primo-troppo-avanti'],
  ['primo sulla 50 -> si', () => stato([50, 30, 22, 18, 25, 12], 5, { avviati: 0, turni: 50 }), null],
  ['partita finita -> no', () => ({ ...BASE(), vincitore: 0 }), 'partita-finita'],
  ['a pari merito ultimi, di turno uno dei due -> si', () => stato([40, 30, 12, 18, 25, 12], 2, { avviati: 0, turni: 50 }), null],
  ['a pari merito ultimi, di turno l\'altro -> si', () => stato([40, 30, 12, 18, 25, 12], 5, { avviati: 0, turni: 50 }), null],
  ['primo a pari merito: vince l\'ordine dei giocatori', () => stato([40, 40, 22, 18, 25, 12], 5, { avviati: 0, turni: 50 }), null]
];
for (const [nome, costruisci, motivoAtteso] of casi) {
  prova(`regola: ${nome}`, () => {
    const v = valutaSalmo(costruisci(), CFG);
    if (motivoAtteso === null) assert.equal(v.scatta, true, `doveva scattare, invece: ${v.motivo}`);
    else { assert.equal(v.scatta, false); assert.equal(v.motivo, motivoAtteso); }
  });
}

prova('regola: a pari merito per il primo, il primo e\' il giocatore con l\'indice piu\' basso', () => {
  const v = valutaSalmo(stato([40, 40, 22, 18, 25, 12], 5, { avviati: 0, turni: 50 }), CFG);
  assert.equal(v.primo, 0);
  const w = valutaSalmo(stato([22, 40, 40, 18, 25, 12], 5, { avviati: 0, turni: 50 }), CFG);
  assert.equal(w.primo, 1);
});

prova('regola: senza contatori (partita mai toccata dal Salmo) funziona', () => {
  const s = stato(BASE_POS, 5);
  assert.equal(s.salmo, undefined);
  assert.equal(valutaSalmo(s, CFG).scatta, true);
});

prova('regola: spenta da configurazione -> mai', () => {
  const v = valutaSalmo(BASE(), { ...CFG, attivo: false });
  assert.deepEqual(v, { scatta: false, motivo: 'spento' });
  assert.equal(valutaSalmo(BASE(), undefined).scatta, false);
});

prova('regola: i giocatori che hanno abbandonato non contano', () => {
  // 4 giocatori, G1 e G2 hanno abbandonato: restano 2 -> mai.
  const s = stato([40, 30, 22, 12], 3, { avviati: 0, turni: 50 });
  s.giocatori[1].abbandonato = true; s.giocatori[2].abbandonato = true;
  assert.equal(valutaSalmo(s, CFG).motivo, 'pochi-giocatori');
  // 5 giocatori, uno solo ha abbandonato: ne restano 4, distacco richiesto 16 (non i 18 di 5 giocatori).
  const t = stato([29, 28, 22, 18, 12], 4, { avviati: 0, turni: 50 });
  t.giocatori[1].abbandonato = true;
  assert.equal(distaccoRichiesto(giocatoriAttivi(t).length, CFG), 16);
  assert.equal(valutaSalmo(t, CFG).scatta, true);               // 29 - 12 = 17 >= 16 (ma < 18)
  // l'ultimo "vero" e' tra gli attivi: un abbandonato piu' indietro non conta
  const u = stato([40, 30, 5, 18, 12], 4, { avviati: 0, turni: 50 });
  u.giocatori[2].abbandonato = true;
  const v = valutaSalmo(u, CFG);
  assert.equal(v.scatta, true);
  assert.equal(v.ultimo, 4);
  assert.equal(v.distacco, 28);
});

prova('regola: un primo che ha abbandonato non conta come primo', () => {
  const s = stato([60, 28, 22, 18, 25, 12], 5, { avviati: 0, turni: 50 });
  s.giocatori[0].abbandonato = true;
  // senza G0 il primo e' G1 a 28: distacco 16 < 18 (restano 5 giocatori) -> no
  assert.equal(valutaSalmo(s, CFG).motivo, 'poco-distacco');
});

prova('regola: giocatore di turno abbandonato -> mai', () => {
  const s = stato(BASE_POS, 5, { avviati: 0, turni: 50 });
  s.giocatori[5].abbandonato = true;
  assert.equal(valutaSalmo(s, CFG).scatta, false);
});

prova('regola: se uno dei due e\' disconnesso la prova non parte', () => {
  const s = BASE();
  assert.equal(valutaSalmo(s, CFG, { presenti: () => true }).scatta, true);
  assert.equal(valutaSalmo(s, CFG, { presenti: id => id !== 0 }).motivo, 'non-presenti');   // il primo
  assert.equal(valutaSalmo(s, CFG, { presenti: id => id !== 5 }).motivo, 'non-presenti');   // l'ultimo
  assert.equal(valutaSalmo(s, CFG, { presenti: id => id === 3 }).motivo, 'non-presenti');
  // un terzo disconnesso non c'entra
  assert.equal(valutaSalmo(s, CFG, { presenti: id => id !== 2 }).scatta, true);
});

prova('regola: junior -> livello bambini se almeno uno dei due e\' junior', () => {
  const s = BASE();
  assert.equal(valutaSalmo(s, CFG).livello, 'normale');
  s.giocatori[0].junior = true;
  assert.equal(valutaSalmo(s, CFG).livello, 'bambini');
  s.giocatori[0].junior = false; s.giocatori[5].junior = true;
  assert.equal(valutaSalmo(s, CFG).livello, 'bambini');
  s.giocatori[5].junior = false; s.giocatori[2].junior = true;   // un terzo junior non conta
  assert.equal(valutaSalmo(s, CFG).livello, 'normale');
  assert.equal(livelloPerCoppia({ junior: true }, {}), 'bambini');
  assert.equal(livelloPerCoppia({}, {}), 'normale');
});

prova('regola: la tabella dei distacchi, giocatore per giocatore, al limite esatto', () => {
  const attesi = { 3: 16, 4: 16, 5: 18, 6: 18, 7: 20, 8: 20, 9: 20, 10: 20, 11: 20, 12: 20 };
  for (const [n, D] of Object.entries(attesi)) {
    const N = Number(n);
    assert.equal(distaccoRichiesto(N, CFG), D, `tabella per ${N} giocatori`);
    // il primo a 49, l'ultimo a 49 - D (scatta); a 49 - D + 1 (non scatta)
    const pos = Array(N).fill(40);
    pos[0] = 49; pos[N - 1] = 49 - D;
    const si = valutaSalmo(stato(pos, N - 1, { avviati: 0, turni: 100 }), CFG);
    assert.equal(si.scatta, true, `${N} giocatori, distacco ${D}: doveva scattare (${si.motivo})`);
    pos[N - 1] = 49 - D + 1;
    const no = valutaSalmo(stato(pos, N - 1, { avviati: 0, turni: 100 }), CFG);
    assert.equal(no.scatta, false, `${N} giocatori, distacco ${D - 1}: non doveva scattare`);
    assert.equal(no.motivo, 'poco-distacco');
  }
});

prova('regola: ogni fascia di giocatori usa la sua riga (provato con numeri tutti diversi)', () => {
  // Nei valori di base 7-12 giocatori hanno tutti 20: qui si usano numeri diversi per essere sicuri
  // che ogni numero di giocatori peschi dalla riga giusta (modificabile dall'Admin).
  const diversa = configSalmoSicura({ distacchi: { finoA4: 11, finoA6: 12, finoA8: 13, finoA10: 14, finoA12: 15 } });
  const attesi = { 2: 11, 3: 11, 4: 11, 5: 12, 6: 12, 7: 13, 8: 13, 9: 14, 10: 14, 11: 15, 12: 15 };
  for (const [n, D] of Object.entries(attesi)) {
    assert.equal(distaccoRichiesto(Number(n), diversa), D, `${n} giocatori`);
  }
});

prova('regola: la pausa si misura in giri completi del tavolo (2 x giocatori attivi)', () => {
  for (const N of [3, 5, 8, 12]) {
    const pos = Array(N).fill(40); pos[0] = 49; pos[N - 1] = 10;
    const pausa = 2 * N;
    const ok = valutaSalmo(stato(pos, N - 1, { avviati: 1, turni: 100, ultimoAvvio: 100 - pausa }), CFG);
    const ko = valutaSalmo(stato(pos, N - 1, { avviati: 1, turni: 100, ultimoAvvio: 100 - pausa + 1 }), CFG);
    assert.equal(ok.scatta, true, `${N} giocatori: dopo ${pausa} passaggi puo' ripartire`);
    assert.equal(ko.motivo, 'pausa', `${N} giocatori: dopo ${pausa - 1} passaggi no`);
  }
});

prova('regola: la pausa conta solo i giocatori ancora in partita', () => {
  // 6 giocatori, 2 hanno abbandonato: restano 4 attivi -> la pausa e' 2 x 4 = 8 passaggi (non 12)
  const pos = [49, 40, 40, 40, 40, 10];
  const costruisci = ultimoAvvio => {
    const s = stato(pos, 5, { avviati: 1, turni: 100, ultimoAvvio });
    s.giocatori[1].abbandonato = true; s.giocatori[2].abbandonato = true;
    return s;
  };
  assert.equal(valutaSalmo(costruisci(100 - 8), CFG).scatta, true);
  assert.equal(valutaSalmo(costruisci(100 - 7), CFG).motivo, 'pausa');
});

prova('regola: a inizio partita (tutti sulla stessa casella) non scatta, col motivo giusto', () => {
  // tocca al giocatore 0, che e' anche il "primo" per l'ordine dei giocatori: stessa persona
  const a = valutaSalmo(stato([1, 1, 1, 1], 0, { avviati: 0, turni: 0 }), CFG);
  assert.equal(a.scatta, false);
  assert.equal(a.motivo, 'stesso-giocatore');
  // tocca a un altro: primo e ultimo sono diversi ma il distacco e' zero
  const b = valutaSalmo(stato([1, 1, 1, 1], 2, { avviati: 0, turni: 0 }), CFG);
  assert.equal(b.scatta, false);
  assert.equal(b.motivo, 'poco-distacco');
});

prova('regola: i contatori', () => {
  assert.deepEqual(leggiContatori({}), { avviati: 0, turni: 0, ultimoAvvio: null });
  assert.deepEqual(leggiContatori({ salmo: { avviati: 1, turni: 7, ultimoAvvio: 3 } }), { avviati: 1, turni: 7, ultimoAvvio: 3 });
  assert.deepEqual(leggiContatori({ salmo: { avviati: 'x', turni: -4 } }), { avviati: 0, turni: 0, ultimoAvvio: null });
  assert.deepEqual(contatoriDopoTurno({}), { avviati: 0, turni: 1 });
  assert.deepEqual(contatoriDopoTurno({ salmo: { avviati: 1, turni: 7, ultimoAvvio: 3 } }), { avviati: 1, turni: 8, ultimoAvvio: 3 });
  assert.deepEqual(contatoriDopoAvvio({ salmo: { avviati: 0, turni: 9 } }), { avviati: 1, turni: 9, ultimoAvvio: 9 });
  // nessun valore "undefined" o "null" che Firebase rifiuterebbe o cancellerebbe: le chiavi o ci sono o non ci sono
  for (const c of [contatoriDopoTurno({}), contatoriDopoAvvio({}), contatoriDopoTurno({ salmo: { avviati: 1, turni: 2, ultimoAvvio: 1 } })]) {
    for (const v of Object.values(c)) assert.ok(Number.isFinite(v));
  }
});

prova('regola: partita intera simulata a mano: massimo 2 prove, mai ravvicinate', () => {
  // Il distacco resta sempre grande: la regola da sola deve limitare a 2 prove e con la pausa.
  const N = 4;
  const s = stato([45, 30, 25, 10], 3, { avviati: 0, turni: 0 });
  const avvii = [];
  for (let passaggio = 1; passaggio <= 60; passaggio++) {
    s.salmo = contatoriDopoTurno(s);
    const v = valutaSalmo(s, CFG);
    if (v.scatta) { s.salmo = contatoriDopoAvvio(s); avvii.push(s.salmo.turni); }
  }
  assert.equal(avvii.length, 2);
  assert.equal(avvii[0], 1);
  assert.equal(avvii[1] - avvii[0], 2 * N);
});

prova('regola: dopo la pausa torna solo se il distacco c\'e\' di nuovo, e mai piu\' di 2 volte', () => {
  // Con ogni numero di giocatori: il primo e' a 49, l'ultimo (tocca a lui) e' l'ultimo della lista.
  for (const N of [3, 4, 5, 6, 7, 8, 10, 12]) {
    const D = distaccoRichiesto(N, CFG);
    const pos = Array(N).fill(45); pos[0] = 49; pos[N - 1] = 49 - D;
    const s = stato(pos, N - 1, { avviati: 0, turni: 0 });
    const ultimoA = casella => { s.giocatori[N - 1].posizione = casella; };
    const passa = () => { s.salmo = contatoriDopoTurno(s); return valutaSalmo(s, CFG); };
    const parte = v => { assert.equal(v.scatta, true, `${N} giocatori: doveva scattare (${v.motivo})`); s.salmo = contatoriDopoAvvio(s); };

    // 1) col distacco richiesto scatta subito (prima volta)
    parte(passa());
    const t0 = s.salmo.turni;

    // 2) per 2 giri interi non puo' tornare, nemmeno con un distacco enorme
    ultimoA(2);
    for (let i = 1; i < 2 * N; i++) {
      assert.equal(passa().motivo, 'pausa', `${N} giocatori: al passaggio ${i} dopo la prova c'e' ancora pausa`);
    }

    // 3) finiti i 2 giri, se il distacco e' sceso di una casella sotto il richiesto, non scatta...
    ultimoA(49 - D + 1);
    const troppoPoco = passa();
    assert.equal(troppoPoco.scatta, false);
    assert.equal(troppoPoco.motivo, 'poco-distacco', `${N} giocatori: pausa finita ma il distacco non basta`);

    // 4) ...e appena il distacco c'e' di nuovo, scatta (seconda e ultima volta)
    ultimoA(49 - D);
    parte(passa());
    assert.equal(s.salmo.avviati, 2);
    assert.equal(s.salmo.turni - t0, 2 * N + 1);

    // 5) la terza volta non arriva mai, anche dopo molti giri e con un distacco enorme
    ultimoA(1);
    for (let i = 0; i < 10 * N; i++) assert.equal(passa().motivo, 'massimo-raggiunto');
  }
});

prova('regola: stessa situazione, stessa risposta (nessun caso)', () => {
  const a = JSON.stringify(valutaSalmo(BASE(), CFG));
  for (let i = 0; i < 200; i++) assert.equal(JSON.stringify(valutaSalmo(BASE(), CFG)), a);
});

prova('regola: la funzione non modifica lo stato che riceve', () => {
  const s = BASE();
  const prima = JSON.stringify(s);
  valutaSalmo(s, CFG, { presenti: () => true });
  assert.equal(JSON.stringify(s), prima);
});

prova('regola: su 20000 situazioni casuali non si rompe e rispetta sempre le condizioni', () => {
  const rng = generatoreConSeme(1234);
  let scattate = 0;
  for (let i = 0; i < 20000; i++) {
    const N = 1 + Math.floor(rng() * 12);
    const pos = Array.from({ length: N }, () => 1 + Math.floor(rng() * 62));
    const s = stato(pos, Math.floor(rng() * N), { avviati: Math.floor(rng() * 3), turni: Math.floor(rng() * 120), ...(rng() < 0.5 ? { ultimoAvvio: Math.floor(rng() * 100) } : {}) });
    s.giocatori.forEach(g => { if (rng() < 0.15) g.abbandonato = true; if (rng() < 0.2) g.junior = true; });
    if (rng() < 0.02) s.vincitore = 0;
    const v = valutaSalmo(s, CFG);
    if (!v.scatta) { assert.ok(typeof v.motivo === 'string' && v.motivo.length > 0); continue; }
    scattate++;
    const att = giocatoriAttivi(s);
    const max = Math.max(...att.map(g => g.posizione)), min = Math.min(...att.map(g => g.posizione));
    assert.ok(att.length >= 3);
    assert.equal(s.vincitore, null);                              // a partita finita non scatta mai
    assert.equal(s.giocatori[v.ultimo].posizione, min);
    assert.equal(s.giocatori[v.primo].posizione, max);
    assert.ok(v.ultimo === s.turnoDi);
    assert.ok(v.distacco >= distaccoRichiesto(att.length, CFG));
    assert.ok(max <= 50);
    assert.ok(leggiContatori(s).avviati < 2);
    assert.ok(!s.giocatori[v.primo].abbandonato && !s.giocatori[v.ultimo].abbandonato);
  }
  assert.ok(scattate > 0, 'nessuna situazione casuale ha fatto scattare la regola: il test non prova niente');
});

// ================= il mosaico =================

prova('mosaico: righe e colonne', () => {
  assert.deepEqual(dimensioniGriglia(4), { righe: 2, colonne: 2 });
  assert.deepEqual(dimensioniGriglia(9), { righe: 3, colonne: 3 });
  assert.deepEqual(dimensioniGriglia(16), { righe: 4, colonne: 4 });
  assert.deepEqual(dimensioniGriglia(6), { righe: 2, colonne: 3 });
  assert.deepEqual(dimensioniGriglia(8), { righe: 2, colonne: 4 });
  assert.deepEqual(dimensioniGriglia(12), { righe: 3, colonne: 4 });
  // numeri "scomodi" (primi): niente strisce lunghe e sottili, una griglia quasi quadrata con l'ultima riga incompleta
  assert.deepEqual(dimensioniGriglia(1), { righe: 1, colonne: 1 });
  assert.deepEqual(dimensioniGriglia(2), { righe: 1, colonne: 2 });
  assert.deepEqual(dimensioniGriglia(3), { righe: 2, colonne: 2 });
  assert.deepEqual(dimensioniGriglia(5), { righe: 2, colonne: 3 });
  assert.deepEqual(dimensioniGriglia(7), { righe: 3, colonne: 3 });
  assert.deepEqual(dimensioniGriglia(11), { righe: 3, colonne: 4 });
  assert.deepEqual(dimensioniGriglia(13), { righe: 4, colonne: 4 });
  for (let n = 1; n <= 20; n++) {
    const { righe, colonne } = dimensioniGriglia(n);
    assert.ok(righe * colonne >= n, `${n} riquadri entrano in ${righe}x${colonne}`);
    assert.ok(righe * colonne < n + colonne, `${n} riquadri: niente righe vuote`);
  }
});

const POOL = ['colomba', 'pane', 'pesce', 'lampada', 'agnello', 'stella', 'arca', 'arcobaleno', 'uva', 'grano', 'sole', 'luna', 'nuvola', 'albero', 'montagna', 'ancora', 'chiave', 'rotolo', 'brocca', 'tenda', 'melograno', 'bastone'];

prova('mosaico: scegliDisegni da\' n disegni diversi, tutti del mazzo', () => {
  const rng = generatoreConSeme(5);
  for (const n of [1, 4, 9, 16, 22]) {
    const d = scegliDisegni(POOL, n, rng);
    assert.equal(d.length, n);
    assert.equal(new Set(d).size, n);
    assert.ok(d.every(x => POOL.includes(x)));
  }
});

prova('mosaico: scegliDisegni ignora i doppioni nell\'elenco dei disegni disponibili', () => {
  const rng = generatoreConSeme(3);
  for (let i = 0; i < 300; i++) {
    const d = scegliDisegni(['a', 'a', 'b', 'b', 'c', 'd'], 3, rng);
    assert.equal(new Set(d).size, 3, `scelta con doppioni: ${d.join(',')}`);
  }
});

prova('mosaico: il rimescolamento non e\' sbilanciato (ogni riquadro puo\' anche restare al suo posto)', () => {
  const rng = generatoreConSeme(21);
  const id = ['a', 'b', 'c', 'd', 'e', 'f'];
  const giri = 6000;
  let sceltoPrimo = 0, mescolatoPrimo = 0;
  for (let i = 0; i < giri; i++) {
    if (scegliDisegni(id, 6, rng)[0] === 'a') sceltoPrimo++;
    if (mescola(id, rng)[0] === 'a') mescolatoPrimo++;
  }
  // in ogni posto ogni riquadro esce con probabilita' ~1/6 (in "mescola" un soffio meno: l'ordine giusto e' escluso)
  const atteso = giri / 6;
  assert.ok(Math.abs(sceltoPrimo - atteso) < atteso * 0.1, `scegliDisegni: 'a' al primo posto ${sceltoPrimo} volte su ${giri}`);
  assert.ok(Math.abs(mescolatoPrimo - atteso) < atteso * 0.1, `mescola: 'a' al primo posto ${mescolatoPrimo} volte su ${giri}`);
});

prova('mosaico: servono abbastanza disegni, altrimenti errore chiaro', () => {
  assert.throws(() => scegliDisegni(['a', 'b', 'c'], 4), /Servono 4 disegni diversi/);
  assert.throws(() => scegliDisegni(['a', 'a', 'b', 'b'], 3), /Servono 3 disegni diversi/);
  assert.throws(() => scegliDisegni(POOL, 0), /non valido/);
  assert.throws(() => scegliDisegni(POOL, 2.5), /non valido/);
});

prova('mosaico: la scelta dei disegni e\' ripetibile col seme e abbastanza uniforme', () => {
  assert.deepEqual(scegliDisegni(POOL, 16, generatoreConSeme(77)), scegliDisegni(POOL, 16, generatoreConSeme(77)));
  assert.notDeepEqual(scegliDisegni(POOL, 16, generatoreConSeme(77)), scegliDisegni(POOL, 16, generatoreConSeme(78)));
  const rng = generatoreConSeme(9);
  const conta = Object.fromEntries(POOL.map(p => [p, 0]));
  const giri = 6000;
  for (let i = 0; i < giri; i++) scegliDisegni(POOL, 16, rng).forEach(d => { conta[d]++; });
  const atteso = giri * 16 / POOL.length;
  for (const [id, c] of Object.entries(conta)) assert.ok(Math.abs(c - atteso) < atteso * 0.06, `${id} uscito ${c} volte su ${giri}, atteso ~${Math.round(atteso)}`);
});

prova('mosaico: mescola non restituisce mai l\'ordine gia\' giusto ed e\' una permutazione', () => {
  const rng = generatoreConSeme(42);
  for (const n of [2, 3, 4, 9, 16]) {
    const soluzione = POOL.slice(0, n);
    for (let i = 0; i < 4000; i++) {
      const m = mescola(soluzione, rng);
      assert.ok(!stessoOrdine(m, soluzione), `n=${n}: uscito l'ordine giusto`);
      assert.deepEqual([...m].sort(), [...soluzione].sort());
    }
  }
});

prova('mosaico: mescola con un generatore "bloccato" non si impianta e resta diverso', () => {
  for (const fisso of [0, 0.5, 0.999999]) {
    const soluzione = POOL.slice(0, 9);
    const m = mescola(soluzione, () => fisso);
    assert.ok(!stessoOrdine(m, soluzione));
    assert.deepEqual([...m].sort(), [...soluzione].sort());
  }
  assert.deepEqual(mescola(['solo']), ['solo']);
  assert.deepEqual(mescola([]), []);
});

prova('mosaico: mescola non cambia l\'ordine originale che riceve', () => {
  const o = POOL.slice(0, 8);
  const copia = [...o];
  mescola(o, generatoreConSeme(3));
  assert.deepEqual(o, copia);
});

prova('mosaico: mescola e\' abbastanza uniforme (scambi medi necessari = n - H(n))', () => {
  // Per rimettere in ordine n riquadri servono, in media, n - (1 + 1/2 + ... + 1/n) scambi.
  // Se la mescolata fosse sbilanciata, questa media si sposterebbe.
  const rng = generatoreConSeme(2024);
  const scambiNecessari = (ordine, soluzione) => {
    const pos = new Map(soluzione.map((id, i) => [id, i]));
    const perm = ordine.map(id => pos.get(id));
    const visto = Array(perm.length).fill(false);
    let cicli = 0;
    for (let i = 0; i < perm.length; i++) {
      if (!visto[i]) { cicli++; for (let j = i; !visto[j]; j = perm[j]) visto[j] = true; }
    }
    return perm.length - cicli;
  };
  const armonico = n => Array.from({ length: n }, (_, i) => 1 / (i + 1)).reduce((a, b) => a + b, 0);
  for (const n of [4, 9, 16]) {
    const soluzione = POOL.slice(0, n);
    let somma = 0; const giri = 20000;
    for (let i = 0; i < giri; i++) somma += scambiNecessari(mescola(soluzione, rng), soluzione);
    const media = somma / giri;
    // la regola "mai gia' risolto" toglie un caso su n!, trascurabile ma non nullo per n piccolo
    const atteso = n - armonico(n);
    assert.ok(Math.abs(media - atteso) < 0.12, `n=${n}: media ${media.toFixed(2)}, attesa ${atteso.toFixed(2)}`);
  }
});

prova('mosaico: scambia cambia solo due posti e non tocca l\'originale', () => {
  const o = ['a', 'b', 'c', 'd'];
  assert.deepEqual(scambia(o, 0, 3), ['d', 'b', 'c', 'a']);
  assert.deepEqual(o, ['a', 'b', 'c', 'd']);
  assert.deepEqual(scambia(o, 2, 2), o);
  assert.deepEqual(scambia(scambia(o, 1, 2), 1, 2), o);
  assert.throws(() => scambia(o, -1, 2), /non valido/);
  assert.throws(() => scambia(o, 0, 4), /non valido/);
  assert.throws(() => scambia(o, 0.5, 1), /non valido/);
  assert.throws(() => scambia(o, 'a', 1), /non valido/);
});

prova('mosaico: ordineCorretto e ordineValido', () => {
  const sol = ['a', 'b', 'c'];
  assert.equal(ordineCorretto(['a', 'b', 'c'], sol), true);
  assert.equal(ordineCorretto(['a', 'c', 'b'], sol), false);
  assert.equal(ordineCorretto(['a', 'b'], sol), false);
  assert.equal(ordineCorretto(null, sol), false);
  assert.equal(ordineCorretto('abc', sol), false);
  assert.equal(ordineValido(['c', 'a', 'b'], sol), true);
  assert.equal(ordineValido(['a', 'a', 'b'], sol), false);        // duplicato
  assert.equal(ordineValido(['a', 'b', 'z'], sol), false);        // riquadro inventato
  assert.equal(ordineValido(['a', 'b'], sol), false);             // manca uno
  assert.equal(ordineValido(['a', 'b', 'c', 'a'], sol), false);   // uno in piu'
  assert.equal(ordineValido(undefined, sol), false);
  assert.equal(ordineValido({ 0: 'a', 1: 'b', 2: 'c' }, sol), false);
});

prova('mosaico: creaProva per i due livelli', () => {
  for (const livello of [CFG.livelli.bambini, CFG.livelli.normale]) {
    const p = creaProva(livello, POOL, generatoreConSeme(11));
    assert.equal(p.tessere.length, livello.riquadri);
    assert.equal(p.mescolata.length, livello.riquadri);
    assert.equal(p.righe * p.colonne, livello.riquadri);
    assert.ok(!ordineCorretto(p.mescolata, p.tessere));
    assert.ok(ordineValido(p.mescolata, p.tessere));
  }
});

// ================= l'esito =================

const PERC = ULTIMA;
const COPPIA = { primoId: 0, ultimoId: 5 };

prova('esito: successo -> l\'ultimo avanza di 10, il turno passa al prossimo', () => {
  const s = BASE();
  const r = applicaEsitoSalmo(s, { ...COPPIA, esito: 'successo' }, CFG, PERC);
  assert.equal(r.stato.giocatori[5].posizione, 22);
  assert.equal(r.stato.giocatori[0].posizione, 40);
  assert.deepEqual(r.spostamenti, [{ id: 5, da: 12, a: 22 }]);
  assert.equal(r.turnoPassato, true);
  assert.equal(r.stato.turnoDi, 0);                      // dopo G5 tocca a G0
  assert.equal(s.giocatori[5].posizione, 12);            // l'originale non e' cambiato
  assert.equal(s.turnoDi, 5);
});

prova('esito: successo con "l\'ultimo tira comunque" -> il turno resta all\'ultimo', () => {
  const r = applicaEsitoSalmo(BASE(), { ...COPPIA, esito: 'successo' }, { ...CFG, ultimoTiraDopoSuccesso: true }, PERC);
  assert.equal(r.stato.turnoDi, 5);
  assert.equal(r.turnoPassato, false);
  assert.equal(r.stato.giocatori[5].posizione, 22);
});

prova('esito: fallimento -> il primo arretra di 10, l\'ultimo resta fermo e il turno passa', () => {
  const r = applicaEsitoSalmo(BASE(), { ...COPPIA, esito: 'fallimento' }, CFG, PERC);
  assert.equal(r.stato.giocatori[0].posizione, 30);
  assert.equal(r.stato.giocatori[5].posizione, 12);
  assert.deepEqual(r.spostamenti, [{ id: 0, da: 40, a: 30 }]);
  assert.equal(r.turnoPassato, true);
  assert.equal(r.stato.turnoDi, 0);
});

prova('esito: fallimento senza "l\'ultimo salta" -> il turno resta all\'ultimo', () => {
  const r = applicaEsitoSalmo(BASE(), { ...COPPIA, esito: 'fallimento' }, { ...CFG, ultimoSaltaSeFallisce: false }, PERC);
  assert.equal(r.stato.turnoDi, 5);
  assert.equal(r.turnoPassato, false);
  assert.equal(r.stato.giocatori[0].posizione, 30);
});

prova('esito: annullato -> non cambia niente e l\'ultimo tira normalmente', () => {
  const s = BASE();
  const r = applicaEsitoSalmo(s, { ...COPPIA, esito: 'annullato' }, CFG, PERC);
  assert.deepEqual(r.stato, s);
  assert.deepEqual(r.spostamenti, []);
  assert.equal(r.turnoPassato, false);
  assert.equal(r.stato.turnoDi, 5);
});

prova('esito esito sconosciuto -> come annullato', () => {
  const s = BASE();
  assert.deepEqual(applicaEsitoSalmo(s, { ...COPPIA, esito: 'boh' }, CFG, PERC).stato, s);
  assert.deepEqual(applicaEsitoSalmo(s, { ...COPPIA, esito: undefined }, CFG, PERC).stato, s);
});

prova('esito: l\'ultimo non supera mai il primo (al massimo pari)', () => {
  const s = stato([20, 18, 15, 10], 3, { avviati: 0, turni: 9 });   // distacco 10: con +10 arriva a 20 = pari
  const r = applicaEsitoSalmo(s, { primoId: 0, ultimoId: 3, esito: 'successo' }, CFG, PERC);
  assert.equal(r.stato.giocatori[3].posizione, 20);
  const t = stato([14, 18, 15, 10], 3, {});                           // il "primo" qui e' a 14: tetto 14
  const r2 = applicaEsitoSalmo(t, { primoId: 0, ultimoId: 3, esito: 'successo' }, CFG, PERC);
  assert.equal(r2.stato.giocatori[3].posizione, 14);
});

prova('esito: difesa extra — con uno stato anomalo (un "primo" gia\' sull\'ultima casella) l\'ultimo si ferma comunque prima', () => {
  const s = stato([63, 1, 55], 2, {});
  const r = applicaEsitoSalmo(s, { primoId: 0, ultimoId: 2, esito: 'successo' }, CFG, PERC);
  assert.equal(r.stato.giocatori[2].posizione, 62);
});

prova('esito: se per errore primo e ultimo risultano invertiti, nessuno viene spostato nel verso sbagliato', () => {
  const s = stato([20, 40, 30], 2, {});
  const a = applicaEsitoSalmo(s, { primoId: 0, ultimoId: 1, esito: 'successo' }, CFG, PERC);
  assert.equal(a.stato.giocatori[1].posizione, 40);        // l'"ultimo" (a 40) non torna indietro verso il "primo" (a 20)
  assert.equal(a.stato.giocatori[0].posizione, 20);
  const b = applicaEsitoSalmo(s, { primoId: 0, ultimoId: 1, esito: 'fallimento' }, CFG, PERC);
  assert.equal(b.stato.giocatori[0].posizione, 20);        // il "primo" (a 20) non sale fino all'"ultimo" (a 40)
  assert.equal(b.stato.giocatori[1].posizione, 40);
});

prova('esito: nessuno vince mai per colpa della prova, nemmeno con bonus enormi', () => {
  const s = stato([62, 40, 30, 1], 3, {});
  const r = applicaEsitoSalmo(s, { primoId: 0, ultimoId: 3, esito: 'successo' }, { ...CFG, bonusUltimo: 1000 }, PERC);
  assert.equal(r.stato.vincitore, null);
  assert.equal(r.stato.giocatori[3].posizione, 62);
  const t = stato([62, 62, 30, 61], 3, {});
  const r2 = applicaEsitoSalmo(t, { primoId: 0, ultimoId: 3, esito: 'successo' }, { ...CFG, bonusUltimo: 5 }, PERC);
  assert.ok(r2.stato.giocatori[3].posizione <= 62);
  assert.equal(r2.stato.vincitore, null);
});

prova('esito: il primo non scende mai sotto l\'ultimo ne\' sotto la casella 1', () => {
  const s = stato([14, 12, 10, 8], 3, {});                  // il primo a 14, l'ultimo a 8: -10 lo porterebbe a 4
  const r = applicaEsitoSalmo(s, { primoId: 0, ultimoId: 3, esito: 'fallimento' }, CFG, PERC);
  assert.equal(r.stato.giocatori[0].posizione, 8);          // si ferma sull'ultimo, a pari
  const t = stato([6, 4, 2, 1], 3, {});
  const r2 = applicaEsitoSalmo(t, { primoId: 0, ultimoId: 3, esito: 'fallimento' }, { ...CFG, malusPrimo: -50 }, PERC);
  assert.equal(r2.stato.giocatori[0].posizione, 1);
  assert.equal(r2.stato.giocatori[3].posizione, 1);
});

prova('esito: un malus positivo in configurazione non fa avanzare il primo', () => {
  const sicura = configSalmoSicura({ ...CONFIG.salmo, malusPrimo: 10 });
  assert.equal(sicura.malusPrimo, -10);
  const r = applicaEsitoSalmo(BASE(), { ...COPPIA, esito: 'fallimento' }, sicura, PERC);
  assert.equal(r.stato.giocatori[0].posizione, 30);
});

prova('esito: chi ha abbandonato nel frattempo -> nessun effetto', () => {
  const s = BASE(); s.giocatori[0].abbandonato = true;
  const r = applicaEsitoSalmo(s, { ...COPPIA, esito: 'fallimento' }, CFG, PERC);
  assert.deepEqual(r.stato, s);
  assert.equal(r.turnoPassato, false);
  const t = BASE(); t.giocatori[5].abbandonato = true;
  assert.deepEqual(applicaEsitoSalmo(t, { ...COPPIA, esito: 'successo' }, CFG, PERC).stato, t);
  assert.deepEqual(applicaEsitoSalmo(BASE(), { primoId: 9, ultimoId: 5, esito: 'successo' }, CFG, PERC).stato, BASE());
});

prova('esito: a partita finita non cambia niente', () => {
  const s = { ...BASE(), vincitore: 2 };
  assert.deepEqual(applicaEsitoSalmo(s, { ...COPPIA, esito: 'successo' }, CFG, PERC).stato, s);
});

prova('esito: il turno salta chi e\' abbandonato e chi e\' fermo', () => {
  const s = BASE(); s.giocatori[0].abbandonato = true; s.giocatori[1].saltaProssimoTurno = true;
  // (il primo qui e' G0 ma e' abbandonato: usiamo G1 come primo, che e' fermo un turno)
  const r = applicaEsitoSalmo(s, { primoId: 1, ultimoId: 5, esito: 'successo' }, CFG, PERC);
  assert.equal(r.stato.turnoDi, 2);                          // G0 abbandonato, G1 fermo -> tocca a G2
  assert.equal(r.stato.giocatori[1].saltaProssimoTurno, false);
});

prova('esito: su 20000 casi casuali valgono sempre le regole fisse', () => {
  const rng = generatoreConSeme(777);
  for (let i = 0; i < 20000; i++) {
    const N = 3 + Math.floor(rng() * 10);
    const pos = Array.from({ length: N }, () => 1 + Math.floor(rng() * 62));
    const s = stato(pos, Math.floor(rng() * N), {});
    const att = giocatoriAttivi(s);
    const primo = trovaPrimo(att);
    const ultimo = att.reduce((m, g) => (g.posizione < m.posizione ? g : m), att[0]);
    if (primo.id === ultimo.id) continue;
    const cfg = { ...CFG, bonusUltimo: Math.floor(rng() * 60), malusPrimo: -Math.floor(rng() * 60) };
    for (const esito of ['successo', 'fallimento', 'annullato']) {
      const prima = JSON.stringify(s);
      const r = applicaEsitoSalmo(s, { primoId: primo.id, ultimoId: ultimo.id, esito }, cfg, PERC);
      assert.equal(JSON.stringify(s), prima, 'ha modificato lo stato in ingresso');
      assert.equal(r.stato.vincitore, null);
      r.stato.giocatori.forEach(g => assert.ok(g.posizione >= 1 && g.posizione <= 62));
      assert.ok(r.stato.giocatori[ultimo.id].posizione <= r.stato.giocatori[primo.id].posizione);
      // chi non c'entra non si muove
      r.stato.giocatori.forEach((g, k) => { if (k !== primo.id && k !== ultimo.id) assert.equal(g.posizione, s.giocatori[k].posizione); });
      if (esito === 'successo') { assert.equal(r.stato.giocatori[primo.id].posizione, primo.posizione); assert.ok(r.stato.giocatori[ultimo.id].posizione >= ultimo.posizione); }
      if (esito === 'fallimento') { assert.equal(r.stato.giocatori[ultimo.id].posizione, ultimo.posizione); assert.ok(r.stato.giocatori[primo.id].posizione <= primo.posizione); }
      if (esito === 'annullato') assert.deepEqual(r.stato, s);
    }
  }
});

// ================= esito finale =================

console.log(`\nSalmo 133:1 — logica pura: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
