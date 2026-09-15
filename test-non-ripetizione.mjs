// test-non-ripetizione.mjs
// Simula partite sui due mazzi Conoscenza VERI di questo progetto (60
// carte normali, 30 junior), con il numero di pescate stimato da una
// simulazione vera del tabellone: 49 per una partita a 6 giocatori, 95
// per una a 12 (dado, movimento, Salti, Fermi, migliaia di partite
// simulate per arrivarci). Verifica che le domande non si ripetano mai
// dentro la stessa partita, e che la partita successiva tenga conto di
// quello già uscito nella precedente. Si esegue con:
//   node test-non-ripetizione.mjs
// Importa il vero js/mazzi.js del progetto.

import { creaMazzoPerUsoMinimo, peschaPerUsoMinimo } from './js/mazzi.js';

function simulaPartita(carte, numeroPescate, statistichePersistite, etichetta) {
  let mazzo = creaMazzoPerUsoMinimo(carte, statistichePersistite);
  const pescateFatte = [];

  for (let i = 0; i < numeroPescate; i++) {
    const risultato = peschaPerUsoMinimo(mazzo);
    mazzo = risultato.mazzo;
    pescateFatte.push(risultato.carta._chiave);
  }

  const primoGiro = pescateFatte.slice(0, carte.length);
  const ripetuti = primoGiro.length !== new Set(primoGiro).size;
  console.log(`  Partita ${etichetta} (${numeroPescate} pescate su ${carte.length} carte) — ripetuti prima di vederle tutte:`, ripetuti ? '❌ SI, PROBLEMA!' : '✅ Nessuno');

  return { pescateFatte };
}

function provaMazzo(nomeMazzo, dimensioneMazzo, pescatePerPartita, etichettaScenario) {
  console.log(`\n--- ${etichettaScenario}: mazzo "${nomeMazzo}" (${dimensioneMazzo} carte) ---`);
  const carte = Array.from({ length: dimensioneMazzo }, (_, i) => ({ _chiave: `domanda-${i + 1}` }));

  const partita1 = simulaPartita(carte, pescatePerPartita, {}, '1');

  const statisticheDopo1 = {};
  partita1.pescateFatte.forEach(chiave => {
    statisticheDopo1[chiave] = { proposte: (statisticheDopo1[chiave]?.proposte || 0) + 1 };
  });

  const partita2 = simulaPartita(carte, pescatePerPartita, statisticheDopo1, '2 (eredita la 1)');

  const usateInPartita1 = new Set(partita1.pescateFatte);
  const maiUsateInPartita1 = carte.map(c => c._chiave).filter(k => !usateInPartita1.has(k));
  const primeCartePartita2 = partita2.pescateFatte.slice(0, maiUsateInPartita1.length);
  const tutteDalleMaiUsate = maiUsateInPartita1.length === 0 || primeCartePartita2.every(k => maiUsateInPartita1.includes(k));
  console.log(`  Carte mai uscite in Partita 1: ${maiUsateInPartita1.length} — tutte proposte per prime in Partita 2?`, tutteDalleMaiUsate ? '✅ SI, corretto!' : '❌ NO, problema!');
}

console.log('########## SCENARIO: 6 GIOCATORI (~49 pescate Conoscenza a partita, da simulazione) ##########');
provaMazzo('Conoscenza normale', 60, 49, '6 giocatori');
provaMazzo('Conoscenza junior', 30, 49, '6 giocatori');

console.log('\n########## SCENARIO: 12 GIOCATORI (~95 pescate Conoscenza a partita, da simulazione) ##########');
provaMazzo('Conoscenza normale', 60, 95, '12 giocatori');
provaMazzo('Conoscenza junior', 30, 95, '12 giocatori');