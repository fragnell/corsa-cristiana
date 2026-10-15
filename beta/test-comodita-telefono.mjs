// test-comodita-telefono.mjs
// Prove delle "comodita' del telefono" (js/comodita-telefono.js): lo schermo resta acceso per tutta la partita,
// e quando tocca a te (o devi rispondere) il telefono vibra e il riquadro dello stato lampeggia.
// Si lancia con:  node test-comodita-telefono.mjs
//
// Niente telefono vero: navigator, document e i riquadri della pagina sono FINTI.

import assert from 'node:assert/strict';
import { creaComoditaTelefono, cosaMiChiede, VIBRAZIONE_TOCCA_A_TE, VIBRAZIONE_DOMANDA, DURATA_LAMPEGGIO_MS } from './js/comodita-telefono.js';

let provati = 0;
const falliti = [];
async function prova(nome, fn) {
  provati++;
  try { await fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.stack || e.message).split('\n').slice(0, 5).join('\n        ')}`); }
}

const respira = async () => { for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); };

// ---------------------------------------------------------------------------------------------
// Un telefono finto: sa tenere lo schermo acceso e vibrare (si puo' togliere l'una o l'altra cosa)
// ---------------------------------------------------------------------------------------------
function creaRiquadro() {
  const classi = new Set();
  return {
    classList: {
      add(c) { classi.add(c); },
      remove(c) { classi.delete(c); },
      contains(c) { return classi.has(c); }
    },
    offsetWidth: 0
  };
}

function creaFinti({ conVibrazione = true, conBlocco = true, toccato = true, vibrazioneRifiutata = false, vibrazioneRompe = false } = {}) {
  const riquadro = creaRiquadro();                // lo stato ("Tocca a te!")
  const riquadroDomanda = creaRiquadro();         // il riquadro giallo della domanda
  const ascoltatori = new Set();
  const documento = {
    visibilityState: 'visible',
    getElementById(id) { return id === 'stato-turno' ? riquadro : (id === 'area-domanda-conoscenza' ? riquadroDomanda : null); },
    addEventListener(nome, f) { if (nome === 'visibilitychange') ascoltatori.add(f); },
    removeEventListener(nome, f) { ascoltatori.delete(f); }
  };
  const vibrazioni = [];
  const blocchi = [];
  const navigatore = {};
  if (conVibrazione) {
    navigatore.vibrate = (disegno) => {
      if (vibrazioneRompe) throw new Error('vibrate ha lanciato un errore');
      vibrazioni.push(disegno);
      return !vibrazioneRifiutata;
    };
  }
  navigatore.userActivation = { hasBeenActive: toccato };
  if (conBlocco) {
    navigatore.wakeLock = {
      request: async (tipo) => {
        const b = { tipo, released: false, addEventListener() {}, async release() { this.released = true; } };
        blocchi.push(b);
        return b;
      }
    };
  }
  return { navigatore, documento, riquadro, riquadroDomanda, vibrazioni, blocchi, attivi: () => blocchi.filter(b => !b.released).length };
}

// Uno stato di partita come lo pubblica il tabellone (quattro giocatori: 0, 1, 2, 3)
function stato(extra = {}) {
  return {
    giocatori: [
      { id: 0, nome: 'Anna', posizione: 3 },
      { id: 1, nome: 'Bruno', posizione: 5 },
      { id: 2, nome: 'Carla', posizione: 1 },
      { id: 3, nome: 'Dino', posizione: 0 }
    ],
    turnoDi: 0,
    turnoInCorso: false,
    vincitore: null,
    richiestaConoscenza: null,
    ...extra
  };
}

// ================= cosaMiChiede =================

await prova('cosaMiChiede: e\' il mio turno e il dado e\' pronto -> "dado"', () => {
  assert.equal(cosaMiChiede(stato({ turnoDi: 1 }), 1), 'dado');
});

await prova('cosaMiChiede: tocca a un altro -> niente', () => {
  assert.equal(cosaMiChiede(stato({ turnoDi: 0 }), 1), null);
});

await prova('cosaMiChiede: il mio turno e\' gia\' in corso (ho tirato) -> niente', () => {
  assert.equal(cosaMiChiede(stato({ turnoDi: 1, turnoInCorso: true }), 1), null);
});

await prova('cosaMiChiede: ho una prova in sospeso -> niente', () => {
  const s = stato({ turnoDi: 1 });
  s.giocatori[1].provaInSospeso = { testo: 'Canta' };
  assert.equal(cosaMiChiede(s, 1), null);
});

await prova('cosaMiChiede: devo rispondere a una domanda -> "domanda:<id>"', () => {
  const s = stato({ turnoDi: 1, turnoInCorso: true, richiestaConoscenza: { id: 'r7', giocatoreId: 1 } });
  assert.equal(cosaMiChiede(s, 1), 'domanda:r7');
});

await prova('cosaMiChiede: la domanda e\' di un altro -> niente per me', () => {
  const s = stato({ turnoDi: 0, turnoInCorso: true, richiestaConoscenza: { id: 'r7', giocatoreId: 0 } });
  assert.equal(cosaMiChiede(s, 1), null);
});

await prova('cosaMiChiede: partita finita -> niente, anche se toccherebbe a me', () => {
  assert.equal(cosaMiChiede(stato({ turnoDi: 1, vincitore: 2 }), 1), null);
  assert.equal(cosaMiChiede(stato({ turnoDi: 1, vincitore: 0 }), 1), null, 'il vincitore 0 (Anna) e\' un vincitore vero');
});

await prova('cosaMiChiede: durante COLLABORIAMO! niente avvisi sotto la sua schermata', () => {
  assert.equal(cosaMiChiede(stato({ turnoDi: 1, salmoInCorso: { id: 's1' } }), 1), null);
});

await prova('cosaMiChiede: giocatori come oggetto (Firebase) funziona lo stesso', () => {
  const s = stato({ turnoDi: 1 });
  s.giocatori = { 0: s.giocatori[0], 1: s.giocatori[1] };
  assert.equal(cosaMiChiede(s, 1), 'dado');
});

await prova('cosaMiChiede: stati strani non lanciano mai errori', () => {
  for (const s of [null, undefined, 5, 'x', [], {}, { giocatori: null }, { giocatori: [] }, { giocatori: [null] }, { giocatori: 'x' }, stato({ richiestaConoscenza: 7 })]) {
    for (const id of [0, 1, null, undefined, 'x', -1, 99]) {
      assert.doesNotThrow(() => cosaMiChiede(s, id));
    }
  }
  assert.equal(cosaMiChiede(null, 0), null);
  assert.equal(cosaMiChiede({ giocatori: [] }, 0), null);
});

// ================= avviso: una volta sola, quando CAMBIA =================

await prova('aggiorna: avvisa quando comincia il mio turno, con vibrazione e lampeggio', () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  const r1 = c.aggiorna(stato({ turnoDi: 0 }), 1);                         // tocca ad Anna: per Bruno niente
  assert.equal(r1.avviso, null);
  assert.equal(f.vibrazioni.length, 0);
  const r2 = c.aggiorna(stato({ turnoDi: 1 }), 1);                         // ora tocca a Bruno
  assert.equal(r2.avviso, 'dado');
  assert.equal(r2.vibrato, true);
  assert.deepEqual(f.vibrazioni, [VIBRAZIONE_TOCCA_A_TE]);
  assert.ok(f.riquadro.classList.contains('avviso-turno'), 'il riquadro dello stato lampeggia');
});

await prova('aggiorna: lo stesso stato ripetuto NON avvisa di nuovo', () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.aggiorna(stato({ turnoDi: 1 }), 1);
  for (let i = 0; i < 5; i++) {
    const r = c.aggiorna(stato({ turnoDi: 1, ultimoAggiornamento: i }), 1);
    assert.equal(r.avviso, null);
  }
  assert.equal(f.vibrazioni.length, 1, 'una sola vibrazione');
});

await prova('aggiorna: due turni di fila dello stesso giocatore avvisano due volte (in mezzo c\'e\' il turno in corso)', () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.aggiorna(stato({ turnoDi: 1 }), 1);
  c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true }), 1);               // ha tirato il dado
  const r = c.aggiorna(stato({ turnoDi: 1 }), 1);                          // di nuovo a lui
  assert.equal(r.avviso, 'dado');
  assert.equal(f.vibrazioni.length, 2);
});

await prova('aggiorna: la domanda avvisa con la sua vibrazione, una volta sola per domanda', () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.aggiorna(stato({ turnoDi: 1 }), 1);                                    // dado
  c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true }), 1);                // ha tirato
  const r = c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true, richiestaConoscenza: { id: 'r1', giocatoreId: 1 } }), 1);
  assert.equal(r.avviso, 'domanda');
  assert.deepEqual(f.vibrazioni[1], VIBRAZIONE_DOMANDA);
  const r2 = c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true, richiestaConoscenza: { id: 'r1', giocatoreId: 1 } }), 1);
  assert.equal(r2.avviso, null);
  // un'altra domanda, subito dopo
  c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true }), 1);
  const r3 = c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true, richiestaConoscenza: { id: 'r2', giocatoreId: 1 } }), 1);
  assert.equal(r3.avviso, 'domanda');
  assert.equal(f.vibrazioni.length, 3);
});

await prova('aggiorna: la domanda fa lampeggiare il riquadro della domanda, non quello dello stato (che in quel momento e\' vuoto)', () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.aggiorna(stato({ turnoDi: 1 }), 1);                                    // dado: lampeggia lo stato
  assert.ok(f.riquadro.classList.contains('avviso-turno'));
  assert.ok(!f.riquadroDomanda.classList.contains('avviso-turno'));
  c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true }), 1);                // ha tirato: si ferma
  assert.ok(!f.riquadro.classList.contains('avviso-turno'));
  c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true, richiestaConoscenza: { id: 'r1', giocatoreId: 1 } }), 1);
  assert.ok(f.riquadroDomanda.classList.contains('avviso-turno'), 'lampeggia il riquadro della domanda');
  assert.ok(!f.riquadro.classList.contains('avviso-turno'), 'lo stato non lampeggia');
  // risposta data: la domanda sparisce e il lampeggio si ferma
  c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true }), 1);
  assert.ok(!f.riquadroDomanda.classList.contains('avviso-turno'));
});

await prova('aggiorna: dal dado direttamente alla domanda, un solo riquadro lampeggia alla volta', () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.aggiorna(stato({ turnoDi: 1 }), 1);
  c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true, richiestaConoscenza: { id: 'r1', giocatoreId: 1 } }), 1);
  assert.ok(f.riquadroDomanda.classList.contains('avviso-turno'));
  assert.ok(!f.riquadro.classList.contains('avviso-turno'), 'lo stato ha smesso');
});

await prova('esciDallaPartita spegne anche il lampeggio della domanda', () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true, richiestaConoscenza: { id: 'r1', giocatoreId: 1 } }), 1);
  assert.ok(f.riquadroDomanda.classList.contains('avviso-turno'));
  c.esciDallaPartita();
  assert.ok(!f.riquadroDomanda.classList.contains('avviso-turno'));
});

await prova('il lampeggio della domanda si spegne da solo dopo qualche secondo', () => {
  const f = creaFinti();
  const vecchioSetTimeout = globalThis.setTimeout;
  const vecchioClearTimeout = globalThis.clearTimeout;
  const pianificati = [];
  globalThis.setTimeout = (fn, ms) => { pianificati.push({ fn, ms }); return pianificati.length; };
  globalThis.clearTimeout = () => {};
  try {
    const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
    c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true, richiestaConoscenza: { id: 'r1', giocatoreId: 1 } }), 1);
    assert.ok(f.riquadroDomanda.classList.contains('avviso-turno'));
    const timer = pianificati.find(p => p.ms === DURATA_LAMPEGGIO_MS);
    assert.ok(timer, 'e\' stato pianificato lo spegnimento');
    timer.fn();
    assert.ok(!f.riquadroDomanda.classList.contains('avviso-turno'));
  } finally {
    globalThis.setTimeout = vecchioSetTimeout;
    globalThis.clearTimeout = vecchioClearTimeout;
  }
});

await prova('la pagina non ha il riquadro (versione vecchia della pagina): la vibrazione c\'e\' lo stesso, nessun errore', () => {
  const f = creaFinti();
  const documentoSenzaRiquadri = { visibilityState: 'visible', getElementById: () => null, addEventListener() {}, removeEventListener() {} };
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: documentoSenzaRiquadri });
  let r;
  assert.doesNotThrow(() => { r = c.aggiorna(stato({ turnoDi: 1 }), 1); });
  assert.equal(r.avviso, 'dado');
  assert.equal(r.vibrato, true);
  assert.doesNotThrow(() => c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true, richiestaConoscenza: { id: 'r1', giocatoreId: 1 } }), 1));
  assert.doesNotThrow(() => c.esciDallaPartita());
});

await prova('aggiorna: se all\'ingresso e\' gia\' il mio turno, avvisa (e\' un cambiamento rispetto a "niente")', () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  assert.equal(c.aggiorna(stato({ turnoDi: 2 }), 2).avviso, 'dado');
});

await prova('aggiorna: partita finita -> niente avviso e il lampeggio si ferma', () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.aggiorna(stato({ turnoDi: 1 }), 1);
  assert.ok(f.riquadro.classList.contains('avviso-turno'));
  const r = c.aggiorna(stato({ turnoDi: 1, vincitore: 3 }), 1);
  assert.equal(r.avviso, null);
  assert.ok(!f.riquadro.classList.contains('avviso-turno'), 'il lampeggio e\' finito');
});

await prova('aggiorna: quando non tocca piu\' a me il lampeggio si ferma', () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.aggiorna(stato({ turnoDi: 1 }), 1);
  assert.ok(f.riquadro.classList.contains('avviso-turno'));
  c.aggiorna(stato({ turnoDi: 2 }), 1);
  assert.ok(!f.riquadro.classList.contains('avviso-turno'));
});

await prova('aggiorna: il lampeggio si spegne da solo dopo qualche secondo', async () => {
  const f = creaFinti();
  const vecchioSetTimeout = globalThis.setTimeout;
  const vecchioClearTimeout = globalThis.clearTimeout;
  const pianificati = [];
  globalThis.setTimeout = (fn, ms) => { pianificati.push({ fn, ms }); return pianificati.length; };
  globalThis.clearTimeout = () => {};
  try {
    const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
    c.aggiorna(stato({ turnoDi: 1 }), 1);
    assert.ok(f.riquadro.classList.contains('avviso-turno'));
    const timerLampeggio = pianificati.find(p => p.ms === DURATA_LAMPEGGIO_MS);
    assert.ok(timerLampeggio, 'e\' stato pianificato lo spegnimento');
    timerLampeggio.fn();
    assert.ok(!f.riquadro.classList.contains('avviso-turno'));
  } finally {
    globalThis.setTimeout = vecchioSetTimeout;
    globalThis.clearTimeout = vecchioClearTimeout;
  }
});

await prova('aggiorna: "alAvviso" personalizzato sostituisce il lampeggio di serie e riceve il tipo di avviso', () => {
  const f = creaFinti();
  const tipi = [];
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento, alAvviso: (tipo) => { tipi.push(tipo); } });
  c.aggiorna(stato({ turnoDi: 1 }), 1);
  c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true }), 1);
  c.aggiorna(stato({ turnoDi: 1, turnoInCorso: true, richiestaConoscenza: { id: 'r1', giocatoreId: 1 } }), 1);
  assert.deepEqual(tipi, ['dado', 'domanda']);
  assert.ok(!f.riquadro.classList.contains('avviso-turno'));
  assert.ok(!f.riquadroDomanda.classList.contains('avviso-turno'));
});

// ================= la vibrazione non c'e' o non e' permessa =================

await prova('iPhone (nessuna vibrazione): l\'avviso c\'e\' lo stesso, solo senza vibrare', () => {
  const f = creaFinti({ conVibrazione: false });
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  const r = c.aggiorna(stato({ turnoDi: 1 }), 1);
  assert.equal(r.avviso, 'dado');
  assert.equal(r.vibrato, false);
  assert.ok(f.riquadro.classList.contains('avviso-turno'));
});

await prova('pagina mai toccata: Chrome non permette di vibrare, quindi non ci si prova nemmeno', () => {
  const f = creaFinti({ toccato: false });
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  const r = c.aggiorna(stato({ turnoDi: 1 }), 1);
  assert.equal(r.vibrato, false);
  assert.equal(f.vibrazioni.length, 0);
  assert.equal(r.avviso, 'dado');
});

await prova('vibrazione rifiutata dal telefono (risparmio energetico...): nessun errore', () => {
  const f = creaFinti({ vibrazioneRifiutata: true });
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  const r = c.aggiorna(stato({ turnoDi: 1 }), 1);
  assert.equal(r.vibrato, false);
  assert.equal(r.avviso, 'dado');
});

await prova('vibrazione che lancia un errore: nessun errore verso chi chiama', () => {
  const f = creaFinti({ vibrazioneRompe: true });
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  assert.doesNotThrow(() => c.aggiorna(stato({ turnoDi: 1 }), 1));
});

await prova('senza navigator ne\' document (ambiente vuoto): tutto resta muto e senza errori', async () => {
  const c = creaComoditaTelefono({ navigator: null, document: null });
  assert.doesNotThrow(() => c.entraInPartita());
  assert.doesNotThrow(() => c.riprova());
  assert.doesNotThrow(() => c.aggiorna(stato({ turnoDi: 1 }), 1));
  assert.doesNotThrow(() => c.esciDallaPartita());
  await respira();
});

// ================= lo schermo acceso per tutta la partita =================

await prova('entraInPartita: chiede di tenere acceso lo schermo; esciDallaPartita lo rilascia', async () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.entraInPartita();
  await respira();
  assert.equal(f.blocchi.length, 1);
  assert.equal(f.attivi(), 1);
  assert.equal(f.blocchi[0].tipo, 'screen');
  c.esciDallaPartita();
  await respira();
  assert.equal(f.attivi(), 0);
});

await prova('entraInPartita ripetuto: un solo blocco', async () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.entraInPartita(); c.entraInPartita(); c.entraInPartita();
  await respira();
  assert.equal(f.blocchi.length, 1);
});

await prova('telefono senza la funzione: nessun errore, nessun blocco', async () => {
  const f = creaFinti({ conBlocco: false });
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  assert.doesNotThrow(() => c.entraInPartita());
  await respira();
  assert.equal(f.blocchi.length, 0);
  assert.equal(c.stato().schermo.voluto, true);
});

await prova('la partita finita (vincitore) NON rilascia da sola il blocco: lo fa esciDallaPartita()', async () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.entraInPartita();
  await respira();
  c.aggiorna(stato({ turnoDi: 1, vincitore: 0 }), 1);
  assert.equal(f.attivi(), 1, 'ci pensa chi chiama (giocatore-ui.js) con esciDallaPartita()');
  c.esciDallaPartita();
  await respira();
  assert.equal(f.attivi(), 0);
});

await prova('esciDallaPartita ripetuto e senza aver mai acceso: nessun errore', async () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  assert.doesNotThrow(() => { c.esciDallaPartita(); c.esciDallaPartita(); });
  await respira();
  assert.equal(f.blocchi.length, 0);
});

await prova('dopo esciDallaPartita un nuovo cambiamento avvisa di nuovo (si riparte da zero)', () => {
  const f = creaFinti();
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.aggiorna(stato({ turnoDi: 1 }), 1);
  c.esciDallaPartita();
  const r = c.aggiorna(stato({ turnoDi: 1 }), 1);
  assert.equal(r.avviso, 'dado');
});

await prova('riprova (un tocco della persona): se la prima richiesta era stata rifiutata, si chiede di nuovo', async () => {
  const f = creaFinti();
  let rifiuta = true;
  const richieste = [];
  f.navigatore.wakeLock = {
    request: async (tipo) => {
      richieste.push(tipo);
      if (rifiuta) throw new Error('rifiutato dal telefono');
      const b = { tipo, released: false, addEventListener() {}, async release() { this.released = true; } };
      f.blocchi.push(b);
      return b;
    }
  };
  const c = creaComoditaTelefono({ navigator: f.navigatore, document: f.documento });
  c.entraInPartita();
  await respira();
  assert.equal(richieste.length, 1);
  assert.equal(f.attivi(), 0, 'il telefono ha detto di no');
  rifiuta = false;
  c.riprova();
  await respira();
  assert.equal(richieste.length, 2, 'al tocco si chiede di nuovo');
  assert.equal(f.attivi(), 1);
  c.riprova(); c.riprova();
  await respira();
  assert.equal(richieste.length, 2, 'ora che c\'e\' non si richiede piu\'');
});

await prova('i disegni della vibrazione e la durata del lampeggio sono quelli promessi a chi gioca', () => {
  assert.deepEqual(VIBRAZIONE_TOCCA_A_TE, [200, 100, 200]);
  assert.deepEqual(VIBRAZIONE_DOMANDA, [350]);
  assert.equal(DURATA_LAMPEGGIO_MS, 3000, 'quanto dura l\'animazione nel CSS (4 volte 0,75 secondi)');
});

console.log(`\nComodita' del telefono: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
