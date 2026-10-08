// test-salmo-orchestratore.mjs
// Prove del "regista" del Salmo 133:1 (js/salmo/orchestratore.js).
// Si lancia con:  node test-salmo-orchestratore.mjs
//
// Niente browser, niente Firebase, niente attese vere: l'orologio e' FINTO
// (il tempo corre quanto vogliamo, all'istante) e i telefoni sono "copioni"
// che premono i bottoni al momento deciso da noi. Cosi' si possono provare
// anche i casi peggiori: telefoni che spariscono, rete che non risponde,
// dati rovinati, doppi tocchi...

import assert from 'node:assert/strict';
import { CONFIG } from './js/config.js';
import { creaStatoIniziale } from './js/stato.js';
import { configSalmoSicura, valutaSalmo, contatoriDopoAvvio } from './js/salmo/regola.js';
import { creaSessione, GRAZIA_CONSEGNA_FINALE_MS, DURATA_ANNULLAMENTO_MS } from './js/salmo/sessione.js';
import { generatoreConSeme } from './js/salmo/mosaico.js';
import { ID_DISEGNI } from './js/salmo/disegni.js';
import {
  svolgiSalmo, conLimite, TOLLERANZA_PRESENZA_MS, LIMITE_PUBBLICAZIONE_MS
} from './js/salmo/orchestratore.js';

// ---------------------------------------------------------------- strumenti

const vero = {
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  now: Date.now,
  setImmediate: globalThis.setImmediate,
  warn: console.warn
};

// Un orologio finto: "avanza(ms)" fa scattare, in ordine, tutti i timer che
// cadono in quel lasso di tempo, lasciando girare le promesse tra uno e l'altro.
function creaOrologio(inizio = 1_700_000_000_000) {
  let ora = inizio;
  let seq = 0;
  const timer = [];
  globalThis.setTimeout = (fn, ms = 0) => {
    const id = ++seq;
    timer.push({ id, quando: ora + Math.max(0, Number(ms) || 0), fn, esterno: false });
    return id;
  };
  globalThis.clearTimeout = id => {
    const i = timer.findIndex(t => t.id === id);
    if (i >= 0) timer.splice(i, 1);
  };
  Date.now = () => ora;

  const respira = async () => {
    for (let i = 0; i < 3; i++) await new Promise(r => vero.setImmediate(r));
  };

  return {
    adesso: () => ora,
    // timer creato dal "mondo di prova" (i telefoni finti), non dal regista
    programma(ms, fn) {
      const id = ++seq;
      timer.push({ id, quando: ora + ms, fn, esterno: true });
    },
    // quanti timer del REGISTA sono ancora in attesa
    pendenti: () => timer.filter(t => !t.esterno).length,
    async avanza(ms) {
      const fine = ora + ms;
      await respira();
      for (;;) {
        timer.sort((a, b) => a.quando - b.quando || a.id - b.id);
        const prossimo = timer[0];
        if (!prossimo || prossimo.quando > fine) break;
        timer.shift();
        ora = Math.max(ora, prossimo.quando);
        prossimo.fn();
        await respira();
      }
      ora = fine;
      await respira();
    },
    salta(ms) { ora += ms; },     // salto improvviso dell'orologio (senza far scattare nulla)
    ripristina() {
      globalThis.setTimeout = vero.setTimeout;
      globalThis.clearTimeout = vero.clearTimeout;
      Date.now = vero.now;
    }
  };
}

const CFG_BASE = configSalmoSicura(CONFIG.salmo);

// Costruisce un "mondo" completo: stato, sessione, rete finta, interfaccia
// finta e telefoni a copione.
//   posizioni  posizioni dei giocatori (id = indice); turno di "turnoDi"
//   reazioni   { pronti, anteprima, prova, esito }: cosa fanno i telefoni quando
//              compare quella fase. Ognuna riceve un "ctx" con gli strumenti.
function creaMondo({
  posizioni = [10, 40, 25, 30],
  turnoDi = 0,
  junior = [],
  cfgExtra = {},
  opzioni = {},
  reazioni = {},
  presenza = {},
  seme = 5,
  statoExtra = {}
} = {}) {
  const orologio = creaOrologio();
  const cfg = configSalmoSicura({ ...CONFIG.salmo, ...cfgExtra });

  const stato = creaStatoIniziale(posizioni.map((_, i) => ({ nome: 'G' + i, colore: 'rosso', junior: junior.includes(i) })));
  posizioni.forEach((p, i) => { stato.giocatori[i].posizione = p; });
  stato.turnoDi = turnoDi;
  Object.assign(stato, statoExtra);

  const decisione = valutaSalmo(stato, cfg);
  assert.equal(decisione.scatta, true, 'la prova di prova non scatta: ' + decisione.motivo);
  stato.salmo = contatoriDopoAvvio(stato);

  const sessione = creaSessione({
    decisione, cfg, idDisegni: ID_DISEGNI, adesso: orologio.adesso(), rng: generatoreConSeme(seme)
  });

  const mondo = {
    orologio, cfg, decisione, sessione,
    statoIniziale: structuredClone(stato),
    stato,
    registro: [],        // cosa e' successo, in ordine
    storia: [],          // gli stati pubblicati
    viste: [],           // cio' che e' stato mostrato sul tabellone
    animati: [],
    pulizie: 0,
    segreti: null,
    risposte: {},
    ascoltatori: new Set(),
    segnale: { annullato: false },
    presenza: { ...presenza },
    scartoOrario: 0,
    congelato: null,     // se non e' null, l'orologio del server resta fermo qui
    tempi: []            // l'istante (finto) di ogni pubblicazione
  };

  // ---- la rete finta ----
  const notifica = () => mondo.ascoltatori.forEach(cb => cb(mondo.risposte));
  const rete = {
    async scriviSegreti(s) {
      mondo.registro.push('segreti');
      if (opzioni.segretiFalliscono) throw new Error('rete assente');
      mondo.segreti = s;
    },
    ascolta(sid, cb) {
      mondo.ascoltatori.add(cb);
      cb(mondo.risposte);
      return () => mondo.ascoltatori.delete(cb);
    },
    async pulisci() {
      mondo.pulizie++;
      mondo.registro.push('pulisci');
      if (opzioni.pulisciNonRisponde) return new Promise(() => {});
    }
  };

  // ---- gli strumenti dei telefoni finti ----
  const soluzione = sessione.soluzione;
  const sbagliato = [soluzione[1], soluzione[0], ...soluzione.slice(2)];
  const ctxBase = {
    soluzione, sbagliato,
    primoId: decisione.primo,
    ultimoId: decisione.ultimo,
    mondo,
    dopo: (ms, fn) => orologio.programma(ms, fn),
    pronto(id) {
      const r = mondo.risposte;
      mondo.risposte = { ...r, pronto: { ...(r.pronto || {}), [id]: true } };
      notifica();
    },
    sbirciata() { mondo.risposte = { ...mondo.risposte, sbirciata: true }; notifica(); },
    // formato "array" come lo restituisce Firebase per chiavi dense 0..n
    consegna(n, ordine, extra = {}) {
      const r = mondo.risposte;
      const attuali = r.consegne ? (Array.isArray(r.consegne) ? [...r.consegne] : { ...r.consegne }) : [];
      attuali[n] = { ordine, ...extra };
      mondo.risposte = { ...r, consegne: attuali };
      notifica();
    },
    // formato "oggetto" (chiavi sparse): Firebase lo da' cosi' quando manca lo 0
    consegnaSparsa(n, ordine) {
      const r = mondo.risposte;
      mondo.risposte = { ...r, consegne: { ...(r.consegne && !Array.isArray(r.consegne) ? r.consegne : {}), [String(n)]: { ordine } } };
      notifica();
    },
    pronto2(id) {   // forma "oggetto" per i pronti (chiave sparsa)
      const r = mondo.risposte;
      mondo.risposte = { ...r, pronto: { ...(r.pronto || {}), [String(id)]: true } };
      notifica();
    }
  };

  const visti = new Set();

  // ---- l'ambiente che riceve il regista ----
  mondo.ambiente = {
    adesso: () => (mondo.congelato !== null ? mondo.congelato : orologio.adesso() + mondo.scartoOrario),
    getStato: () => {
      if (opzioni.getStatoLancia && mondo.registro.includes('pubblica:prova')) throw new Error('stato illeggibile');
      if (opzioni.getStatoLanciaDopoEsito && mondo.registro.includes('pubblica:esito')) throw new Error('stato illeggibile alla fine');
      return mondo.stato;
    },
    setStato: s => { mondo.stato = s; },
    async pubblica(s) {
      if (opzioni.pubblicaNonRisponde) return new Promise(() => {});
      if (opzioni.pubblicaFallisce && opzioni.pubblicaFallisce(s)) throw new Error('rete assente');
      mondo.storia.push(structuredClone(s));
      mondo.tempi.push(orologio.adesso());
      const p = s.salmoInCorso;
      if (p) {
        mondo.registro.push('pubblica:' + p.fase);
        const chiave = `${p.fase}:${p.tentativiFatti || 0}`;
        if (!visti.has(chiave)) {
          visti.add(chiave);
          const reazione = reazioni[p.fase];
          if (reazione) reazione({ ...ctxBase, pubblicato: p });
        }
      }
    },
    ultimaCasella: 63,
    presente: id => mondo.presenza[id] !== false,
    rete,
    ui: {
      mostra(v) {
        mondo.viste.push(structuredClone(v));
        if (opzioni.uiLancia) throw new Error('interfaccia rotta');
      },
      nascondi() { mondo.registro.push('ui:nascondi'); },
      suono(n) { mondo.registro.push('suono:' + n); },
      abbassaMusica() { mondo.registro.push('musica:giu'); },
      ripristinaMusica() { mondo.registro.push('musica:su'); },
      async anima(sp) {
        mondo.registro.push('anima');
        mondo.animati.push(sp);
        if (opzioni.animaNonFinisce) return new Promise(() => {});
      }
    }
  };

  mondo.ctx = ctxBase;
  mondo.notifica = notifica;
  return mondo;
}

// Lancia la prova e fa correre il tempo finche' non finisce.
async function esegui(mondo, limiteMs = 600_000) {
  let finito = false;
  let risultato = null;
  let errore = null;
  svolgiSalmo({
    decisione: mondo.decisione, cfg: mondo.cfg, sessione: mondo.sessione,
    ambiente: mondo.ambiente, segnale: mondo.segnale
  }).then(
    r => { risultato = r; finito = true; },
    e => { errore = e; finito = true; }
  );
  const partenza = mondo.orologio.adesso();
  while (!finito && mondo.orologio.adesso() - partenza < limiteMs) {
    await mondo.orologio.avanza(100);
  }
  if (!finito) throw new Error(`la prova non e' finita entro ${limiteMs / 1000} secondi di tempo finto`);
  if (errore) throw new Error('svolgiSalmo ha lanciato un errore (non deve MAI succedere): ' + errore.stack);
  mondo.risultato = risultato;
  mondo.durataFinta = mondo.orologio.adesso() - partenza;
  return risultato;
}

// Controlli che valgono per OGNI prova, comunque sia finita.
function controlliComuni(mondo) {
  const r = mondo.risultato;
  // 1. mai un errore, sempre un esito noto
  assert.ok(['successo', 'fallimento', 'annullato'].includes(r.esito), 'esito sconosciuto: ' + r.esito);
  assert.equal(typeof r.motivo, 'string');
  // 2. lo stato restituito non contiene piu' la prova in corso
  assert.equal(r.stato.salmoInCorso, undefined, 'salmoInCorso e\' rimasto nello stato finale');
  // 3. gli ascolti sono tutti staccati
  assert.equal(mondo.ascoltatori.size, 0, 'ascolto della rete non staccato');
  // 4. la musica e' abbassata e rialzata lo stesso numero di volte
  const giu = mondo.registro.filter(x => x === 'musica:giu').length;
  const su = mondo.registro.filter(x => x === 'musica:su').length;
  assert.equal(giu, su, `musica: ${giu} abbassamenti, ${su} ripristini`);
  // 5. nessuna posizione impossibile, nessun vincitore
  r.stato.giocatori.forEach(g => assert.ok(g.posizione >= 1 && g.posizione <= 62, 'posizione impossibile'));
  assert.equal(r.stato.vincitore == null, mondo.statoIniziale.vincitore == null, 'la prova ha cambiato il vincitore');
  // 6. le posizioni cambiano solo come previsto: l'ultimo non supera mai il primo
  const p = r.stato.giocatori[mondo.decisione.primo];
  const u = r.stato.giocatori[mondo.decisione.ultimo];
  assert.ok(u.posizione <= p.posizione, 'l\'ultimo ha superato il primo');
  // 7. chi non c'entra non si muove
  r.stato.giocatori.forEach((g, i) => {
    if (i !== mondo.decisione.primo && i !== mondo.decisione.ultimo) {
      assert.equal(g.posizione, mondo.statoIniziale.giocatori[i].posizione);
    }
  });
  // 8. lo schermo del tabellone non ha MAI ricevuto la soluzione ne' i riquadri
  for (const v of mondo.viste) {
    const testo = JSON.stringify(v);
    assert.equal('soluzione' in v, false, 'la soluzione e\' arrivata allo schermo del tabellone');
    for (const id of mondo.sessione.soluzione) {
      assert.equal(testo.includes(`"${id}"`), false, 'un riquadro (' + id + ') e\' arrivato allo schermo del tabellone');
    }
  }
  // 9. ogni stato pubblicato durante la prova tiene il turno "occupato"
  for (const s of mondo.storia) assert.equal(s.turnoInCorso, true);
  // 10. nulla di undefined nei dati pubblicati (Firebase rifiuterebbe tutta la scrittura)
  const haUndefined = (v) => {
    if (v === undefined) return true;
    if (Array.isArray(v)) return v.some(haUndefined);
    if (v && typeof v === 'object') return Object.values(v).some(haUndefined);
    return false;
  };
  for (const s of mondo.storia) assert.equal(haUndefined(s), false, 'undefined in uno stato pubblicato');
  // 11. i segreti vengono scritti PRIMA di qualunque pubblicazione
  const iSeg = mondo.registro.indexOf('segreti');
  const iPub = mondo.registro.findIndex(x => x.startsWith('pubblica:'));
  if (iPub >= 0) assert.ok(iSeg >= 0 && iSeg < iPub, 'i segreti vanno scritti prima della prima pubblicazione');
  // 12. almeno una pulizia all'inizio e una alla fine (salvo arresto forzato)
  if (!mondo.segnale.annullato) assert.ok(mondo.pulizie >= 2, 'pulizia mancante: ' + mondo.pulizie);
}

// Il tempo da lasciar passare per svuotare i timer rimasti e verificare che
// il regista non ne abbia lasciato in giro.
async function senzaCodaDiTimer(mondo) {
  await mondo.orologio.avanza(120_000);
  assert.equal(mondo.orologio.pendenti(), 0, 'il regista ha lasciato timer in sospeso');
}

// Riesegue lo stato iniziale e controlla che "chi non c'entra" sia identico,
// ignorando i soli campi che la prova e' autorizzata a toccare.
function assertStatoNonTocco(mondo, tollerati = []) {
  const a = structuredClone(mondo.statoIniziale);
  const b = structuredClone(mondo.risultato.stato);
  for (const k of ['turnoInCorso', 'salmo', 'salmoInCorso', ...tollerati]) { delete a[k]; delete b[k]; }
  a.giocatori.forEach(g => { delete g.posizione; });
  b.giocatori.forEach(g => { delete g.posizione; });
  assert.deepEqual(b, a);
}

// ---------------------------------------------------------------- il collaudo

const falliti = [];
let provati = 0;
async function prova(nome, fn) {
  provati++;
  const avvisi = [];
  console.warn = (...a) => avvisi.push(a.map(String).join(' '));
  let mondoUsato = null;
  try {
    await fn(m => { mondoUsato = m; return m; });
  } catch (e) {
    falliti.push({ nome, e });
    console.log(`  FAIL  ${nome}\n        ${String(e.stack || e.message).split('\n').slice(0, 6).join('\n        ')}`);
  } finally {
    console.warn = vero.warn;
    if (mondoUsato) mondoUsato.orologio.ripristina();
  }
}

// copioni di uso frequente
const subitoPronti = {
  pronti: c => { c.dopo(3000, () => c.pronto(c.primoId)); c.dopo(5000, () => c.pronto(c.ultimoId)); }
};
const conGiusta = (dopoMs) => ({
  ...subitoPronti,
  prova: c => c.dopo(dopoMs, () => c.consegna(c.pubblicato.tentativiFatti || 0, c.soluzione))
});

// =============== il percorso felice ===============

await prova('successo al primo tentativo: fasi in ordine, +10 all\'ultimo, turno passato', async (nuovo) => {
  const m = nuovo(creaMondo({ reazioni: conGiusta(20_000) }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  assert.equal(r.motivo, 'ordine-giusto');
  assert.equal(r.tentativi, 0);
  assert.equal(r.turnoPassato, true);
  assert.equal(r.stato.giocatori[0].posizione, 20);     // 10 + 10
  assert.equal(r.stato.giocatori[1].posizione, 40);     // il primo non si muove
  assert.equal(r.stato.turnoDi, 1);                      // la prova sostituisce il turno dell'ultimo
  assert.deepEqual(r.spostamenti, [{ id: 0, da: 10, a: 20 }]);
  assert.deepEqual(m.animati, [[{ id: 0, da: 10, a: 20 }]]);
  // le fasi, nell'ordine giusto, ognuna una volta (tranne "prova" che puo' ripetersi)
  const fasi = m.storia.map(s => s.salmoInCorso.fase);
  assert.deepEqual(fasi, ['pronti', 'anteprima', 'prova', 'esito']);
  assert.deepEqual(m.registro.filter(x => x.startsWith('suono:')), ['suono:corretto']);
  controlliComuni(m);
  assertStatoNonTocco(m, ['turnoDi']);
  await senzaCodaDiTimer(m);
});

await prova('i tempi seguono la configurazione: pronti 60s, anteprima 15s, prova 90s', async (nuovo) => {
  const m = nuovo(creaMondo({ reazioni: conGiusta(20_000) }));
  await esegui(m);
  const [pronti, anteprima, prova_, esito] = m.storia.map(s => s.salmoInCorso);
  assert.equal(pronti.scadenza - m.sessione.pubblica.scadenza + 60000 >= 0, true);
  assert.equal(anteprima.scadenza - pronti.scadenza < 60000, true, 'l\'anteprima deve partire appena sono pronti');
  assert.equal(prova_.scadenza > anteprima.scadenza, true);
  // le scadenze pubblicate sono "assolute": ora + durata
  assert.equal(anteprima.anteprimaMs, 15000);
  assert.equal(prova_.provaMs, 90000);
  assert.equal(esito.esitoMs, 8000);
  // livello normale: 16 riquadri
  assert.equal(pronti.riquadri, 16);
  controlliComuni(m);
});

await prova('successo al secondo tentativo: il primo errore NON chiude la prova', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => {
        const n = c.pubblicato.tentativiFatti || 0;
        if (n === 0) c.dopo(15_000, () => c.consegna(0, c.sbagliato));
        else c.dopo(10_000, () => c.consegna(1, c.soluzione));
      }
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  assert.equal(r.tentativi, 1);
  const prove = m.storia.filter(s => s.salmoInCorso.fase === 'prova').map(s => s.salmoInCorso.tentativiFatti);
  assert.deepEqual(prove, [0, 1], 'deve pubblicare il nuovo conteggio dei tentativi');
  assert.equal(r.stato.giocatori[0].posizione, 20);
  controlliComuni(m);
  await senzaCodaDiTimer(m);
});

await prova('fallimento: due tentativi sbagliati -> il primo torna indietro di 10 e l\'ultimo salta il turno', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => c.dopo(10_000, () => c.consegna(c.pubblicato.tentativiFatti || 0, c.sbagliato))
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'fallimento');
  assert.equal(r.motivo, 'tentativi-esauriti');
  assert.equal(r.tentativi, 2);
  assert.equal(r.stato.giocatori[1].posizione, 30);     // 40 - 10
  assert.equal(r.stato.giocatori[0].posizione, 10);     // l'ultimo non si muove
  assert.equal(r.stato.turnoDi, 1);                      // l'ultimo salta il turno
  assert.equal(r.turnoPassato, true);
  assert.deepEqual(m.registro.filter(x => x.startsWith('suono:')), ['suono:sbagliato']);
  controlliComuni(m);
  await senzaCodaDiTimer(m);
});

await prova('fallimento per tempo scaduto: la consegna automatica (sbagliata) arriva allo scadere', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => c.dopo(90_000, () => c.consegna(0, c.sbagliato, { auto: true }))
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'fallimento');
  assert.equal(r.motivo, 'tempo-scaduto');
  assert.equal(r.tentativi, 1);
  controlliComuni(m);
});

await prova('fallimento per tempo scaduto anche se non arriva nessuna consegna (telefono connesso)', async (nuovo) => {
  const m = nuovo(creaMondo({ reazioni: subitoPronti }));
  const r = await esegui(m);
  assert.equal(r.esito, 'fallimento');
  assert.equal(r.motivo, 'tempo-scaduto');
  assert.equal(r.stato.giocatori[1].posizione, 30);
  // il tempo totale non deve superare la somma delle fasi + grazia
  const massimo = 5000 + 15000 + 90000 + GRAZIA_CONSEGNA_FINALE_MS + 8000 + 8000 + 5000;
  assert.ok(m.durataFinta <= massimo, 'troppo lunga: ' + m.durataFinta);
  controlliComuni(m);
  await senzaCodaDiTimer(m);
});

await prova('la consegna automatica GIUSTA allo scadere (entro la grazia) vale come successo', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => c.dopo(90_000 + 1500, () => c.consegna(0, c.soluzione, { auto: true }))
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  controlliComuni(m);
});

await prova('una consegna che arriva DOPO la grazia viene ignorata', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => c.dopo(90_000 + GRAZIA_CONSEGNA_FINALE_MS + 2000, () => c.consegna(0, c.soluzione))
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'fallimento');
  assert.equal(r.motivo, 'tempo-scaduto');
  controlliComuni(m);
});

await prova('sbagliata allo scadere con un tentativo ancora disponibile: fallimento, niente terzo giro', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => c.dopo(90_500, () => c.consegna(c.pubblicato.tentativiFatti || 0, c.sbagliato, { auto: true }))
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'fallimento');
  assert.equal(r.motivo, 'tempo-scaduto');
  const prove = m.storia.filter(s => s.salmoInCorso.fase === 'prova');
  assert.equal(prove.length, 1, 'non deve riaprire un nuovo tentativo a tempo scaduto');
  controlliComuni(m);
});

await prova('livello bambini: 4 riquadri e tempi piu\' corti', async (nuovo) => {
  const m = nuovo(creaMondo({ junior: [0], reazioni: conGiusta(10_000) }));
  assert.equal(m.decisione.livello, 'bambini');
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  const p = m.storia[0].salmoInCorso;
  assert.equal(p.riquadri, 4);
  assert.equal(p.provaMs, 75000);
  assert.equal(p.anteprimaMs, 10000);
  assert.equal(m.sessione.soluzione.length, 4);
  controlliComuni(m);
});

await prova('la sbirciata viene registrata nel risultato', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => {
        c.dopo(5000, () => c.sbirciata());
        c.dopo(25_000, () => c.consegna(0, c.soluzione));
      }
    }
  }));
  const r = await esegui(m);
  assert.equal(r.sbirciata, true);
  assert.equal(r.esito, 'successo');
  controlliComuni(m);
});

await prova('i dati dei telefoni in forma "oggetto" (chiavi sparse di Firebase) si leggono lo stesso', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      pronti: c => { c.dopo(1000, () => c.pronto2(c.primoId)); c.dopo(1500, () => c.pronto2(c.ultimoId)); },
      prova: c => c.dopo(8000, () => c.consegnaSparsa(c.pubblicato.tentativiFatti || 0, c.soluzione))
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  controlliComuni(m);
});

await prova('successo con l\'ultimo vicinissimo al primo: non lo supera mai', async (nuovo) => {
  const m = nuovo(creaMondo({
    posizioni: [22, 42, 40, 41], cfgExtra: { distacchi: { finoA4: 20, finoA6: 22, finoA8: 24, finoA10: 26, finoA12: 28 } },
    reazioni: conGiusta(10_000)
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  assert.equal(r.stato.giocatori[0].posizione, 32);   // 22 + 10
  controlliComuni(m);
});

await prova('il bonus non supera il primo (valori di prova: distacco piccolo)', async (nuovo) => {
  const m = nuovo(creaMondo({
    posizioni: [10, 14, 12, 13], turnoDi: 0,
    cfgExtra: { distacchi: { finoA4: 3, finoA6: 3, finoA8: 3, finoA10: 3, finoA12: 3 } },
    reazioni: conGiusta(10_000)
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  assert.equal(r.stato.giocatori[0].posizione, 14);   // fermato al primo
  controlliComuni(m);
});

// =============== le annullamenti (nessuna conseguenza) ===============

function nessunaConseguenza(m, { turnoResta = true } = {}) {
  const r = m.risultato;
  assert.equal(r.esito, 'annullato');
  assert.equal(r.turnoPassato, false);
  assert.deepEqual(r.spostamenti, []);
  r.stato.giocatori.forEach((g, i) => assert.equal(g.posizione, m.statoIniziale.giocatori[i].posizione));
  if (turnoResta) assert.equal(r.stato.turnoDi, m.statoIniziale.turnoDi, 'il turno deve restare all\'ultimo, che tira il dado normalmente');
  assert.deepEqual(m.registro.filter(x => x.startsWith('suono:')), [], 'nessun suono di successo/fallimento');
}

await prova('il primo non preme "Sono pronto": prova annullata, l\'ultimo tira il dado normalmente', async (nuovo) => {
  const m = nuovo(creaMondo({ reazioni: { pronti: c => c.dopo(4000, () => c.pronto(c.ultimoId)) } }));
  const r = await esegui(m);
  assert.equal(r.motivo, 'primo-non-pronto');
  nessunaConseguenza(m);
  // dura circa prontoMs + il messaggio di annullamento
  assert.ok(m.durataFinta >= 60_000 && m.durataFinta <= 60_000 + DURATA_ANNULLAMENTO_MS + 3000, 'durata: ' + m.durataFinta);
  assert.deepEqual(m.storia.map(s => s.salmoInCorso.fase), ['pronti', 'esito']);
  controlliComuni(m);
  await senzaCodaDiTimer(m);
});

await prova('l\'ultimo non preme "Sono pronto": prova annullata senza conseguenze', async (nuovo) => {
  const m = nuovo(creaMondo({ reazioni: { pronti: c => c.dopo(2000, () => c.pronto(c.primoId)) } }));
  const r = await esegui(m);
  assert.equal(r.motivo, 'ultimo-non-pronto');
  nessunaConseguenza(m);
  controlliComuni(m);
});

await prova('nessuno dei due preme "Sono pronto": prova annullata', async (nuovo) => {
  const m = nuovo(creaMondo());
  const r = await esegui(m);
  assert.equal(r.motivo, 'nessuno-pronto');
  nessunaConseguenza(m);
  controlliComuni(m);
});

await prova('"Sono pronto" di un terzo giocatore o doppio tocco: non cambia nulla', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      pronti: c => {
        c.dopo(1000, () => c.pronto(2));
        c.dopo(1100, () => c.pronto(3));
        c.dopo(2000, () => c.pronto(c.primoId));
        c.dopo(2100, () => c.pronto(c.primoId));
      }
    }
  }));
  const r = await esegui(m);
  assert.equal(r.motivo, 'ultimo-non-pronto');
  nessunaConseguenza(m);
  controlliComuni(m);
});

await prova('"pronto" scritto prima che la prova esista (avanzo vecchio) non conta', async (nuovo) => {
  // Le risposte stanno sotto l'id della sessione: un avanzo di un'altra sessione non arriva mai.
  // Qui simuliamo che nel nodo ci sia soltanto cio' che e' stato scritto in questa sessione.
  const m = nuovo(creaMondo());
  const r = await esegui(m);
  assert.equal(r.esito, 'annullato');
  controlliComuni(m);
});

await prova('l\'ultimo si disconnette durante la prova (e non torna): annullata', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => c.dopo(20_000, () => { c.mondo.presenza[c.ultimoId] = false; })
    }
  }));
  const r = await esegui(m);
  assert.equal(r.motivo, 'ultimo-disconnesso');
  nessunaConseguenza(m);
  // se ne accorge dopo la tolleranza, non subito e non a fine prova
  const fineProvaTeorica = 5000 + 15000 + 90000;
  assert.ok(m.durataFinta < fineProvaTeorica, 'dovrebbe accorgersene prima della fine del tempo');
  controlliComuni(m);
  await senzaCodaDiTimer(m);
});

await prova('l\'ultimo "sparisce" per pochi secondi (ricarica la pagina) e torna: la prova continua', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => {
        c.dopo(10_000, () => { c.mondo.presenza[c.ultimoId] = false; });
        c.dopo(10_000 + TOLLERANZA_PRESENZA_MS - 3000, () => { c.mondo.presenza[c.ultimoId] = true; });
        c.dopo(40_000, () => c.consegna(0, c.soluzione));
      }
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  controlliComuni(m);
});

await prova('si disconnette e si riconnette due volte di seguito: la tolleranza riparte da zero', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => {
        const giu = ms => c.dopo(ms, () => { c.mondo.presenza[c.ultimoId] = false; });
        const su = ms => c.dopo(ms, () => { c.mondo.presenza[c.ultimoId] = true; });
        giu(5000); su(17_000);          // 12 s via
        giu(20_000); su(32_000);        // altri 12 s via (in tutto 24 s ma non di fila: la tolleranza e' 20 s)
        c.dopo(45_000, () => c.consegna(0, c.soluzione));
      }
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  controlliComuni(m);
});

await prova('il primo si disconnette durante l\'ANTEPRIMA (non torna): annullata', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      anteprima: c => c.dopo(1000, () => { c.mondo.presenza[c.primoId] = false; })
    }
  }));
  const r = await esegui(m);
  // l'anteprima dura 15 s, per il primo la tolleranza e' la meta' (7,5 s): se ne accorge prima della fine
  assert.equal(r.motivo, 'primo-disconnesso');
  assert.ok(m.durataFinta < 5000 + 15000, 'dovrebbe accorgersene prima della fine dell\'anteprima');
  nessunaConseguenza(m);
  controlliComuni(m);
});

await prova('il primo manca solo per 4 secondi durante l\'ANTEPRIMA e torna: la prova continua', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      anteprima: c => {
        c.dopo(1000, () => { c.mondo.presenza[c.primoId] = false; });
        c.dopo(5000, () => { c.mondo.presenza[c.primoId] = true; });
      },
      prova: c => c.dopo(30_000, () => c.consegna(0, c.soluzione))
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  controlliComuni(m);
  await senzaCodaDiTimer(m);
});

await prova('livello bambini (anteprima di 10 s): il primo che manca da subito e non torna fa annullare la prova dopo 5 s', async (nuovo) => {
  const m = nuovo(creaMondo({
    junior: [1],
    reazioni: {
      ...subitoPronti,
      anteprima: c => c.dopo(500, () => { c.mondo.presenza[c.primoId] = false; })
    }
  }));
  const r = await esegui(m);
  assert.equal(m.decisione.livello, 'bambini');
  assert.equal(r.motivo, 'primo-disconnesso');
  assert.ok(m.durataFinta < 5000 + 10000, 'dovrebbe accorgersene prima della fine dell\'anteprima (10 s)');
  nessunaConseguenza(m);
  controlliComuni(m);
});

// =============== telefoni con lo schermo spento ===============
// Un telefono che aspetta il suo turno con lo schermo spento risulta "scollegato".
// Quando il tabellone lo chiama, la persona lo riprende in mano: non e' un guasto.

await prova('l\'ultimo ha il telefono SPENTO (risulta scollegato) quando parte la prova, dopo 40 s lo riprende e preme «Sono pronto»: la prova va avanti', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      pronti: c => {
        c.mondo.presenza[c.ultimoId] = false;
        c.dopo(3000, () => c.pronto(c.primoId));
        c.dopo(40_000, () => { c.mondo.presenza[c.ultimoId] = true; });
        c.dopo(41_000, () => c.pronto(c.ultimoId));
      },
      prova: c => c.dopo(20_000, () => c.consegna(0, c.soluzione))
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  controlliComuni(m);
  await senzaCodaDiTimer(m);
});

await prova('anche il primo, con il telefono spento all\'inizio, ha tutto il tempo per svegliarlo e premere «Sono pronto»', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      pronti: c => {
        c.mondo.presenza[c.primoId] = false;
        c.dopo(2000, () => c.pronto(c.ultimoId));
        c.dopo(35_000, () => { c.mondo.presenza[c.primoId] = true; });
        c.dopo(36_000, () => c.pronto(c.primoId));
      },
      prova: c => c.dopo(20_000, () => c.consegna(0, c.soluzione))
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  controlliComuni(m);
  await senzaCodaDiTimer(m);
});

await prova('il telefono dell\'ultimo non si risveglia mai: la prova si annulla alla scadenza dei 60 s di attesa (non prima)', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      pronti: c => {
        c.mondo.presenza[c.ultimoId] = false;
        c.dopo(3000, () => c.pronto(c.primoId));
      }
    }
  }));
  const r = await esegui(m);
  assert.equal(r.motivo, 'ultimo-non-pronto');
  assert.ok(m.durataFinta >= m.cfg.prontoMs, `ha rinunciato troppo presto (${m.durataFinta} ms)`);
  nessunaConseguenza(m);
  controlliComuni(m);
  await senzaCodaDiTimer(m);
});

await prova('lo schermo dell\'ultimo si spegne per 15 secondi in mezzo alla prova e poi si riaccende: la prova continua', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => {
        c.dopo(10_000, () => { c.mondo.presenza[c.ultimoId] = false; });
        c.dopo(25_000, () => { c.mondo.presenza[c.ultimoId] = true; });
        c.dopo(40_000, () => c.consegna(0, c.soluzione));
      }
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  controlliComuni(m);
  await senzaCodaDiTimer(m);
});

await prova('il primo si disconnette durante la PROVA: non importa, descrive a voce, la prova continua', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => {
        c.dopo(5000, () => { c.mondo.presenza[c.primoId] = false; });
        c.dopo(30_000, () => c.consegna(0, c.soluzione));
      }
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  controlliComuni(m);
});

await prova('il primo abbandona la partita durante la prova: annullata', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => c.dopo(20_000, () => { c.mondo.stato.giocatori[c.primoId].abbandonato = true; })
    }
  }));
  const r = await esegui(m);
  assert.equal(r.motivo, 'abbandono');
  nessunaConseguenza(m);
  assert.equal(r.stato.giocatori[1].abbandonato, true, 'l\'abbandono deve restare nello stato');
  controlliComuni(m);
});

await prova('l\'ultimo abbandona durante l\'anteprima: annullata', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      anteprima: c => c.dopo(3000, () => { c.mondo.stato.giocatori[c.ultimoId].abbandonato = true; })
    }
  }));
  const r = await esegui(m);
  assert.equal(r.motivo, 'abbandono');
  nessunaConseguenza(m);
  controlliComuni(m);
});

await prova('un TERZO giocatore abbandona durante la prova: la prova continua e l\'abbandono resta', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => {
        c.dopo(10_000, () => { c.mondo.stato.giocatori[3].abbandonato = true; });
        c.dopo(30_000, () => c.consegna(0, c.soluzione));
      }
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  assert.equal(r.stato.giocatori[3].abbandonato, true, 'l\'abbandono del terzo non deve andare perso');
  controlliComuni(m);
});

await prova('compare un vincitore nello stato durante la prova: annullata', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => c.dopo(10_000, () => { c.mondo.stato.vincitore = 2; })
    }
  }));
  const r = await esegui(m);
  assert.equal(r.motivo, 'partita-finita');
  assert.equal(r.esito, 'annullato');
  assert.deepEqual(r.spostamenti, []);
  assert.equal(r.turnoPassato, false);
  assert.equal(r.stato.vincitore, 2, 'il vincitore non deve sparire');
  assert.equal(r.stato.giocatori[0].posizione, 10);
  assert.equal(r.stato.giocatori[1].posizione, 40);
  await senzaCodaDiTimer(m);
});

// =============== rete e guasti ===============

await prova('i segreti non si riescono a scrivere: annullata PRIMA di mostrare qualunque cosa', async (nuovo) => {
  const m = nuovo(creaMondo({ opzioni: { segretiFalliscono: true } }));
  const r = await esegui(m);
  assert.equal(r.esito, 'annullato');
  assert.equal(r.motivo, 'errore-rete');
  assert.equal(m.storia.length, 0, 'non deve pubblicare nulla se i segreti non sono al sicuro');
  assert.equal(m.viste.length, 0);
  assert.equal(r.stato.turnoDi, 0);
  assert.equal(r.turnoPassato, false);
  assert.equal(m.ascoltatori.size, 0);
  await senzaCodaDiTimer(m);
});

await prova('Firebase non conferma mai le pubblicazioni: annullata entro pochi secondi, mai appesa', async (nuovo) => {
  const m = nuovo(creaMondo({ opzioni: { pubblicaNonRisponde: true } }));
  const r = await esegui(m);
  assert.equal(r.esito, 'annullato');
  assert.equal(r.motivo, 'errore-rete');
  assert.ok(m.durataFinta < 2 * LIMITE_PUBBLICAZIONE_MS + DURATA_ANNULLAMENTO_MS + 8000, 'ci ha messo troppo: ' + m.durataFinta);
  assert.equal(m.ascoltatori.size, 0);
  assert.equal(r.stato.salmoInCorso, undefined);
  await senzaCodaDiTimer(m);
});

await prova('la rete cade durante la prova (una pubblicazione fallisce): annullata, mai fallimento ingiusto', async (nuovo) => {
  let primaSbagliata = false;
  const m = nuovo(creaMondo({
    opzioni: {
      // fallisce la pubblicazione del secondo giro di "prova" (dopo un tentativo sbagliato)
      pubblicaFallisce: s => {
        const p = s.salmoInCorso;
        return !!p && p.fase === 'prova' && p.tentativiFatti === 1;
      }
    },
    reazioni: {
      ...subitoPronti,
      prova: c => { if (!c.pubblicato.tentativiFatti) c.dopo(10_000, () => { primaSbagliata = true; c.consegna(0, c.sbagliato); }); }
    }
  }));
  const r = await esegui(m);
  assert.ok(primaSbagliata);
  assert.equal(r.esito, 'annullato');
  assert.equal(r.motivo, 'errore-rete');
  nessunaConseguenza(m);
  controlliComuni(m);
});

await prova('consegne rovinate (lunghezza sbagliata, doppioni, roba strana) vengono ignorate e non contano come tentativo', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => {
        const s = c.soluzione;
        c.dopo(5000, () => c.consegna(0, s.slice(0, 5)));
        c.dopo(6000, () => c.consegna(0, [s[0], s[0], ...s.slice(2)]));
        c.dopo(7000, () => c.consegna(0, 'ciao'));
        c.dopo(8000, () => c.consegna(0, null));
        c.dopo(9000, () => c.consegna(0, s.map(() => 'inventato')));
        c.dopo(20_000, () => c.consegna(0, s));
      }
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  assert.equal(r.tentativi, 0, 'le consegne rovinate non devono consumare tentativi');
  controlliComuni(m);
});

await prova('una consegna rovinata al posto di quella finale non rompe nulla: fallimento per tempo', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => c.dopo(91_000, () => c.consegna(0, [1, 2, 3], { auto: true }))
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'fallimento');
  assert.equal(r.motivo, 'tempo-scaduto');
  controlliComuni(m);
});

await prova('una consegna per il tentativo SBAGLIATO (indice avanti) non viene letta prima del tempo', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => {
        // un telefono impazzito scrive subito la consegna n.1 corretta: non deve valere come n.0
        c.dopo(5000, () => c.consegna(1, c.soluzione));
      }
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'fallimento');
  controlliComuni(m);
});

await prova('i telefoni scrivono la consegna giusta DUE volte: conta una volta sola', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => {
        c.dopo(10_000, () => c.consegna(0, c.soluzione));
        c.dopo(10_100, () => c.consegna(0, c.soluzione));
        c.dopo(10_200, () => c.consegna(0, c.sbagliato));    // tardiva e sbagliata: ignorata
      }
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  assert.deepEqual(m.animati, [[{ id: 0, da: 10, a: 20 }]], 'deve animare una sola volta');
  controlliComuni(m);
});

await prova('l\'ultimo sparisce proprio negli ultimi secondi e non consegna: annullata (non fallimento ingiusto)', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => c.dopo(88_000, () => { c.mondo.presenza[c.ultimoId] = false; })
    }
  }));
  const r = await esegui(m);
  assert.equal(r.motivo, 'ultimo-disconnesso');
  nessunaConseguenza(m);
  controlliComuni(m);
});

await prova('"pronto: false" scritto da un telefono non vale come pronto', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      pronti: c => c.dopo(2000, () => {
        c.mondo.risposte = { pronto: { [c.primoId]: false, [c.ultimoId]: true } };
        c.mondo.notifica();
      })
    }
  }));
  const r = await esegui(m);
  assert.equal(r.motivo, 'primo-non-pronto');
  nessunaConseguenza(m);
});

await prova('la prima pubblicazione della fase "prova" non riesce: annullata, nessuna conseguenza', async (nuovo) => {
  const m = nuovo(creaMondo({
    opzioni: { pubblicaFallisce: s => !!s.salmoInCorso && s.salmoInCorso.fase === 'prova' && !s.salmoInCorso.tentativiFatti },
    reazioni: subitoPronti
  }));
  const r = await esegui(m);
  assert.equal(r.motivo, 'errore-rete');
  nessunaConseguenza(m);
  controlliComuni(m);
});

// =============== arresto, guasti interni, orologio ===============

await prova('arresto forzato a meta\' prova: si ferma subito e non pubblica piu\' niente', async (nuovo) => {
  const m = nuovo(creaMondo({ reazioni: subitoPronti }));
  let pubblicazioniAlloStop = null;
  m.orologio.programma(30_000, () => { pubblicazioniAlloStop = m.storia.length; m.segnale.annullato = true; });
  const r = await esegui(m);
  assert.equal(r.esito, 'annullato');
  assert.equal(r.motivo, 'fermato');
  assert.equal(m.storia.length, pubblicazioniAlloStop, 'ha pubblicato dopo lo stop');
  assert.ok(m.durataFinta < 32_000, 'doveva fermarsi subito: ' + m.durataFinta);
  assert.equal(m.ascoltatori.size, 0);
  assert.equal(r.stato.salmoInCorso, undefined);
  const giu = m.registro.filter(x => x === 'musica:giu').length;
  const su = m.registro.filter(x => x === 'musica:su').length;
  assert.equal(giu, su);
  await senzaCodaDiTimer(m);
});

await prova('arresto forzato: nessuna schermata riaccesa dopo lo stop', async (nuovo) => {
  const m = nuovo(creaMondo({ reazioni: subitoPronti }));
  let visteAlloStop = 0;
  m.orologio.programma(30_000, () => { visteAlloStop = m.viste.length; m.segnale.annullato = true; });
  await esegui(m);
  assert.equal(m.viste.length, visteAlloStop);
});

await prova('l\'orologio del server fa un salto in avanti di 10 minuti: annullata per timeout generale', async (nuovo) => {
  const m = nuovo(creaMondo({
    reazioni: {
      ...subitoPronti,
      prova: c => c.dopo(20_000, () => { c.mondo.scartoOrario = 10 * 60 * 1000; })
    }
  }));
  const r = await esegui(m);
  assert.equal(r.esito, 'annullato');
  assert.equal(r.motivo, 'timeout-generale');
  nessunaConseguenza(m);
  controlliComuni(m);
});

await prova('l\'orologio del server resta fermo (si blocca): il cronometro locale annulla comunque', async (nuovo) => {
  const m = nuovo(creaMondo({ reazioni: subitoPronti }));
  // blocco l'orologio del server dal momento in cui parte la prova
  m.orologio.programma(25_000, () => { m.congelato = m.orologio.adesso(); });
  const r = await esegui(m, 900_000);
  assert.equal(r.esito, 'annullato');
  assert.equal(r.motivo, 'timeout-generale');
  controlliComuni(m);
});

await prova('gli errori dell\'interfaccia non fermano la prova', async (nuovo) => {
  const m = nuovo(creaMondo({ opzioni: { uiLancia: true }, reazioni: conGiusta(15_000) }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  controlliComuni(m);
});

await prova('l\'animazione che non finisce mai non blocca la partita', async (nuovo) => {
  const m = nuovo(creaMondo({ opzioni: { animaNonFinisce: true }, reazioni: conGiusta(15_000) }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  assert.ok(m.durataFinta < 5000 + 15000 + 15000 + 8000 + 8000 + 6000);
  await senzaCodaDiTimer(m);
});

await prova('la pulizia su Firebase che non risponde non blocca la partita', async (nuovo) => {
  const m = nuovo(creaMondo({ opzioni: { pulisciNonRisponde: true }, reazioni: conGiusta(15_000) }));
  const r = await esegui(m);
  // la pulizia iniziale non risponde: annulla per errore di rete invece di restare appesa
  assert.equal(r.esito, 'annullato');
  assert.equal(r.motivo, 'errore-rete');
  assert.equal(m.storia.length, 0);
  await senzaCodaDiTimer(m);
});

await prova('errore imprevisto (lo stato diventa illeggibile): non lancia, restituisce uno stato valido', async (nuovo) => {
  const m = nuovo(creaMondo({ opzioni: { getStatoLancia: true }, reazioni: subitoPronti }));
  const r = await esegui(m);
  assert.equal(r.esito, 'annullato');
  assert.equal(r.motivo, 'errore-interno');
  assert.ok(r.stato, 'serve uno stato da restituire');
  assert.deepEqual(r.spostamenti, []);
  assert.equal(r.turnoPassato, false);
  assert.equal(m.registro.filter(x => x === 'musica:giu').length, m.registro.filter(x => x === 'musica:su').length, 'la musica deve tornare a posto anche dopo un errore');
  assert.equal(m.ascoltatori.size, 0);
  await senzaCodaDiTimer(m);
});

await prova('lo stato diventa illeggibile solo a prova finita: il risultato e\' comunque quello giusto', async (nuovo) => {
  const m = nuovo(creaMondo({ opzioni: { getStatoLanciaDopoEsito: true }, reazioni: conGiusta(15_000) }));
  const r = await esegui(m);
  assert.equal(r.esito, 'successo');
  assert.equal(r.stato.giocatori[0].posizione, 20);
  assert.equal(r.stato.salmoInCorso, undefined);
  await senzaCodaDiTimer(m);
});

// =============== ordine degli eventi sullo schermo ===============

await prova('lo schermo del tabellone: ordine delle schermate e musica abbassata solo durante la prova', async (nuovo) => {
  const m = nuovo(creaMondo({ reazioni: conGiusta(20_000) }));
  await esegui(m);
  const fasiViste = [];
  for (const v of m.viste) if (fasiViste[fasiViste.length - 1] !== v.fase) fasiViste.push(v.fase);
  assert.deepEqual(fasiViste, ['pronti', 'anteprima', 'prova', 'esito']);
  const iGiu = m.registro.indexOf('musica:giu');
  const iSu = m.registro.indexOf('musica:su');
  const iProva = m.registro.indexOf('pubblica:prova');
  const iEsito = m.registro.indexOf('pubblica:esito');
  assert.ok(iGiu > iProva && iGiu < iEsito, 'la musica si abbassa all\'inizio della prova');
  assert.ok(iSu > iGiu && iSu < iEsito, 'la musica torna a posto prima dell\'esito');
  // "pronti" mostrato con la spunta di chi e' pronto
  const pronti = m.viste.filter(v => v.fase === 'pronti');
  assert.ok(pronti.some(v => v.primoPronto && !v.ultimoPronto));
  assert.ok(pronti.some(v => v.primoPronto && v.ultimoPronto));
  // nomi per esteso
  assert.equal(pronti[0].primoNome, 'G1');
  assert.equal(pronti[0].ultimoNome, 'G0');
  // il suono arriva prima della schermata di esito e il nascondi alla fine
  assert.ok(m.registro.indexOf('suono:corretto') > iEsito - 1);
  assert.ok(m.registro.indexOf('ui:nascondi') > m.registro.indexOf('suono:corretto'));
  assert.ok(m.registro.indexOf('anima') > m.registro.indexOf('ui:nascondi'), 'prima si chiude la schermata, poi si muovono le pedine');
  controlliComuni(m);
});

await prova('lo stato pubblicato in "esito" contiene la soluzione solo per successo/fallimento, mai per annullata', async (nuovo) => {
  const a = nuovo(creaMondo({ reazioni: conGiusta(10_000) }));
  await esegui(a);
  const esitoA = a.storia.filter(s => s.salmoInCorso.fase === 'esito')[0].salmoInCorso;
  assert.deepEqual(esitoA.soluzione, a.sessione.soluzione);
  a.orologio.ripristina();

  const b = nuovo(creaMondo());
  await esegui(b);
  const esitoB = b.storia.filter(s => s.salmoInCorso.fase === 'esito')[0].salmoInCorso;
  assert.equal('soluzione' in esitoB, false);
  assert.equal(esitoB.esito, 'annullato');

  // nelle fasi precedenti la soluzione non viaggia mai nello stato pubblico
  for (const s of a.storia.filter(x => x.salmoInCorso.fase !== 'esito')) {
    assert.equal('soluzione' in s.salmoInCorso, false);
    assert.equal(JSON.stringify(s).includes('mescolata'), false);
  }
});

await prova('le scadenze pubblicate sono "istante di pubblicazione + durata della fase" e stanno dentro la scadenza massima', async (nuovo) => {
  const m = nuovo(creaMondo({ reazioni: conGiusta(30_000) }));
  await esegui(m);
  const p = m.storia.map(s => s.salmoInCorso);
  assert.deepEqual(p.map(x => x.fase), ['pronti', 'anteprima', 'prova', 'esito']);
  assert.equal(p[0].scadenza - m.tempi[0], 60_000);
  assert.equal(p[1].scadenza - m.tempi[1], 15_000);
  assert.equal(p[2].scadenza - m.tempi[2], 90_000);
  assert.equal(p[3].scadenza - m.tempi[3], 8_000);
  assert.ok(p.every(x => x.scadenza <= x.scadenzaMassima), 'una scadenza supera la scadenza massima');
  controlliComuni(m);
});

await prova('lo stato non pubblicato alla fine: l\'orchestratore NON pubblica lo stato finale (lo fa il turno)', async (nuovo) => {
  const m = nuovo(creaMondo({ reazioni: conGiusta(10_000) }));
  const r = await esegui(m);
  const ultimaPubblicata = m.storia[m.storia.length - 1];
  assert.equal(ultimaPubblicata.salmoInCorso.fase, 'esito');
  // le posizioni pubblicate in "esito" sono ancora quelle di prima (si animano dopo)
  assert.equal(ultimaPubblicata.giocatori[0].posizione, 10);
  assert.equal(r.stato.giocatori[0].posizione, 20);
});

await prova('i contatori dello stato (salmo) passano invariati', async (nuovo) => {
  const m = nuovo(creaMondo({ reazioni: conGiusta(10_000) }));
  const r = await esegui(m);
  assert.deepEqual(r.stato.salmo, m.statoIniziale.salmo);
  assert.deepEqual(r.stato.salmo, { avviati: 1, turni: 0, ultimoAvvio: 0 });
});

await prova('conLimite: risolve, rifiuta o scade, e non lascia timer', async (nuovo) => {
  const orologio = creaOrologio();
  const m = nuovo({ orologio });
  const ok = await conLimite(async () => 42, 1000);
  assert.equal(ok, 42);
  await assert.rejects(conLimite(async () => { throw new Error('boom'); }, 1000), /boom/);
  await assert.rejects(conLimite(() => { throw new Error('subito'); }, 1000), /subito/);
  let scaduto = false;
  const p = conLimite(() => new Promise(() => {}), 1000).catch(() => { scaduto = true; });
  await orologio.avanza(1500);
  await p;
  assert.equal(scaduto, true);
  assert.equal(orologio.pendenti(), 0);
});

// =============== riepilogo ===============

console.log(`\nSalmo 133:1 — regista: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche del regista passate');
