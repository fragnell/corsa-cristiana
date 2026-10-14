// test-statistiche-attivita.mjs
// Prove del calcolo di "quanto si gioca" (scheda Statistiche dell'Admin): partite di oggi, degli ultimi
// 7 e 30 giorni, giorno per giorno. Il fuso orario e' quello italiano: i giorni sono giorni di calendario.
// Si lancia con:  node test-statistiche-attivita.mjs

process.env.TZ = 'Europe/Rome';

import assert from 'node:assert/strict';
import {
  GIORNI_GRAFICO, GIORNI_SETTIMANA, GIOCATORI_MINIMI_DI_GRUPPO,
  chiaveGiorno, giorniTra, contaGiocatori, leggiPartita, calcolaAttivita,
  plurale, formattaGiorno, etichettaAsse, formattaOra, descriviQuando
} from './js/statistiche-attivita.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.message).split('\n').join('\n        ')}`); }
}

// Le date si scrivono "come le leggerebbe Francesco": anno, mese (1-12), giorno, ora, minuti, secondi.
const quando = (a, m, g, h = 12, mi = 0, s = 0, ms = 0) => new Date(a, m - 1, g, h, mi, s, ms).getTime();
const ADESSO = quando(2026, 10, 14, 15, 49);     // mercoledi' 14 ottobre 2026, 15:49

const giocatori = n => Array.from({ length: n }, (_, i) => ({ id: i, nome: 'G' + i, colore: 'rosso', posizione: 0 }));
// Una partita come la salva il gioco. Opzioni: lancio (default 4), vincitore, mod, creataIl (default: nessuna), agg
function partita(n, { creataIl, lancio = 4, vincitore = null, mod, agg } = {}) {
  const stato = { giocatori: giocatori(n), turnoDi: 0, ultimoLancio: lancio, vincitore };
  if (mod) stato.modalita = mod;
  if (agg !== undefined) stato.ultimoAggiornamento = agg;
  const p = { lobby: giocatori(n), stato };
  if (creataIl !== undefined) p.creataIl = creataIl;
  return p;
}

// ================= il fuso orario del test =================

prova('il test gira con il fuso italiano (altrimenti i giorni sarebbero sbagliati)', () => {
  assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'Europe/Rome');
  assert.equal(new Date(2026, 9, 14).getTimezoneOffset(), -120);   // ora legale
  assert.equal(new Date(2026, 11, 14).getTimezoneOffset(), -60);   // ora solare
});

prova('le costanti sono quelle dichiarate (30 giorni di grafico, 7 di settimana, gruppo da 2)', () => {
  assert.equal(GIORNI_GRAFICO, 30);
  assert.equal(GIORNI_SETTIMANA, 7);
  assert.equal(GIOCATORI_MINIMI_DI_GRUPPO, 2);
});

// ================= i giorni =================

prova('chiaveGiorno: giorno di calendario locale, con gli zeri', () => {
  assert.equal(chiaveGiorno(new Date(2026, 0, 5, 23, 59, 59)), '2026-01-05');
  assert.equal(chiaveGiorno(new Date(2026, 9, 14, 0, 0, 0)), '2026-10-14');
  assert.equal(chiaveGiorno(new Date(2026, 11, 31, 23, 59, 59, 999)), '2026-12-31');
});

prova('chiaveGiorno: usa il giorno locale, non quello UTC (00:30 italiane sono ancora ieri in UTC)', () => {
  const d = new Date(2026, 9, 14, 0, 30);       // 13 ottobre alle 22:30 UTC
  assert.equal(d.getUTCDate(), 13);
  assert.equal(chiaveGiorno(d), '2026-10-14');
});

prova('giorniTra: giorni di calendario, anche a cavallo di mesi, anni e ora legale', () => {
  assert.equal(giorniTra('2026-10-14', '2026-10-14'), 0);
  assert.equal(giorniTra('2026-10-13', '2026-10-14'), 1);
  assert.equal(giorniTra('2026-10-14', '2026-10-13'), -1);
  assert.equal(giorniTra('2026-12-31', '2027-01-01'), 1);
  assert.equal(giorniTra('2026-09-30', '2026-10-01'), 1);
  assert.equal(giorniTra('2026-02-28', '2026-03-01'), 1);            // 2026 non e' bisestile
  assert.equal(giorniTra('2028-02-28', '2028-03-01'), 2);            // il 2028 si'
  assert.equal(giorniTra('2026-10-24', '2026-10-26'), 2);            // il 25 ottobre 2026 finisce l'ora legale (25 ore)
  assert.equal(giorniTra('2026-03-28', '2026-03-30'), 2);            // il 29 marzo 2026 inizia (23 ore)
  assert.equal(giorniTra('2026-01-01', '2027-01-01'), 365);
});

// ================= contaGiocatori =================

prova('contaGiocatori: elenco, elenco con buchi, oggetto con chiavi numeriche', () => {
  assert.equal(contaGiocatori(giocatori(3)), 3);
  assert.equal(contaGiocatori([{ id: 0 }, null, { id: 2 }]), 2);
  assert.equal(contaGiocatori({ 0: { id: 0 }, 2: { id: 2 } }), 2);          // Firebase con un giocatore tolto in mezzo
  assert.equal(contaGiocatori([]), 0);
});

prova('contaGiocatori: roba strana vale 0, mai un errore', () => {
  for (const v of [null, undefined, 5, 'tre', true, [1, 2, 3], ['a'], {}, { a: 1 }]) assert.equal(contaGiocatori(v), 0, JSON.stringify(v));
});

// ================= leggiPartita =================

prova('leggiPartita: senza stato (lobby aperta e mai giocata) non e\' una partita', () => {
  assert.equal(leggiPartita({ creataIl: ADESSO, lobby: giocatori(3) }), null);
  assert.equal(leggiPartita({ creataIl: ADESSO }), null);
  assert.equal(leggiPartita({ stato: null }), null);
});

prova('leggiPartita: roba che non e\' una partita vale null, senza errori', () => {
  for (const v of [null, undefined, 0, 5, 'x', true, [], { stato: 5 }, { stato: 'x' }, { stato: [] }]) assert.equal(leggiPartita(v), null, JSON.stringify(v));
});

prova('leggiPartita: con lo stato ma senza giocatori non conta', () => {
  assert.equal(leggiPartita({ creataIl: ADESSO, stato: { ultimoLancio: 3, vincitore: null } }), null);
  assert.equal(leggiPartita({ creataIl: ADESSO, stato: { giocatori: [], ultimoLancio: 3 } }), null);
});

prova('leggiPartita: iniziata ma non conclusa (almeno un lancio di dado)', () => {
  const p = leggiPartita(partita(3, { creataIl: ADESSO, lancio: 2 }));
  assert.deepEqual(p, { quando: ADESSO, giocatori: 3, conclusa: false, veloce: false });
});

prova('leggiPartita: "mai lanciato il dado" (ultimoLancio vuoto) non conta, anche se i giocatori ci sono', () => {
  assert.equal(leggiPartita(partita(3, { creataIl: ADESSO, lancio: null })), null);
  const senzaCampo = partita(3, { creataIl: ADESSO });
  delete senzaCampo.stato.ultimoLancio;                  // Firebase non salva i valori vuoti: il campo sparisce
  assert.equal(leggiPartita(senzaCampo), null);
});

prova('leggiPartita: il vincitore 0 (il primo giocatore) e\' un vincitore', () => {
  const p = leggiPartita(partita(2, { creataIl: ADESSO, vincitore: 0 }));
  assert.equal(p.conclusa, true);
});

prova('leggiPartita: vincitore non valido (null, "0", 1.5, true) = non conclusa', () => {
  for (const v of [null, undefined, '0', 1.5, true, NaN]) {
    assert.equal(leggiPartita(partita(2, { creataIl: ADESSO, vincitore: v })).conclusa, false, String(v));
  }
});

prova('leggiPartita: una partita con il vincitore conta come iniziata anche se manca il dado', () => {
  const p = partita(2, { creataIl: ADESSO, vincitore: 1 });
  delete p.stato.ultimoLancio;
  assert.equal(leggiPartita(p).conclusa, true);
});

prova('leggiPartita: la data e\' "creataIl"; se manca o non e\' un numero buono, l\'ultimo aggiornamento; poi niente', () => {
  const ieri = quando(2026, 10, 13, 20);
  assert.equal(leggiPartita(partita(2, { creataIl: ADESSO, agg: ieri })).quando, ADESSO);
  assert.equal(leggiPartita(partita(2, { agg: ieri })).quando, ieri);
  for (const cattiva of ['ieri', NaN, 0, -5, null, Infinity, {}]) {
    const p = partita(2, { agg: ieri });
    p.creataIl = cattiva;
    assert.equal(leggiPartita(p).quando, ieri, 'creataIl = ' + String(cattiva));
  }
  assert.equal(leggiPartita(partita(2, {})).quando, null);
  const senza = partita(2, { agg: 'boh' });
  assert.equal(leggiPartita(senza).quando, null);
});

prova('leggiPartita: riconosce la modalita\' veloce (e solo quella)', () => {
  assert.equal(leggiPartita(partita(2, { creataIl: ADESSO, mod: 'veloce' })).veloce, true);
  assert.equal(leggiPartita(partita(2, { creataIl: ADESSO })).veloce, false);
  assert.equal(leggiPartita(partita(2, { creataIl: ADESSO, mod: 'normale' })).veloce, false);
  assert.equal(leggiPartita(partita(2, { creataIl: ADESSO, mod: 'VELOCE' })).veloce, false);
});

// ================= il calcolo: un caso completo =================

function casoCompleto() {
  const p = {};
  // OGGI (mercoledi' 14 ottobre)
  p.A1 = partita(2, { creataIl: quando(2026, 10, 14, 15, 11), vincitore: 1, mod: 'veloce' });      // di gruppo, conclusa, veloce
  p.A2 = partita(1, { creataIl: quando(2026, 10, 14, 9, 30) });                                      // da solo
  p.A3 = { creataIl: quando(2026, 10, 14, 8, 0), lobby: giocatori(3) };                              // lobby senza partita: non conta
  p.A4 = partita(4, { creataIl: quando(2026, 10, 14, 11, 0), lancio: null });                        // giocatori ma mai un lancio: non conta
  p.A5 = partita(3, { agg: quando(2026, 10, 14, 10, 5) });                                           // senza creataIl: vale l'aggiornamento
  // IERI (23:59:59) - dentro i 7 giorni, fuori da oggi
  p.B1 = partita(4, { creataIl: quando(2026, 10, 13, 23, 59, 59, 999), vincitore: 0 });
  // 6 giorni fa, mezzanotte e un millisecondo - e' il primo giorno dei 7
  p.C1 = partita(2, { creataIl: quando(2026, 10, 8, 0, 0, 0, 0) });
  // 7 giorni fa, 23:59:59.999 - fuori dai 7, dentro i 30
  p.D1 = partita(5, { creataIl: quando(2026, 10, 7, 23, 59, 59, 999), vincitore: 2 });
  // 29 giorni fa a mezzanotte (15 settembre) - ultimo giorno dei 30
  p.E1 = partita(3, { creataIl: quando(2026, 9, 15, 0, 0, 0, 0) });
  // 30 giorni fa a un secondo da mezzanotte (14 settembre) - fuori dai 30, solo nel totale
  p.F1 = partita(6, { creataIl: quando(2026, 9, 14, 23, 59, 59, 999), vincitore: 3 });
  p.F2 = partita(1, { creataIl: quando(2026, 9, 14, 23, 59, 59) });
  // senza nessuna data: solo nel totale
  p.G1 = partita(2, {});
  // nel futuro di 3 giorni (orologio sbagliato): solo nel totale
  p.H1 = partita(2, { creataIl: ADESSO + 3 * 24 * 60 * 60 * 1000 });
  return p;
}

prova('calcolo completo: oggi', () => {
  const r = calcolaAttivita(casoCompleto(), ADESSO);
  // A1 (2 giocatori, conclusa, veloce) e A5 (3 giocatori); A2 e' da solo; A3 e A4 non contano
  assert.deepEqual(r.oggi, { partite: 2, concluse: 1, giocatori: 5, daSolo: 1, veloci: 1 });
});

prova('calcolo completo: ultimi 7 giorni (oggi + i 6 giorni prima: dall\'8 ottobre alle 00:00)', () => {
  const r = calcolaAttivita(casoCompleto(), ADESSO);
  // oggi (A1, A5) + ieri (B1: 4 giocatori, conclusa) + 8 ottobre (C1: 2 giocatori). D1 (7 ottobre 23:59) resta fuori.
  assert.deepEqual(r.settimana, { partite: 4, concluse: 2, giocatori: 11, daSolo: 1, veloci: 1 });
});

prova('calcolo completo: ultimi 30 giorni (dal 15 settembre alle 00:00)', () => {
  const r = calcolaAttivita(casoCompleto(), ADESSO);
  // + D1 (5 giocatori, conclusa) + E1 (3 giocatori). F1 e F2 (14 settembre 23:59) restano fuori.
  assert.deepEqual(r.mese, { partite: 6, concluse: 3, giocatori: 19, daSolo: 1, veloci: 1 });
});

prova('calcolo completo: il totale comprende tutto, anche senza data e con data sbagliata', () => {
  const r = calcolaAttivita(casoCompleto(), ADESSO);
  // mese + F1 (6 giocatori, conclusa) + G1 (2) + H1 (2); da solo: A2 + F2
  assert.equal(r.totale.partite, 9);
  assert.equal(r.totale.concluse, 4);
  assert.equal(r.totale.giocatori, 29);
  assert.equal(r.totale.daSolo, 2);
  assert.equal(r.totale.veloci, 1);
  assert.equal(r.totale.senzaData, 2);          // G1 e H1
});

prova('calcolo completo: i 30 giorni del grafico, dal piu\' vecchio a oggi, con le partite al posto giusto', () => {
  const r = calcolaAttivita(casoCompleto(), ADESSO);
  assert.equal(r.giorni.length, 30);
  assert.equal(r.giorni[0].chiave, '2026-09-15');
  assert.equal(r.giorni[29].chiave, '2026-10-14');
  const per = chiave => r.giorni.find(g => g.chiave === chiave);
  assert.equal(per('2026-09-15').partite, 1);
  assert.equal(per('2026-10-07').partite, 1);
  assert.equal(per('2026-10-08').partite, 1);
  assert.equal(per('2026-10-13').partite, 1);
  assert.equal(per('2026-10-14').partite, 2);
  assert.equal(per('2026-10-14').daSolo, 1);
  assert.equal(per('2026-10-09').partite, 0);
  const somma = r.giorni.reduce((s, g) => s + g.partite, 0);
  assert.equal(somma, r.mese.partite);
});

prova('calcolo completo: ogni giorno parte a mezzanotte locale', () => {
  const r = calcolaAttivita(casoCompleto(), ADESSO);
  for (const g of r.giorni) {
    const d = new Date(g.inizio);
    assert.deepEqual([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()], [0, 0, 0, 0], g.chiave);
    assert.equal(chiaveGiorno(d), g.chiave);
  }
});

prova('calcolo completo: giorni con almeno una partita di gruppo', () => {
  const r = calcolaAttivita(casoCompleto(), ADESSO);
  assert.equal(r.giorniAttivi, 5);              // 15/9, 7/10, 8/10, 13/10, 14/10
});

prova('calcolo completo: l\'ultima partita e\' l\'ultima di gruppo con una data credibile (non da solo, non senza data, non del futuro)', () => {
  const r = calcolaAttivita(casoCompleto(), ADESSO);
  assert.deepEqual(r.ultima, { quando: quando(2026, 10, 14, 15, 11), giocatori: 2, conclusa: true, veloce: true });
});

prova('calcolo completo: l\'ultima puo\' essere vecchia di oltre 30 giorni (conta anche fuori dal grafico)', () => {
  const r = calcolaAttivita({ x: partita(4, { creataIl: quando(2026, 6, 1, 18, 30), vincitore: 0 }) }, ADESSO);
  assert.equal(r.mese.partite, 0);
  assert.equal(r.ultima.giocatori, 4);
  assert.equal(r.ultima.quando, quando(2026, 6, 1, 18, 30));
  assert.equal(r.totale.partite, 1);
});

prova('calcolo completo: se le partite arrivano in un altro ordine il risultato e\' lo stesso', () => {
  const normale = casoCompleto();
  const invertito = Object.fromEntries(Object.entries(normale).reverse());
  assert.deepEqual(calcolaAttivita(invertito, ADESSO), calcolaAttivita(normale, ADESSO));
});

// ================= i bordi del giorno =================

prova('bordi: 00:00:00.000 e\' il nuovo giorno, 23:59:59.999 e\' ancora quello di prima', () => {
  const p = {
    a: partita(2, { creataIl: quando(2026, 10, 13, 23, 59, 59, 999) }),
    b: partita(3, { creataIl: quando(2026, 10, 14, 0, 0, 0, 0) })
  };
  const r = calcolaAttivita(p, ADESSO);
  assert.equal(r.oggi.partite, 1);
  assert.equal(r.oggi.giocatori, 3);
  assert.equal(r.giorni[28].partite, 1);
});

prova('bordi: adesso e\' alle 00:00:00 o alle 23:59:59 - oggi resta oggi', () => {
  const p = { a: partita(2, { creataIl: quando(2026, 10, 14, 0, 0, 0, 0) }) };
  assert.equal(calcolaAttivita(p, quando(2026, 10, 14, 0, 0, 0, 0)).oggi.partite, 1);
  assert.equal(calcolaAttivita(p, quando(2026, 10, 14, 23, 59, 59, 999)).oggi.partite, 1);
  assert.equal(calcolaAttivita(p, quando(2026, 10, 15, 0, 0, 0, 0)).oggi.partite, 0);
  assert.equal(calcolaAttivita(p, quando(2026, 10, 15, 0, 0, 0, 0)).settimana.partite, 1);
});

prova('bordi: una partita aperta pochi minuti nel futuro (orologi un po\' sfasati) conta oggi', () => {
  const p = { a: partita(2, { creataIl: ADESSO + 5 * 60 * 1000 }) };
  const r = calcolaAttivita(p, ADESSO);
  assert.equal(r.oggi.partite, 1);
  assert.equal(r.totale.senzaData, 0);
});

// ================= ora legale, mesi, anni =================

function controllaGiorniConsecutivi(adesso, primo, ultimo) {
  const r = calcolaAttivita({}, adesso);
  assert.equal(r.giorni.length, 30);
  assert.equal(r.giorni[0].chiave, primo);
  assert.equal(r.giorni[29].chiave, ultimo);
  assert.equal(new Set(r.giorni.map(g => g.chiave)).size, 30, 'nessun giorno doppio');
  for (let i = 1; i < 30; i++) assert.equal(giorniTra(r.giorni[i - 1].chiave, r.giorni[i].chiave), 1, `${r.giorni[i - 1].chiave} -> ${r.giorni[i].chiave}`);
  return r;
}

prova('ora legale: a fine ottobre (giorno da 25 ore) i 30 giorni restano 30, uno dopo l\'altro', () => {
  controllaGiorniConsecutivi(quando(2026, 10, 26, 10), '2026-09-27', '2026-10-26');
  controllaGiorniConsecutivi(quando(2026, 10, 25, 23, 59), '2026-09-26', '2026-10-25');
  controllaGiorniConsecutivi(quando(2026, 10, 25, 0, 30), '2026-09-26', '2026-10-25');
});

prova('ora legale: a fine marzo (giorno da 23 ore) i 30 giorni restano 30, uno dopo l\'altro', () => {
  controllaGiorniConsecutivi(quando(2026, 3, 30, 10), '2026-03-01', '2026-03-30');
  controllaGiorniConsecutivi(quando(2026, 3, 29, 12), '2026-02-28', '2026-03-29');
});

prova('ora legale: le partite del 25 ottobre (giorno da 25 ore) contano tutte nel 25 ottobre, dalla mezzanotte alla fine', () => {
  const p = {
    a: partita(2, { creataIl: quando(2026, 10, 25, 0, 0, 0, 0) }),
    b: partita(2, { creataIl: quando(2026, 10, 25, 2, 30) }),            // l'ora ripetuta
    c: partita(2, { creataIl: quando(2026, 10, 25, 23, 59, 59, 999) }),
    d: partita(2, { creataIl: quando(2026, 10, 24, 23, 59, 59, 999) }),
    e: partita(2, { creataIl: quando(2026, 10, 26, 0, 0, 0, 0) })
  };
  const r = calcolaAttivita(p, quando(2026, 10, 26, 10));
  const per = chiave => r.giorni.find(g => g.chiave === chiave).partite;
  assert.equal(per('2026-10-24'), 1);
  assert.equal(per('2026-10-25'), 3);
  assert.equal(per('2026-10-26'), 1);
});

prova('ora legale: le partite del 29 marzo (giorno da 23 ore) contano nel 29 marzo', () => {
  const p = {
    a: partita(2, { creataIl: quando(2026, 3, 29, 0, 0, 0, 0) }),
    b: partita(2, { creataIl: quando(2026, 3, 29, 23, 59, 59, 999) }),
    c: partita(2, { creataIl: quando(2026, 3, 28, 23, 59, 59, 999) })
  };
  const r = calcolaAttivita(p, quando(2026, 3, 30, 10));
  const per = chiave => r.giorni.find(g => g.chiave === chiave).partite;
  assert.equal(per('2026-03-28'), 1);
  assert.equal(per('2026-03-29'), 2);
});

prova('cambio di anno: a inizio gennaio i 30 giorni passano da dicembre', () => {
  const r = controllaGiorniConsecutivi(quando(2027, 1, 3, 9), '2026-12-05', '2027-01-03');
  assert.equal(r.giorni.find(g => g.chiave === '2026-12-31').chiave, '2026-12-31');
});

prova('cambio di anno: una partita del 31 dicembre finisce nel 31 dicembre, una dell\'1 gennaio nell\'1 gennaio', () => {
  const p = {
    a: partita(2, { creataIl: quando(2026, 12, 31, 23, 59, 59) }),
    b: partita(3, { creataIl: quando(2027, 1, 1, 0, 0, 1) })
  };
  const r = calcolaAttivita(p, quando(2027, 1, 3, 9));
  assert.equal(r.giorni.find(g => g.chiave === '2026-12-31').giocatori, 2);
  assert.equal(r.giorni.find(g => g.chiave === '2027-01-01').giocatori, 3);
});

prova('febbraio: nell\'anno non bisestile e in quello bisestile i 30 giorni tornano', () => {
  controllaGiorniConsecutivi(quando(2026, 3, 5, 9), '2026-02-04', '2026-03-05');
  controllaGiorniConsecutivi(quando(2028, 3, 5, 9), '2028-02-05', '2028-03-05');
});

// ================= dati strani =================

prova('dati strani: niente partite = tutti zeri, nessun errore', () => {
  for (const v of [null, undefined, {}, [], 0, 'x', true]) {
    const r = calcolaAttivita(v, ADESSO);
    assert.deepEqual(r.oggi, { partite: 0, concluse: 0, giocatori: 0, daSolo: 0, veloci: 0 }, JSON.stringify(v));
    assert.deepEqual(r.mese, r.oggi);
    assert.equal(r.totale.partite, 0);
    assert.equal(r.ultima, null);
    assert.equal(r.giorniAttivi, 0);
    assert.equal(r.giorni.length, 30);
  }
});

prova('dati strani: tra le partite ci sono anche valori vuoti o non-oggetti: si saltano', () => {
  const p = { a: null, b: 5, c: 'x', d: [], e: partita(2, { creataIl: ADESSO }) };
  const r = calcolaAttivita(p, ADESSO);
  assert.equal(r.oggi.partite, 1);
});

prova('dati strani: un elenco al posto dell\'oggetto (Firebase con chiavi numeriche) funziona uguale', () => {
  const r = calcolaAttivita([partita(2, { creataIl: ADESSO }), null, partita(1, { creataIl: ADESSO })], ADESSO);
  assert.equal(r.oggi.partite, 1);
  assert.equal(r.oggi.daSolo, 1);
});

prova('dati strani: "adesso" mancante o non valido = l\'ora vera, senza errori', () => {
  const prima = Date.now();
  for (const v of [undefined, null, NaN, 'oggi', Infinity]) {
    const r = calcolaAttivita({}, v);
    assert.ok(r.adesso >= prima && r.adesso <= Date.now() + 5, String(v));
    assert.equal(r.giorni.length, 30);
  }
});

prova('dati strani: giocatori come oggetto con un buco, vincitore alto, dado a 0: nessun errore', () => {
  const p = partita(2, { creataIl: ADESSO, lancio: 0 });
  p.stato.giocatori = { 0: { id: 0 }, 2: { id: 2 } };
  const r = calcolaAttivita({ x: p }, ADESSO);
  assert.equal(r.oggi.partite, 1);
  assert.equal(r.oggi.giocatori, 2);
});

prova('dati strani: nomi con codice dentro non influenzano niente (si leggono solo i numeri)', () => {
  const p = partita(2, { creataIl: ADESSO });
  p.stato.giocatori[0].nome = '<img src=x onerror=alert(1)>';
  p.lobby[0].nome = '</script>';
  const r = calcolaAttivita({ x: p }, ADESSO);
  assert.equal(r.oggi.partite, 1);
  assert.equal(JSON.stringify(r).includes('img'), false);
});

prova('dati strani: "constructor", "__proto__" e simili come codici partita non rompono niente', () => {
  const p = JSON.parse('{"constructor": {"stato": {"giocatori": [{},{}], "ultimoLancio": 3}, "creataIl": 1}, "__proto__": 5, "toString": 7}');
  const r = calcolaAttivita(p, ADESSO);
  assert.equal(r.totale.partite, 1);
});

prova('velocita\': 30.000 partite si contano in meno di mezzo secondo', () => {
  const tante = {};
  for (let i = 0; i < 30000; i++) tante['k' + i] = partita((i % 6) + 1, { creataIl: ADESSO - (i % 45) * 24 * 60 * 60 * 1000, vincitore: i % 3 === 0 ? 0 : null });
  const t0 = Date.now();
  const r = calcolaAttivita(tante, ADESSO);
  const ms = Date.now() - t0;
  assert.ok(ms < 500, `${ms} ms`);
  assert.equal(r.totale.partite + r.totale.daSolo, 30000);
});

prova('le somme tornano: oggi <= 7 giorni <= 30 giorni <= totale, per ogni numero', () => {
  const tante = {};
  for (let i = 0; i < 2000; i++) tante['k' + i] = partita((i % 5) + 1, { creataIl: ADESSO - ((i * 7919) % (50 * 24 * 60 * 60 * 1000)), vincitore: i % 4 === 0 ? 1 : null, mod: i % 9 === 0 ? 'veloce' : undefined });
  const r = calcolaAttivita(tante, ADESSO);
  for (const campo of ['partite', 'concluse', 'giocatori', 'daSolo', 'veloci']) {
    assert.ok(r.oggi[campo] <= r.settimana[campo] && r.settimana[campo] <= r.mese[campo] && r.mese[campo] <= r.totale[campo], campo);
  }
  assert.ok(r.mese.concluse <= r.mese.partite && r.mese.veloci <= r.mese.partite);
  assert.ok(r.mese.giocatori >= 2 * r.mese.partite);
});

// ================= le parole =================

prova('plurale', () => {
  assert.equal(plurale(0, 'partita', 'partite'), 'partite');
  assert.equal(plurale(1, 'partita', 'partite'), 'partita');
  assert.equal(plurale(2, 'partita', 'partite'), 'partite');
  assert.equal(plurale(11, 'giocatore', 'giocatori'), 'giocatori');
});

prova('formattaGiorno: breve, lungo, con anno', () => {
  const d = new Date(2026, 9, 14, 15, 49);
  assert.equal(formattaGiorno(d), 'mer 14 ott');
  assert.equal(formattaGiorno(d, { lungo: true }), 'mercoledì 14 ottobre');
  assert.equal(formattaGiorno(d, { lungo: true, anno: true }), 'mercoledì 14 ottobre 2026');
  assert.equal(formattaGiorno(new Date(2026, 0, 1)), 'gio 1 gen');
  assert.equal(formattaGiorno(new Date(2026, 8, 7), { lungo: true }), 'lunedì 7 settembre');
});

prova('etichettaAsse: giorno/mese senza zeri', () => {
  assert.equal(etichettaAsse(new Date(2026, 9, 14)), '14/10');
  assert.equal(etichettaAsse(new Date(2026, 8, 7)), '7/9');
  assert.equal(etichettaAsse(new Date(2026, 0, 31)), '31/1');
});

prova('formattaOra: due cifre, 24 ore', () => {
  assert.equal(formattaOra(new Date(2026, 9, 14, 15, 11)), '15:11');
  assert.equal(formattaOra(new Date(2026, 9, 14, 9, 5)), '09:05');
  assert.equal(formattaOra(new Date(2026, 9, 14, 0, 0)), '00:00');
  assert.equal(formattaOra(new Date(2026, 9, 14, 23, 59)), '23:59');
});

prova('descriviQuando: oggi, ieri, qualche giorno fa, tanto tempo fa', () => {
  assert.equal(descriviQuando(quando(2026, 10, 14, 15, 11), ADESSO), 'oggi alle 15:11');
  assert.equal(descriviQuando(quando(2026, 10, 14, 0, 5), ADESSO), 'oggi alle 00:05');
  assert.equal(descriviQuando(quando(2026, 10, 13, 21, 4), ADESSO), 'ieri alle 21:04');
  assert.equal(descriviQuando(quando(2026, 10, 13, 0, 0), ADESSO), 'ieri alle 00:00');
  assert.equal(descriviQuando(quando(2026, 10, 12, 18, 30), ADESSO), 'lunedì 12 ottobre alle 18:30 (2 giorni fa)');
  assert.equal(descriviQuando(quando(2026, 10, 11, 16, 17), ADESSO), 'domenica 11 ottobre alle 16:17 (3 giorni fa)');
  assert.equal(descriviQuando(quando(2026, 9, 7, 18, 41), ADESSO), 'lunedì 7 settembre alle 18:41 (37 giorni fa)');
});

prova('descriviQuando: se e\' di un altro anno compare l\'anno', () => {
  assert.equal(descriviQuando(quando(2025, 12, 24, 21, 0), quando(2026, 1, 5, 10)), 'mercoledì 24 dicembre 2025 alle 21:00 (12 giorni fa)');
});

prova('descriviQuando: a cavallo della mezzanotte conta il giorno di calendario, non le 24 ore', () => {
  assert.equal(descriviQuando(quando(2026, 10, 13, 23, 50), quando(2026, 10, 14, 0, 10)), 'ieri alle 23:50');
  assert.equal(descriviQuando(quando(2026, 10, 14, 0, 10), quando(2026, 10, 14, 0, 11)), 'oggi alle 00:10');
});

prova('descriviQuando: un orario di poco nel futuro si legge "oggi" (non "domani", non negativo)', () => {
  assert.equal(descriviQuando(ADESSO + 5 * 60 * 1000, ADESSO), 'oggi alle 15:54');
  assert.equal(descriviQuando(quando(2026, 10, 15, 0, 5), quando(2026, 10, 14, 23, 58)), 'oggi alle 00:05');
});

// ================= esito =================

console.log(`\nStatistiche attivita': ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
