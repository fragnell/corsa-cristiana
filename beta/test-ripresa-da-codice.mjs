// test-ripresa-da-codice.mjs
// Prove di "riprendere una partita scrivendo il suo codice" (js/ripresa-da-codice.js): la parte che decide
// se quella partita si puo' riprendere. Si lancia con:  node test-ripresa-da-codice.mjs
//
// Niente Firebase vero: lo stato delle partite e i tabelloni collegati sono FINTI.

import assert from 'node:assert/strict';
import { controllaRipresaDaCodice, normalizzaCodice, LIMITE_RIPRESA_DA_CODICE_MS, MESSAGGI_RIPRESA } from './js/ripresa-da-codice.js';

let provati = 0;
const falliti = [];
async function prova(nome, fn) {
  provati++;
  try { await fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.stack || e.message).split('\n').slice(0, 5).join('\n        ')}`); }
}

const ADESSO = 1_800_000_000_000;
const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;

// Un "database" finto: partite[codice] = stato; collegati = i codici con un tabellone presente
function creaFinti({ partite = {}, collegati = [], errore = null } = {}) {
  const chiamate = { leggiStato: [], tabellonePresente: [] };
  return {
    chiamate,
    leggiStato: async (codice) => {
      chiamate.leggiStato.push(codice);
      if (errore) throw new Error(errore);
      return partite[codice] === undefined ? null : partite[codice];
    },
    tabellonePresente: async (codice) => {
      chiamate.tabellonePresente.push(codice);
      if (errore === 'presenza') throw new Error('rete');
      return collegati.includes(codice);
    },
    adesso: () => ADESSO
  };
}
const statoDa = (extra = {}) => ({ giocatori: [{ nome: 'Anna' }, { nome: 'Bruno' }], turnoDi: 0, vincitore: null, ultimoAggiornamento: ADESSO - 5 * MINUTO, ...extra });

await prova('normalizzaCodice: toglie gli spazi e mette in maiuscolo', () => {
  assert.equal(normalizzaCodice('  abcd '), 'ABCD');
  assert.equal(normalizzaCodice('Xy zw'), 'XY ZW');
  assert.equal(normalizzaCodice(null), '');
  assert.equal(normalizzaCodice(undefined), '');
  assert.equal(normalizzaCodice(1234), '1234');
});

await prova('una partita ferma da pochi minuti, senza tabellone collegato, si riprende', async () => {
  const f = creaFinti({ partite: { ABCD: statoDa() } });
  const r = await controllaRipresaDaCodice('abcd', f);
  assert.deepEqual(r, { ok: true, codice: 'ABCD' });
});

await prova('il codice scritto in minuscolo e con spazi vale lo stesso', async () => {
  const f = creaFinti({ partite: { QRST: statoDa() } });
  assert.equal((await controllaRipresaDaCodice('  qrst ', f)).ok, true);
});

await prova('formato sbagliato: non si interroga nemmeno Firebase', async () => {
  const f = creaFinti({ partite: { ABCD: statoDa() } });
  for (const brutto of ['', '   ', 'ABC', 'ABCDE', 'AB1D', 'ABIB', 'ABOB', 'A B C D', 'ABCD!', '../..', '<b>', null, undefined]) {
    const r = await controllaRipresaDaCodice(brutto, f);
    assert.equal(r.ok, false, `"${brutto}" non e' un codice`);
    assert.equal(r.motivo, 'formato');
    assert.equal(r.messaggio, MESSAGGI_RIPRESA.formato);
  }
  assert.equal(f.chiamate.leggiStato.length, 0);
  assert.equal(f.chiamate.tabellonePresente.length, 0);
});

await prova('partita che non esiste, o mai iniziata (nessuno stato)', async () => {
  const f = creaFinti({ partite: {} });
  const r = await controllaRipresaDaCodice('ZZZZ', f);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'non-trovata');
});

await prova('uno stato strano (non e\' una partita vera) vale "non trovata"', async () => {
  for (const strano of [5, 'x', true, {}, { turnoDi: 0 }]) {
    const f = creaFinti({ partite: { ABCD: strano } });
    const r = await controllaRipresaDaCodice('ABCD', f);
    assert.equal(r.ok, false);
    assert.equal(r.motivo, 'non-trovata');
  }
});

await prova('partita gia\' finita: non si riprende (anche se ha vinto il giocatore 0)', async () => {
  for (const vincitore of [0, 1, 3]) {
    const f = creaFinti({ partite: { ABCD: statoDa({ vincitore }) } });
    const r = await controllaRipresaDaCodice('ABCD', f);
    assert.equal(r.ok, false);
    assert.equal(r.motivo, 'finita', `vincitore ${vincitore}`);
  }
});

await prova('partita ferma da troppo tempo: non si riprende', async () => {
  const f = creaFinti({ partite: { ABCD: statoDa({ ultimoAggiornamento: ADESSO - LIMITE_RIPRESA_DA_CODICE_MS - MINUTO }) } });
  const r = await controllaRipresaDaCodice('ABCD', f);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'vecchia');
});

await prova('il limite e\' largo: ferma da 5 ore si riprende ancora', async () => {
  const f = creaFinti({ partite: { ABCD: statoDa({ ultimoAggiornamento: ADESSO - 5 * ORA }) } });
  assert.equal((await controllaRipresaDaCodice('ABCD', f)).ok, true);
});

await prova('senza data dell\'ultimo aggiornamento si considera vecchia (per prudenza)', async () => {
  const s = statoDa(); delete s.ultimoAggiornamento;
  const r = await controllaRipresaDaCodice('ABCD', creaFinti({ partite: { ABCD: s } }));
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'vecchia');
  const r2 = await controllaRipresaDaCodice('ABCD', creaFinti({ partite: { ABCD: statoDa({ ultimoAggiornamento: 'ieri' }) } }));
  assert.equal(r2.motivo, 'vecchia');
});

await prova('un tabellone e\' ancora collegato: non si riprende da un secondo schermo', async () => {
  const f = creaFinti({ partite: { ABCD: statoDa() }, collegati: ['ABCD'] });
  const r = await controllaRipresaDaCodice('ABCD', f);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'aperta-altrove');
  assert.match(r.messaggio, /aspetta un minuto/);
});

await prova('un tabellone collegato a un\'ALTRA partita non disturba', async () => {
  const f = creaFinti({ partite: { ABCD: statoDa() }, collegati: ['WXYZ'] });
  assert.equal((await controllaRipresaDaCodice('ABCD', f)).ok, true);
});

await prova('se la rete non risponde: messaggio gentile, nessun errore verso chi chiama', async () => {
  for (const errore of ['rete', 'presenza']) {
    const f = creaFinti({ partite: { ABCD: statoDa() }, errore });
    const r = await controllaRipresaDaCodice('ABCD', f);
    assert.equal(r.ok, false);
    assert.equal(r.motivo, 'errore');
  }
});

await prova('mancano le funzioni di lettura: "errore", mai un\'eccezione', async () => {
  const r = await controllaRipresaDaCodice('ABCD', {});
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'errore');
  const r2 = await controllaRipresaDaCodice('ABCD');
  assert.equal(r2.ok, false);
});

await prova('ogni motivo di rifiuto ha il suo messaggio in italiano', () => {
  for (const motivo of ['formato', 'non-trovata', 'finita', 'vecchia', 'aperta-altrove', 'errore']) {
    assert.ok(typeof MESSAGGI_RIPRESA[motivo] === 'string' && MESSAGGI_RIPRESA[motivo].length > 10, motivo);
  }
});

console.log(`\nRipresa da codice: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
