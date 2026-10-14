// test-salmo-schermo.mjs
// Prove di "schermo acceso" (js/salmo/schermo-acceso.js): durante COLLABORIAMO! il
// telefono dei due protagonisti non deve spegnere lo schermo. Si lancia con:
//   node test-salmo-schermo.mjs
//
// Niente telefono vero: navigator e document sono FINTI e fanno quello che fanno i
// telefoni (concedono il blocco, lo rilasciano quando la pagina va in secondo piano,
// rifiutano se hanno il risparmio energetico...).

import assert from 'node:assert/strict';
import { creaSchermoAcceso } from './js/salmo/schermo-acceso.js';

let provati = 0;
const falliti = [];
async function prova(nome, fn) {
  provati++;
  try { await fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.stack || e.message).split('\n').slice(0, 5).join('\n        ')}`); }
}

const respira = async () => { for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); };

function creaFinti({ nascosta = false, rifiuta = false, sincrono = false } = {}) {
  const documento = {
    visibilityState: nascosta ? 'hidden' : 'visible',
    ascoltatori: new Set(),
    addEventListener(nome, f) { if (nome === 'visibilitychange') this.ascoltatori.add(f); },
    removeEventListener(nome, f) { this.ascoltatori.delete(f); },
    cambia(stato) { this.visibilityState = stato; [...this.ascoltatori].forEach(f => f()); }
  };
  const blocchi = [];
  const stato = { rifiuta, richieste: 0, attesa: null };
  const navigatore = {
    wakeLock: {
      request(tipo) {
        stato.richieste++;
        if (sincrono) throw new Error('errore subito, non in una promessa');
        const crea = () => {
          if (stato.rifiuta) throw new Error('NotAllowedError');
          const ascoltatori = [];
          const b = {
            tipo, released: false,
            addEventListener(nome, f) { if (nome === 'release') ascoltatori.push(f); },
            async release() { if (this.released) return; this.released = true; ascoltatori.forEach(f => f()); }
          };
          blocchi.push(b);
          return b;
        };
        if (stato.attesa) return stato.attesa.then(crea);      // richiesta "lenta"
        return Promise.resolve().then(crea);
      }
    }
  };
  const attivi = () => blocchi.filter(b => !b.released).length;
  // il telefono lascia andare tutto quando la pagina va in secondo piano
  const rilasciaTutti = () => blocchi.filter(b => !b.released).forEach(b => b.release());
  return { documento, navigatore, blocchi, stato, attivi, rilasciaTutti };
}

const nuovo = (finti) => creaSchermoAcceso({ navigator: finti.navigatore, document: finti.documento });

await prova('accendi chiede il blocco "screen"; spegni lo rilascia', async () => {
  const f = creaFinti();
  const s = nuovo(f);
  s.accendi();
  await respira();
  assert.equal(f.attivi(), 1);
  assert.equal(f.blocchi[0].tipo, 'screen');
  assert.deepEqual(s.stato(), { voluto: true, attivo: true, inRichiesta: false });
  s.spegni();
  await respira();
  assert.equal(f.attivi(), 0);
  assert.equal(f.documento.ascoltatori.size, 0, 'ascolto della visibilita\' non tolto');
  assert.deepEqual(s.stato(), { voluto: false, attivo: false, inRichiesta: false });
});

await prova('accendi piu\' volte (e tocchi in mezzo): una sola richiesta, un solo blocco', async () => {
  const f = creaFinti();
  const s = nuovo(f);
  s.accendi(); s.accendi(); s.accendi();
  s.riprova(); s.riprova();
  await respira();
  s.riprova();
  await respira();
  assert.equal(f.stato.richieste, 1);
  assert.equal(f.attivi(), 1);
  assert.equal(f.documento.ascoltatori.size, 1, 'un solo ascolto della visibilita\'');
  s.spegni();
});

await prova('pagina in secondo piano: il telefono lascia il blocco, al ritorno viene richiesto di nuovo', async () => {
  const f = creaFinti();
  const s = nuovo(f);
  s.accendi();
  await respira();
  assert.equal(f.attivi(), 1);
  f.documento.visibilityState = 'hidden';
  f.rilasciaTutti();
  await respira();
  assert.equal(f.attivi(), 0);
  assert.equal(s.stato().attivo, false, 'il blocco rilasciato dal telefono va dimenticato');
  f.documento.cambia('visible');
  await respira();
  assert.equal(f.attivi(), 1);
  assert.equal(f.blocchi.length, 2);
  s.spegni();
  await respira();
  assert.equal(f.attivi(), 0);
});

await prova('se la pagina e\' nascosta quando si accende: niente richiesta, poi la fa quando torna visibile', async () => {
  const f = creaFinti({ nascosta: true });
  const s = nuovo(f);
  s.accendi();
  await respira();
  assert.equal(f.stato.richieste, 0);
  f.documento.cambia('visible');
  await respira();
  assert.equal(f.attivi(), 1);
  s.spegni();
});

await prova('ritorno visibile DOPO spegni: non chiede piu\' nulla', async () => {
  const f = creaFinti();
  const s = nuovo(f);
  s.accendi();
  await respira();
  s.spegni();
  await respira();
  f.documento.cambia('hidden');
  f.documento.cambia('visible');
  await respira();
  assert.equal(f.stato.richieste, 1);
  assert.equal(f.attivi(), 0);
});

await prova('richiesta rifiutata: nessun errore; al tocco successivo, se il telefono accetta, il blocco c\'e\'', async () => {
  const f = creaFinti({ rifiuta: true });
  const s = nuovo(f);
  s.accendi();
  await respira();
  assert.equal(f.attivi(), 0);
  assert.equal(s.stato().inRichiesta, false, 'la richiesta fallita non deve restare "in viaggio"');
  s.riprova();
  await respira();
  assert.equal(f.attivi(), 0);
  assert.equal(f.stato.richieste, 2, 'ogni tocco ritenta');
  f.stato.rifiuta = false;
  s.riprova();
  await respira();
  assert.equal(f.attivi(), 1);
  s.spegni();
});

await prova('telefono senza la funzione: non succede niente, nemmeno un errore', async () => {
  for (const nav of [{}, { wakeLock: undefined }, { wakeLock: {} }, { wakeLock: { request: 'non una funzione' } }, null]) {
    const s = creaSchermoAcceso({ navigator: nav, document: creaFinti().documento });
    assert.doesNotThrow(() => { s.accendi(); s.riprova(); s.spegni(); });
    await respira();
    assert.equal(s.stato().attivo, false);
  }
});

await prova('"wakeLock" che lancia un errore quando lo si legge: ignorato', async () => {
  const nav = { get wakeLock() { throw new Error('guasto strano'); } };
  const s = creaSchermoAcceso({ navigator: nav, document: creaFinti().documento });
  assert.doesNotThrow(() => { s.accendi(); s.riprova(); s.spegni(); });
  await respira();
});

await prova('request che lancia subito (non in una promessa): ignorato', async () => {
  const f = creaFinti({ sincrono: true });
  const s = nuovo(f);
  assert.doesNotThrow(() => { s.accendi(); s.riprova(); });
  await respira();
  assert.equal(f.attivi(), 0);
  assert.equal(s.stato().inRichiesta, false);
  s.spegni();
});

await prova('spegni mentre la richiesta e\' ancora in viaggio: appena concesso, il blocco viene rilasciato', async () => {
  const f = creaFinti();
  let sblocca;
  f.stato.attesa = new Promise(r => { sblocca = r; });
  const s = nuovo(f);
  s.accendi();
  await respira();
  assert.equal(s.stato().inRichiesta, true);
  s.spegni();
  sblocca();
  await respira();
  assert.equal(f.blocchi.length, 1);
  assert.equal(f.attivi(), 0, 'il blocco concesso in ritardo e\' rimasto attivo');
  assert.equal(s.stato().attivo, false);
});

await prova('spegni e riaccendi mentre la richiesta e\' in viaggio: alla fine un solo blocco, attivo', async () => {
  const f = creaFinti();
  let sblocca;
  f.stato.attesa = new Promise(r => { sblocca = r; });
  const s = nuovo(f);
  s.accendi();
  await respira();
  s.spegni();
  s.accendi();
  sblocca();
  await respira();
  assert.equal(f.attivi(), 1);
  s.spegni();
  await respira();
  assert.equal(f.attivi(), 0);
});

await prova('spegni senza aver mai acceso: niente da fare, niente errori', async () => {
  const f = creaFinti();
  const s = nuovo(f);
  assert.doesNotThrow(() => { s.spegni(); s.spegni(); s.riprova(); });
  await respira();
  assert.equal(f.stato.richieste, 0);
});

await prova('riprova senza aver acceso (o dopo spegni) non chiede nulla', async () => {
  const f = creaFinti();
  const s = nuovo(f);
  s.riprova();
  await respira();
  s.accendi(); await respira(); s.spegni(); await respira();
  s.riprova();
  await respira();
  assert.equal(f.stato.richieste, 1);
  assert.equal(f.attivi(), 0);
});

await prova('document senza addEventListener (ambiente strano): funziona lo stesso', async () => {
  const f = creaFinti();
  const s = creaSchermoAcceso({ navigator: f.navigatore, document: { visibilityState: 'visible' } });
  assert.doesNotThrow(() => { s.accendi(); s.spegni(); });
  await respira();
  assert.equal(f.attivi(), 0);
});

await prova('release che lancia o che fallisce: ignorato', async () => {
  const f = creaFinti();
  const s = nuovo(f);
  s.accendi();
  await respira();
  f.blocchi[0].release = () => { throw new Error('release rotto'); };
  assert.doesNotThrow(() => s.spegni());
  const g = creaFinti();
  const t = nuovo(g);
  t.accendi();
  await respira();
  g.blocchi[0].release = () => Promise.reject(new Error('release che fallisce'));
  assert.doesNotThrow(() => t.spegni());
  await respira();
});

console.log(`\nSalmo 133:1 — schermo acceso: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
