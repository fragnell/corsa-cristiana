// test-veloce.mjs
// Prove della PARTITA VELOCE e del "salto che attiva la casella di arrivo":
//  - la configurazione (cosa e' stato tolto, cosa e' stato aggiunto, come si uniscono i valori di Firebase);
//  - configPerModalita(): cambia solo i quattro numeri della partita veloce e non tocca l'originale;
//  - il motore con i numeri veloci (risposte giuste +8, prove +3, imprevisto -1, vittoria superando la fine);
//  - saltoAttivaArrivo() / risolviCasellaDiArrivo() e il limite di salti di fila;
//  - la durata: con numeri veri la partita veloce dura almeno un quarto in meno (partite simulate con un
//    sorteggio "con il seme": il risultato e' sempre lo stesso, non cambia da una volta all'altra).
// Si lancia con:  node test-veloce.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CONFIG, unisciConfig, configPerModalita } from './js/config.js';
import { creaStatoIniziale } from './js/stato.js';
import {
  tiraDado, muoviGiocatore, applicaRispostaConoscenza, applicaEsitoProva, impostaProvaInSospeso, risolviProvaInSospeso,
  passaTurno, risolviCasellaDiArrivo, saltoAttivaArrivo, MAX_SALTI_DI_FILA
} from './js/regole.js';
import { generatoreConSeme } from './js/salmo/mosaico.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.message).split('\n').join('\n        ')}`); }
}

const cartella = path.dirname(fileURLToPath(import.meta.url));
const percorso = JSON.parse(readFileSync(path.join(cartella, 'dati', 'percorso.json'), 'utf-8')).celle;
const veloce = configPerModalita(CONFIG, 'veloce');

// uno stato con i giocatori nelle posizioni indicate (tocca al primo)
function statoCon(...posizioni) {
  const s = creaStatoIniziale(posizioni.map((_, i) => ({ nome: 'G' + i, colore: 'rosso' })));
  posizioni.forEach((p, i) => { s.giocatori[i].posizione = p; });
  return s;
}
const pos = (s, i = 0) => s.giocatori[i].posizione;

// ================= la configurazione =================

prova('CONFIG: la Sfida non c\'e\' piu\' (niente sfidaBonusVincitore / sfidaMalusPerdente)', () => {
  assert.ok(!('sfidaBonusVincitore' in CONFIG.conoscenza));
  assert.ok(!('sfidaMalusPerdente' in CONFIG.conoscenza));
  assert.deepEqual(Object.keys(CONFIG.conoscenza).sort(), ['bonusRispostaCorretta', 'malusRispostaErrata']);
});

prova('CONFIG: via anche "bonusAttivaCasella" e "arrivoLibero" (regole fisse), resta solo saltoAttivaCasella', () => {
  assert.deepEqual(Object.keys(CONFIG.regole), ['saltoAttivaCasella']);
  assert.equal(CONFIG.regole.saltoAttivaCasella, false);
});

prova('CONFIG: i numeri della partita normale sono quelli di sempre (3, 0, -5, 1, 0)', () => {
  assert.equal(CONFIG.conoscenza.bonusRispostaCorretta, 3);
  assert.equal(CONFIG.conoscenza.malusRispostaErrata, 0);
  assert.equal(CONFIG.imprevisto.malus, -5);
  assert.equal(CONFIG.prova.bonusSuperata, 1);
  assert.equal(CONFIG.prova.malusFallita, 0);
});

prova('CONFIG.veloce: i quattro numeri di base (8, 3, -1, salto acceso)', () => {
  assert.deepEqual(CONFIG.veloce, { bonusConoscenza: 8, bonusProva: 3, malusImprevisto: -1, saltoAttivaCasella: true });
});

prova('CONFIG.recensioni: di base accese, solo per chi gioca le prime 3 partite', () => {
  assert.deepEqual(CONFIG.recensioni, { attiva: true, soloNuovi: true, primePartite: 3 });
});

prova('unisciConfig: senza personalizzazioni restano tutti i valori di base (anche veloce e recensioni)', () => {
  const c = unisciConfig(CONFIG, {});
  assert.deepEqual(c.veloce, CONFIG.veloce);
  assert.deepEqual(c.recensioni, CONFIG.recensioni);
  assert.deepEqual(c.conoscenza, CONFIG.conoscenza);
  assert.deepEqual(c.regole, CONFIG.regole);
});

prova('unisciConfig: i valori di Firebase vincono, quelli non toccati restano', () => {
  const c = unisciConfig(CONFIG, { veloce: { bonusConoscenza: 6 }, recensioni: { primePartite: 5 }, regole: { saltoAttivaCasella: true } });
  assert.equal(c.veloce.bonusConoscenza, 6);
  assert.equal(c.veloce.bonusProva, 3);
  assert.equal(c.veloce.malusImprevisto, -1);
  assert.equal(c.recensioni.primePartite, 5);
  assert.equal(c.recensioni.attiva, true);
  assert.equal(c.regole.saltoAttivaCasella, true);
});

prova('unisciConfig: non modifica CONFIG e ignora le sezioni che non conosce', () => {
  const prima = JSON.stringify(CONFIG);
  const c = unisciConfig(CONFIG, { sfida: { x: 1 }, veloce: { bonusProva: 9 } });
  assert.equal(JSON.stringify(CONFIG), prima);
  assert.ok(!('sfida' in c));
  assert.equal(c.veloce.bonusProva, 9);
});

prova('unisciConfig: le vecchie chiavi della Sfida rimaste su Firebase non fanno danni (restano ignorate)', () => {
  const c = unisciConfig(CONFIG, { conoscenza: { bonusRispostaCorretta: 4, sfidaBonusVincitore: 3, sfidaMalusPerdente: -2 }, regole: { bonusAttivaCasella: false, arrivoLibero: true, saltoAttivaCasella: true } });
  assert.equal(c.conoscenza.bonusRispostaCorretta, 4);
  assert.equal(applicaRispostaConoscenza(statoCon(10), percorso, true, c).stato.giocatori[0].posizione, 14);
  assert.equal(c.regole.saltoAttivaCasella, true);
});

// ================= configPerModalita =================

prova('configPerModalita: "normale", nessuna modalita\' o una modalita\' sconosciuta -> la stessa configurazione', () => {
  assert.equal(configPerModalita(CONFIG, 'normale'), CONFIG);
  assert.equal(configPerModalita(CONFIG, undefined), CONFIG);
  assert.equal(configPerModalita(CONFIG, null), CONFIG);
  assert.equal(configPerModalita(CONFIG, 'turbo'), CONFIG);
});

prova('configPerModalita: "veloce" cambia solo i quattro numeri', () => {
  assert.equal(veloce.conoscenza.bonusRispostaCorretta, 8);
  assert.equal(veloce.prova.bonusSuperata, 3);
  assert.equal(veloce.imprevisto.malus, -1);
  assert.equal(veloce.regole.saltoAttivaCasella, true);
  // il resto e' identico
  assert.equal(veloce.conoscenza.malusRispostaErrata, 0);
  assert.equal(veloce.prova.malusFallita, 0);
  assert.deepEqual(veloce.dado, CONFIG.dado);
  assert.deepEqual(veloce.giocatori, CONFIG.giocatori);
  assert.deepEqual(veloce.timeout, CONFIG.timeout);
  assert.deepEqual(veloce.salmo, CONFIG.salmo);
  assert.deepEqual(veloce.recensioni, CONFIG.recensioni);
  assert.deepEqual(veloce.veloce, CONFIG.veloce);
});

prova('configPerModalita: non modifica la configurazione di partenza', () => {
  const prima = JSON.stringify(CONFIG);
  configPerModalita(CONFIG, 'veloce');
  assert.equal(JSON.stringify(CONFIG), prima);
  assert.equal(CONFIG.conoscenza.bonusRispostaCorretta, 3);
});

prova('configPerModalita: usa i valori salvati dall\'Admin (non quelli di base)', () => {
  const c = configPerModalita(unisciConfig(CONFIG, { veloce: { bonusConoscenza: 6, bonusProva: 2, malusImprevisto: -2, saltoAttivaCasella: false } }), 'veloce');
  assert.equal(c.conoscenza.bonusRispostaCorretta, 6);
  assert.equal(c.prova.bonusSuperata, 2);
  assert.equal(c.imprevisto.malus, -2);
  assert.equal(c.regole.saltoAttivaCasella, false);
});

prova('configPerModalita: senza la sezione "veloce" non cambia niente (e non si rompe)', () => {
  const senza = { ...CONFIG };
  delete senza.veloce;
  assert.equal(configPerModalita(senza, 'veloce'), senza);
});

// ================= il motore con i numeri veloci =================

prova('veloce: risposta giusta avanza di 8, risposta sbagliata resta ferma', () => {
  assert.equal(pos(applicaRispostaConoscenza(statoCon(20), percorso, true, veloce).stato), 28);
  assert.equal(pos(applicaRispostaConoscenza(statoCon(20), percorso, false, veloce).stato), 20);
});

prova('normale: risposta giusta avanza di 3 (come sempre)', () => {
  assert.equal(pos(applicaRispostaConoscenza(statoCon(20), percorso, true, CONFIG).stato), 23);
  assert.equal(pos(applicaRispostaConoscenza(statoCon(20), percorso, false, CONFIG).stato), 20);
});

prova('veloce: prova superata avanza di 3, fallita resta ferma; normale: +1', () => {
  assert.equal(pos(applicaEsitoProva(statoCon(52), percorso, true, veloce).stato), 55);
  assert.equal(pos(applicaEsitoProva(statoCon(52), percorso, false, veloce).stato), 52);
  assert.equal(pos(applicaEsitoProva(statoCon(52), percorso, true, CONFIG).stato), 53);
});

prova('veloce: l\'imprevisto fa arretrare di 1; normale di 5', () => {
  // dalla casella 10 con un 6 si arriva alla 16 (Imprevisto)
  const rV = muoviGiocatore(statoCon(10), percorso, 6, veloce);
  assert.equal(rV.evento.tipo, 'IMPREVISTO');
  assert.equal(pos(rV.stato), 15);
  const rN = muoviGiocatore(statoCon(10), percorso, 6, CONFIG);
  assert.equal(rN.evento.tipo, 'IMPREVISTO');
  assert.equal(pos(rN.stato), 11);
});

prova('veloce: si vince superando la casella finale (nessun rimbalzo indietro)', () => {
  const r = applicaRispostaConoscenza(statoCon(58), percorso, true, veloce);   // 58 + 8 = 66
  assert.equal(r.evento.tipo, 'VITTORIA');
  assert.equal(r.stato.vincitore, 0);
  assert.equal(pos(r.stato), 63);
});

prova('veloce: si vince anche arrivando esattamente sull\'ultima casella', () => {
  const r = applicaRispostaConoscenza(statoCon(55), percorso, true, veloce);   // 55 + 8 = 63
  assert.equal(r.evento.tipo, 'VITTORIA');
  assert.equal(pos(r.stato), 63);
});

prova('veloce: con il dado, superare la fine fa vincere', () => {
  const r = muoviGiocatore(statoCon(60), percorso, 6, veloce);
  assert.equal(r.evento.tipo, 'VITTORIA');
  assert.equal(r.stato.vincitore, 0);
});

prova('una pedina non va mai sotto la casella 1 (anche con un malus esagerato)', () => {
  const c = unisciConfig(CONFIG, { veloce: { malusImprevisto: -50 } });
  const r = muoviGiocatore(statoCon(10), percorso, 6, configPerModalita(c, 'veloce'));
  assert.equal(pos(r.stato), 1);
});

prova('veloce: le prove "vincolo" funzionano come prima (restano in sospeso e poi si giudicano)', () => {
  let s = impostaProvaInSospeso(statoCon(52), 0, { testo: 'x' });
  assert.ok(s.giocatori[0].provaInSospeso);
  s = risolviProvaInSospeso(s, 0);
  assert.equal(s.giocatori[0].provaInSospeso, null);
  assert.equal(pos(applicaEsitoProva(s, percorso, true, veloce).stato), 55);
});

// ================= il salto che attiva la casella di arrivo =================

const accesa = unisciConfig(CONFIG, { regole: { saltoAttivaCasella: true } });

prova('saltoAttivaArrivo: solo dopo un SALTO, con la regola accesa', () => {
  assert.equal(saltoAttivaArrivo({ tipo: 'SALTO' }, accesa, 0), true);
  assert.equal(saltoAttivaArrivo({ tipo: 'SALTO' }, CONFIG, 0), false, 'regola spenta');
  assert.equal(saltoAttivaArrivo({ tipo: 'IMPREVISTO' }, accesa, 0), false);
  assert.equal(saltoAttivaArrivo({ tipo: 'IN_ATTESA', casella: 'CONOSCENZA' }, accesa, 0), false);
  assert.equal(saltoAttivaArrivo({ tipo: 'VITTORIA' }, accesa, 0), false);
  assert.equal(saltoAttivaArrivo({ tipo: 'FERMO' }, accesa, 0), false);
});

prova('saltoAttivaArrivo: regge i dati strani senza rompersi', () => {
  assert.equal(saltoAttivaArrivo(undefined, accesa, 0), false);
  assert.equal(saltoAttivaArrivo(null, accesa, 0), false);
  assert.equal(saltoAttivaArrivo({ tipo: 'SALTO' }, {}, 0), false);
  assert.equal(saltoAttivaArrivo({ tipo: 'SALTO' }, { regole: {} }, 0), false);
});

prova('saltoAttivaArrivo: dopo 3 salti di fila si ferma', () => {
  assert.equal(MAX_SALTI_DI_FILA, 3);
  assert.equal(saltoAttivaArrivo({ tipo: 'SALTO' }, accesa, 2), true);
  assert.equal(saltoAttivaArrivo({ tipo: 'SALTO' }, accesa, 3), false);
  assert.equal(saltoAttivaArrivo({ tipo: 'SALTO' }, accesa, 10), false);
});

prova('saltoAttivaArrivo: la partita veloce lo accende, la normale (di base) no', () => {
  assert.equal(saltoAttivaArrivo({ tipo: 'SALTO' }, veloce, 0), true);
  assert.equal(saltoAttivaArrivo({ tipo: 'SALTO' }, CONFIG, 0), false);
});

prova('i tre salti del percorso portano tutti su una casella Conoscenza: dopo il salto parte la domanda', () => {
  for (const [da, a] of [[9, 15], [24, 31], [41, 47]]) {
    const r = muoviGiocatore(statoCon(da - 1), percorso, 1, accesa);
    assert.equal(r.evento.tipo, 'SALTO', `casella ${da}`);
    assert.equal(pos(r.stato), a);
    assert.equal(saltoAttivaArrivo(r.evento, accesa, 0), true);
    const r2 = risolviCasellaDiArrivo(r.stato, percorso, accesa);
    assert.equal(r2.evento.tipo, 'IN_ATTESA', `arrivo ${a}`);
    assert.equal(r2.evento.casella, 'CONOSCENZA');
    assert.equal(pos(r2.stato), a, 'la risoluzione non sposta nessuno');
  }
});

prova('risolviCasellaDiArrivo: non modifica lo stato che riceve', () => {
  const r = muoviGiocatore(statoCon(8), percorso, 1, accesa);
  const copia = JSON.stringify(r.stato);
  risolviCasellaDiArrivo(r.stato, percorso, accesa);
  assert.equal(JSON.stringify(r.stato), copia);
});

prova('risolviCasellaDiArrivo: su un Imprevisto sposta indietro (-1 in veloce, -5 in normale)', () => {
  assert.equal(pos(risolviCasellaDiArrivo(statoCon(16), percorso, veloce).stato), 15);
  assert.equal(pos(risolviCasellaDiArrivo(statoCon(16), percorso, CONFIG).stato), 11);
  assert.equal(risolviCasellaDiArrivo(statoCon(16), percorso, CONFIG).evento.tipo, 'IMPREVISTO');
});

prova('risolviCasellaDiArrivo: su un Fermo il giocatore salta il turno dopo', () => {
  const r = risolviCasellaDiArrivo(statoCon(37), percorso, CONFIG);
  assert.equal(r.evento.tipo, 'FERMO');
  assert.equal(r.stato.giocatori[0].saltaProssimoTurno, true);
});

prova('risolviCasellaDiArrivo: su una Prova la prova e\' in attesa del giudice', () => {
  const r = risolviCasellaDiArrivo(statoCon(55), percorso, CONFIG);
  assert.equal(r.evento.tipo, 'IN_ATTESA');
  assert.equal(r.evento.casella, 'PROVA');
});

prova('risolviCasellaDiArrivo: agisce sul giocatore di turno, non sugli altri', () => {
  let s = statoCon(5, 15, 30);
  s = passaTurno(s);   // tocca al secondo (casella 15, Conoscenza)
  const r = risolviCasellaDiArrivo(s, percorso, CONFIG);
  assert.equal(r.evento.tipo, 'IN_ATTESA');
  assert.deepEqual(r.stato.giocatori.map(g => g.posizione), [5, 15, 30]);
});

prova('una catena di salti che gira in tondo si ferma dopo 3 salti (percorso di prova con due salti uno sull\'altro)', () => {
  const tondo = [
    { numero: 1, tipo: 'PARTENZA' },
    { numero: 2, tipo: 'SALTO', vaiA: 3, evento: 'A' },
    { numero: 3, tipo: 'SALTO', vaiA: 2, evento: 'B' },
    { numero: 4, tipo: 'ARRIVO' }
  ];
  let r = muoviGiocatore(statoCon(1), tondo, 1, accesa);     // atterra sul 2 -> salta al 3
  assert.equal(r.evento.tipo, 'SALTO');
  let salti = 0;
  let sicurezza = 0;
  while (saltoAttivaArrivo(r.evento, accesa, salti) && sicurezza++ < 100) {
    salti++;
    r = risolviCasellaDiArrivo(r.stato, tondo, accesa);
  }
  assert.equal(salti, 3, 'tre salti e poi basta');
  assert.ok(sicurezza < 100);
});

prova('muoviGiocatore da solo NON attiva l\'arrivo del salto: lo decide chi gioca il turno', () => {
  const r = muoviGiocatore(statoCon(8), percorso, 1, accesa);   // 9 -> salto al 15
  assert.equal(r.evento.tipo, 'SALTO');
  assert.equal(r.evento.destinazione, 15);
  assert.equal(pos(r.stato), 15);
});

// ================= la durata: la partita veloce e' piu' corta =================

// Una partita giocata dal motore vero, con risposte e prove date "a caso" (con il seme).
// Restituisce quanti turni sono stati giocati in tutto fino alla vittoria.
function giocaUnaPartita(cfg, caso, { giocatori, quantoBene, quantoBeneProve }) {
  let stato = creaStatoIniziale(Array.from({ length: giocatori }, (_, k) => ({ nome: 'G' + k, colore: 'rosso' })));
  let turni = 0;
  while (stato.vincitore === null && turni < 5000) {
    turni++;
    const g = stato.giocatori[stato.turnoDi];
    if (g.provaInSospeso) {                               // la prova "vincolo" del turno prima si giudica adesso
      stato = risolviProvaInSospeso(stato, g.id);
      stato = applicaEsitoProva(stato, percorso, caso() < quantoBeneProve, cfg).stato;
      if (stato.vincitore !== null) break;
    }
    let r = muoviGiocatore(stato, percorso, tiraDado(cfg), cfg);
    stato = r.stato;
    let salti = 0;
    for (;;) {
      if (r.evento.tipo === 'IN_ATTESA' && r.evento.casella === 'CONOSCENZA') {
        stato = applicaRispostaConoscenza(stato, percorso, caso() < quantoBene, cfg).stato;
      } else if (r.evento.tipo === 'IN_ATTESA') {         // prova: meta' "vincolo", meta' immediata
        if (caso() < 0.5) stato = impostaProvaInSospeso(stato, g.id, { testo: 'x' });
        else stato = applicaEsitoProva(stato, percorso, caso() < quantoBeneProve, cfg).stato;
      } else if (saltoAttivaArrivo(r.evento, cfg, salti)) {
        salti++;
        r = risolviCasellaDiArrivo(stato, percorso, cfg);
        stato = r.stato;
        continue;
      }
      break;
    }
    if (stato.vincitore !== null) break;
    stato = passaTurno(stato);
  }
  return { finita: stato.vincitore !== null, turni };
}

// Media dei turni su tante partite, con il sorteggio "a seme" (sempre lo stesso risultato).
function mediaTurni(cfg, partite, seme, opzioni) {
  const casuale = generatoreConSeme(seme);
  const originale = Math.random;
  Math.random = casuale;
  try {
    let totale = 0;
    for (let i = 0; i < partite; i++) {
      const r = giocaUnaPartita(cfg, casuale, opzioni);
      assert.ok(r.finita, 'la partita deve finire');
      totale += r.turni;
    }
    return totale / partite;
  } finally {
    Math.random = originale;
  }
}

prova('durata: con 3 giocatori la partita veloce dura almeno un quarto in meno (e non meno della meta\')', () => {
  const opz = { giocatori: 3, quantoBene: 0.77, quantoBeneProve: 0.85 };
  const normale = mediaTurni(CONFIG, 500, 11, opz);
  const rapida = mediaTurni(veloce, 500, 11, opz);
  const risparmio = 1 - rapida / normale;
  assert.ok(risparmio >= 0.25 && risparmio <= 0.55, `risparmio ${(risparmio * 100).toFixed(1)}% (normale ${normale.toFixed(1)} turni, veloce ${rapida.toFixed(1)})`);
});

prova('durata: con 6 giocatori e risposte meno sicure (60%) la partita veloce e\' comunque piu\' corta', () => {
  const opz = { giocatori: 6, quantoBene: 0.6, quantoBeneProve: 0.8 };
  const normale = mediaTurni(CONFIG, 400, 23, opz);
  const rapida = mediaTurni(veloce, 400, 23, opz);
  const risparmio = 1 - rapida / normale;
  assert.ok(risparmio >= 0.2 && risparmio <= 0.6, `risparmio ${(risparmio * 100).toFixed(1)}%`);
});

prova('durata: tutte le partite veloci finiscono (nessun giro infinito), anche con risposte tutte sbagliate', () => {
  const opz = { giocatori: 4, quantoBene: 0, quantoBeneProve: 0 };
  const media = mediaTurni(veloce, 100, 5, opz);
  assert.ok(media > 0 && media < 5000, `media ${media}`);
});

// ================= esito =================

console.log(`\nPartita veloce: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
