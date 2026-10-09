// test-ordine.mjs
// Prove del sorteggio dell'ordine di gioco: js/ordine-gioco.js (come si rimescola, che sia
// davvero equo, che non possa rompere la partita) e come si incastra con lo stato e con i turni.
// Si lancia con:  node test-ordine.mjs

import assert from 'node:assert/strict';
import { mescola, stessiGiocatori, sorteggiaOrdine, annunciaOrdine } from './js/ordine-gioco.js';
import { creaStatoIniziale } from './js/stato.js';
import { passaTurno } from './js/regole.js';
import { PALETTE } from './js/colori.js';
import { generatoreConSeme } from './js/salmo/mosaico.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.message).split('\n').join('\n        ')}`); }
}

// Mentre si prova un caso "rotto" il gioco avvisa in console: qui si tiene zitto e si conta.
function senzaAvvisi(fn) {
  const originale = console.warn;
  const avvisi = [];
  console.warn = (...a) => { avvisi.push(a.map(String).join(' ')); };
  try { return { risultato: fn(), avvisi }; } finally { console.warn = originale; }
}

const NOMI = ['Anna', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Gina', 'Ivo', 'Lara', 'Mara', 'Nico', 'Olga'];
const COLORI = Object.keys(PALETTE);
const lobby = (n, junior = []) => NOMI.slice(0, n).map((nome, i) => ({ nome, colore: COLORI[i], ...(junior.includes(i) ? { junior: true } : {}) }));
const nomi = elenco => elenco.map(g => g.nome);
const chiave = elenco => nomi(elenco).join('>');

// ================= mescola =================

prova('mescola: non modifica l\'elenco originale e restituisce una copia', () => {
  const originale = ['A', 'B', 'C', 'D'];
  const r = mescola(originale, generatoreConSeme(5));
  assert.deepEqual(originale, ['A', 'B', 'C', 'D']);
  assert.notEqual(r, originale);
  assert.equal(r.length, 4);
});

prova('mescola: da 0 a 12 giocatori resta sempre una vera rimescolata (stessi elementi, ognuno una volta)', () => {
  for (let n = 0; n <= 12; n++) {
    const originale = lobby(n);
    for (let seme = 1; seme <= 150; seme++) {
      const r = mescola(originale, generatoreConSeme(seme * 7919 + n));
      assert.equal(r.length, n);
      for (const g of originale) assert.equal(r.filter(x => x === g).length, 1, `n=${n} seme=${seme}: ${g.nome}`);
    }
  }
});

prova('mescola: risultati calcolati a mano (3 giocatori, tutte e 6 le sequenze possibili)', () => {
  // metodo di Fisher-Yates: si parte dall'ultimo e lo si scambia con uno a caso tra quelli rimasti
  const casi = [
    [[0, 0], 'B>C>A'],
    [[0, 0.99], 'C>B>A'],
    [[0.4, 0.1], 'C>A>B'],
    [[0.4, 0.9], 'A>C>B'],
    [[0.99, 0.1], 'B>A>C'],
    [[0.99, 0.99], 'A>B>C']
  ];
  const viste = new Set();
  for (const [numeri, atteso] of casi) {
    const coda = [...numeri];
    const r = mescola(['A', 'B', 'C'], () => coda.shift());
    assert.equal(r.join('>'), atteso, `con ${numeri.join(', ')}`);
    viste.add(r.join('>'));
  }
  assert.equal(viste.size, 6, 'le 6 sequenze sono tutte diverse');
});

prova('mescola: "caso" sempre 0 sposta il primo in fondo, "caso" quasi 1 lascia tutto com\'era', () => {
  assert.deepEqual(mescola(['A', 'B', 'C', 'D'], () => 0), ['B', 'C', 'D', 'A']);
  assert.deepEqual(mescola(['A', 'B', 'C', 'D'], () => 0.999999), ['A', 'B', 'C', 'D']);
});

prova('mescola: un "caso" sbagliato (1, NaN, negativo, infinito) non fa mai uscire dall\'elenco', () => {
  for (const strano of [1, 1.5, NaN, -0.3, -Infinity, Infinity, 99, undefined, null, '0.5', 'x']) {
    const r = mescola(['A', 'B', 'C', 'D', 'E'], () => strano);
    assert.equal(r.length, 5, `con ${String(strano)}`);
    assert.deepEqual([...r].sort(), ['A', 'B', 'C', 'D', 'E'], `con ${String(strano)}`);
    assert.equal(r.includes(undefined), false);
  }
});

prova('mescola: elenco vuoto o con un solo giocatore', () => {
  assert.deepEqual(mescola([]), []);
  assert.deepEqual(mescola(['solo']), ['solo']);
});

// ================= equita' =================

prova('equita: con 3 giocatori ognuno finisce primo, secondo e terzo circa 1 volta su 3', () => {
  const caso = generatoreConSeme(2024);
  const conti = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];   // conti[posizione][giocatore]
  const giri = 30000;
  for (let k = 0; k < giri; k++) mescola([0, 1, 2], caso).forEach((g, pos) => { conti[pos][g]++; });
  for (let pos = 0; pos < 3; pos++) for (let g = 0; g < 3; g++) {
    assert.ok(Math.abs(conti[pos][g] - giri / 3) < 500, `posizione ${pos + 1}, giocatore ${g}: ${conti[pos][g]} su ${giri}`);
  }
});

prova('equita: con 4 giocatori escono tutte le 24 sequenze possibili, ognuna circa 1 volta su 24', () => {
  const caso = generatoreConSeme(77);
  const conti = new Map();
  const giri = 48000;
  for (let k = 0; k < giri; k++) {
    const s = mescola(['A', 'B', 'C', 'D'], caso).join('');
    conti.set(s, (conti.get(s) || 0) + 1);
  }
  assert.equal(conti.size, 24, 'tutte le sequenze devono comparire');
  for (const [s, n] of conti) assert.ok(Math.abs(n - giri / 24) < 300, `${s}: ${n} su ${giri}`);
});

prova('equita: con 12 giocatori chi parte per primo e\' uniforme (nessuno favorito)', () => {
  const caso = generatoreConSeme(31337);
  const conti = new Array(12).fill(0);
  const giri = 60000;
  for (let k = 0; k < giri; k++) conti[mescola([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], caso)[0]]++;
  conti.forEach((n, g) => assert.ok(Math.abs(n - giri / 12) < 400, `giocatore ${g}: ${n} su ${giri}`));
});

prova('equita: entrare per primo in lobby non da\' vantaggio (con Math.random vero, 12000 partite da 4)', () => {
  const primi = [0, 0, 0, 0];
  for (let k = 0; k < 12000; k++) {
    const ordine = sorteggiaOrdine(lobby(4));
    primi[NOMI.indexOf(ordine[0].nome)]++;
  }
  primi.forEach((n, i) => assert.ok(n > 2600 && n < 3400, `${NOMI[i]} e' partito primo ${n} volte su 12000`));
});

// ================= sorteggiaOrdine =================

prova('sorteggiaOrdine: restituisce gli stessi giocatori (nome, colore e junior restano insieme)', () => {
  const elenco = lobby(5, [1, 3]);
  const r = sorteggiaOrdine(elenco, generatoreConSeme(9));
  assert.equal(r.length, 5);
  for (const g of elenco) assert.equal(r.filter(x => x === g).length, 1);
  for (const g of r) {
    const i = NOMI.indexOf(g.nome);
    assert.equal(g.colore, COLORI[i]);
    assert.equal(!!g.junior, i === 1 || i === 3);
  }
});

prova('sorteggiaOrdine: non modifica l\'elenco della lobby', () => {
  const elenco = lobby(6);
  const prima = chiave(elenco);
  sorteggiaOrdine(elenco, generatoreConSeme(3));
  assert.equal(chiave(elenco), prima);
});

prova('sorteggiaOrdine: se il "caso" si rompe (lancia un errore) si gioca nell\'ordine di ingresso, senza errori', () => {
  const elenco = lobby(4);
  const { risultato, avvisi } = senzaAvvisi(() => sorteggiaOrdine(elenco, () => { throw new Error('rotto'); }));
  assert.equal(risultato, elenco);
  assert.equal(avvisi.length, 1);
});

prova('sorteggiaOrdine: se il "caso" non e\' nemmeno una funzione, si gioca nell\'ordine di ingresso', () => {
  const elenco = lobby(3);
  const { risultato } = senzaAvvisi(() => sorteggiaOrdine(elenco, 'non sono una funzione'));
  assert.equal(risultato, elenco);
});

prova('sorteggiaOrdine: se non e\' un elenco (null, undefined, oggetto) restituisce lo stesso valore, senza lanciare', () => {
  for (const strano of [null, undefined, {}, 'abc', 42]) {
    const { risultato } = senzaAvvisi(() => sorteggiaOrdine(strano));
    assert.equal(risultato, strano);
  }
});

prova('stessiGiocatori: riconosce una vera rimescolata e scarta tutto il resto', () => {
  const [a, b, c] = lobby(3);
  assert.equal(stessiGiocatori([a, b, c], [c, a, b]), true);
  assert.equal(stessiGiocatori([a, b, c], [a, b, c]), true);
  assert.equal(stessiGiocatori([], []), true);
  assert.equal(stessiGiocatori([a, b, c], [a, b]), false, 'ne manca uno');
  assert.equal(stessiGiocatori([a, b, c], [a, b, c, c]), false, 'uno in piu\'');
  assert.equal(stessiGiocatori([a, b, c], [a, b, c, { nome: 'intruso', colore: 'rosa' }]), false, 'un intruso in piu\'');
  assert.equal(stessiGiocatori([a, a], [a, a]), false, 'lo stesso giocatore due volte nella lobby non e\' un elenco valido');
  assert.equal(stessiGiocatori([a, b, c], [a, a, b]), false, 'uno doppio e uno sparito');
  assert.equal(stessiGiocatori([a, b, c], [a, b, { ...c }]), false, 'una copia non e\' lo stesso giocatore');
  assert.equal(stessiGiocatori([a, b, c], [a, b, undefined]), false);
  assert.equal(stessiGiocatori([a, b, c], null), false);
  assert.equal(stessiGiocatori(null, [a]), false);
  assert.equal(stessiGiocatori([a, b, c], 'abc'), false);
});

prova('sorteggiaOrdine: se la rimescolata perde o raddoppia un giocatore, si gioca nell\'ordine di ingresso', () => {
  const elenco = lobby(4);
  for (const rovinata of [el => el.slice(1), el => [...el, el[0]], el => [el[0], el[0], el[1], el[2]], () => null, () => 'boh', el => el.map(g => ({ ...g }))]) {
    const { risultato, avvisi } = senzaAvvisi(() => sorteggiaOrdine(elenco, Math.random, rovinata));
    assert.equal(risultato, elenco);
    assert.equal(avvisi.length, 1);
  }
});

prova('sorteggiaOrdine: un solo giocatore, o nessuno', () => {
  const uno = lobby(1);
  assert.deepEqual(sorteggiaOrdine(uno), uno);
  assert.deepEqual(sorteggiaOrdine([]), []);
});

// ================= con lo stato di gioco e con i turni =================

prova('lo stato nasce dall\'ordine sorteggiato: numeri 0..n-1 in ordine, parte il primo, junior e colori seguono il nome', () => {
  for (let n = 1; n <= 12; n++) {
    for (let seme = 1; seme <= 40; seme++) {
      const elenco = lobby(n, [0, n - 1]);
      const stato = creaStatoIniziale(sorteggiaOrdine(elenco, generatoreConSeme(seme + n * 100)));
      assert.equal(stato.giocatori.length, n);
      assert.equal(stato.turnoDi, 0);
      stato.giocatori.forEach((g, i) => {
        assert.equal(g.id, i, 'il numero del giocatore e\' la sua posizione nell\'elenco');
        const iLobby = NOMI.indexOf(g.nome);
        assert.equal(g.colore, COLORI[iLobby]);
        assert.equal(!!g.junior, iLobby === 0 || iLobby === n - 1);
        assert.equal(g.posizione, 1);
      });
      assert.equal(new Set(nomi(stato.giocatori)).size, n, 'nessun nome doppio');
    }
  }
});

prova('i turni seguono l\'ordine sorteggiato e dopo l\'ultimo si ricomincia dal primo', () => {
  for (let seme = 1; seme <= 30; seme++) {
    const n = 2 + (seme % 7);
    let stato = creaStatoIniziale(sorteggiaOrdine(lobby(n), generatoreConSeme(seme)));
    const visti = [stato.turnoDi];
    for (let k = 0; k < 2 * n; k++) { stato = passaTurno(stato); visti.push(stato.turnoDi); }
    const atteso = Array.from({ length: 2 * n + 1 }, (_, k) => k % n);
    assert.deepEqual(visti, atteso, `n=${n} seme=${seme}`);
  }
});

prova('chi ha abbandonato viene saltato anche nell\'ordine sorteggiato', () => {
  let stato = creaStatoIniziale(sorteggiaOrdine(lobby(4), generatoreConSeme(12)));
  stato.giocatori[2].abbandonato = true;
  const visti = [stato.turnoDi];
  for (let k = 0; k < 6; k++) { stato = passaTurno(stato); visti.push(stato.turnoDi); }
  assert.deepEqual(visti, [0, 1, 3, 0, 1, 3, 0]);
});

// ================= annunciaOrdine (riquadro sul tabellone) =================

function documentoFinto() {
  const classi = () => {
    const insieme = new Set(['nascosta']);
    return { add: c => insieme.add(c), remove: c => insieme.delete(c), contains: c => insieme.has(c) };
  };
  const nodo = tag => ({
    tag, className: '', style: {}, figli: [], classList: classi(),
    append(...x) { this.figli.push(...x); }, appendChild(x) { this.figli.push(x); }, replaceChildren() { this.figli = []; }
  });
  const riquadro = nodo('div');
  const elenco = nodo('ol');
  return {
    riquadro, elenco,
    getElementById: id => ({ 'annuncio-ordine': riquadro, 'annuncio-ordine-lista': elenco })[id] || null,
    createElement: tag => nodo(tag)
  };
}
const aspetta = ms => new Promise(r => setTimeout(r, ms));

prova('annunciaOrdine: un riquadro per giocatore, nell\'ordine, con il colore della pedina', () => {
  const doc = documentoFinto();
  annunciaOrdine([{ nome: 'Carla', colore: 'verde' }, { nome: 'Anna', colore: 'rosso' }], { durataMs: 5, documento: doc });
  assert.equal(doc.riquadro.classList.contains('nascosta'), false, 'il riquadro si vede');
  assert.equal(doc.elenco.figli.length, 2);
  const [primo, secondo] = doc.elenco.figli;
  assert.equal(primo.figli[1], 'Carla');
  assert.equal(secondo.figli[1], 'Anna');
  assert.equal(primo.figli[0].style.background, PALETTE.verde);
  assert.equal(secondo.figli[0].style.background, PALETTE.rosso);
  assert.equal(primo.figli[0].className, 'pallino-lista');
});

prova('annunciaOrdine: i nomi entrano come semplice testo, mai come HTML', () => {
  const doc = documentoFinto();
  annunciaOrdine([{ nome: '<img src=x onerror=alert(1)>', colore: 'blu' }], { durataMs: 5, documento: doc });
  const voce = doc.elenco.figli[0];
  assert.equal(typeof voce.figli[1], 'string');
  assert.equal(voce.figli[1], '<img src=x onerror=alert(1)>');
  assert.equal('innerHTML' in voce, false, 'non si usa innerHTML');
});

prova('annunciaOrdine: colore sconosciuto -> si usa cosi\' com\'e\' (mai un errore)', () => {
  const doc = documentoFinto();
  annunciaOrdine([{ nome: 'Zeb', colore: '#123456' }, { nome: 'Ugo', colore: undefined }], { durataMs: 5, documento: doc });
  assert.equal(doc.elenco.figli[0].figli[0].style.background, '#123456');
  assert.equal(doc.elenco.figli.length, 2);
});

prova('annunciaOrdine: richiamata una seconda volta sostituisce l\'elenco invece di accodarlo', () => {
  const doc = documentoFinto();
  annunciaOrdine([{ nome: 'A', colore: 'rosso' }, { nome: 'B', colore: 'blu' }], { durataMs: 5, documento: doc });
  annunciaOrdine([{ nome: 'C', colore: 'verde' }], { durataMs: 5, documento: doc });
  assert.equal(doc.elenco.figli.length, 1);
  assert.equal(doc.elenco.figli[0].figli[1], 'C');
});

prova('annunciaOrdine: se manca il riquadro nella pagina, o la pagina si rompe, non lancia errori', () => {
  const senzaRiquadro = { getElementById: () => null, createElement: () => ({}) };
  const { avvisi } = senzaAvvisi(() => {
    annunciaOrdine([{ nome: 'A', colore: 'rosso' }], { durataMs: 5, documento: senzaRiquadro });
    annunciaOrdine([{ nome: 'A', colore: 'rosso' }], { durataMs: 5, documento: { getElementById: () => { throw new Error('pagina rotta'); } } });
    annunciaOrdine(null, { durataMs: 5, documento: documentoFinto() });
    annunciaOrdine([{ nome: 'A', colore: 'rosso' }], { durataMs: 5, documento: undefined });
  });
  assert.ok(avvisi.length >= 2, 'i problemi vengono segnalati in console ma non fermano nulla');
});

// il riquadro sparisce da solo (prova con tempo vero, ma brevissimo)
provati++;
{
  const doc = documentoFinto();
  annunciaOrdine([{ nome: 'A', colore: 'rosso' }], { durataMs: 40, documento: doc });
  const subito = doc.riquadro.classList.contains('nascosta');
  await aspetta(150);
  const dopo = doc.riquadro.classList.contains('nascosta');
  if (subito || !dopo) {
    falliti.push({ nome: 'annunciaOrdine: il riquadro compare e poi sparisce da solo', e: new Error(`subito nascosto=${subito}, dopo nascosto=${dopo}`) });
    console.log(`  FAIL  annunciaOrdine: il riquadro compare e poi sparisce da solo (subito nascosto=${subito}, dopo nascosto=${dopo})`);
  }
}

// due annunci ravvicinati: il secondo non viene "tagliato" dal timer del primo
provati++;
{
  const doc = documentoFinto();
  annunciaOrdine([{ nome: 'A', colore: 'rosso' }], { durataMs: 60, documento: doc });
  await aspetta(40);
  annunciaOrdine([{ nome: 'B', colore: 'blu' }], { durataMs: 120, documento: doc });
  await aspetta(50);   // il primo timer sarebbe scaduto, il secondo no
  const ancoraVisibile = !doc.riquadro.classList.contains('nascosta');
  await aspetta(150);
  const poiNascosto = doc.riquadro.classList.contains('nascosta');
  if (!ancoraVisibile || !poiNascosto) {
    falliti.push({ nome: 'annunciaOrdine: due annunci ravvicinati', e: new Error(`ancora visibile=${ancoraVisibile}, poi nascosto=${poiNascosto}`) });
    console.log(`  FAIL  annunciaOrdine: due annunci ravvicinati (ancora visibile=${ancoraVisibile}, poi nascosto=${poiNascosto})`);
  }
}

// ================= esito =================

console.log(`\nOrdine di gioco sorteggiato: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
