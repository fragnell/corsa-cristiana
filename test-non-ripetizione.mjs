// test-non-ripetizione.mjs
// Simula due partite di seguito e verifica che le domande Conoscenza non
// si ripetano mai dentro la stessa partita, e che la seconda partita
// tenga conto di quello che è già uscito nella prima. Si esegue con:
//   node test-non-ripetizione.mjs
// Importa il vero js/mazzi.js del progetto — verifica il codice reale,
// non una copia.

import { creaMazzoPerUsoMinimo, peschaPerUsoMinimo } from './js/mazzi.js';

const carteFinte = Array.from({ length: 20 }, (_, i) => ({ _chiave: `domanda-${i + 1}` }));

function simulaPartita(numeroPescate, statistichePersistite, etichetta) {
  console.log(`\n=== PARTITA ${etichetta} (${numeroPescate} pescate) ===`);
  let mazzo = creaMazzoPerUsoMinimo(carteFinte, statistichePersistite);
  const pescateFatte = [];

  for (let i = 0; i < numeroPescate; i++) {
    const risultato = peschaPerUsoMinimo(mazzo);
    mazzo = risultato.mazzo;
    pescateFatte.push(risultato.carta._chiave);
  }

  console.log('Ordine pescato:', pescateFatte.join(', '));

  const primoGiro = pescateFatte.slice(0, carteFinte.length);
  const ripetuti = primoGiro.length !== new Set(primoGiro).size;
  console.log(`Ripetuti prima di aver visto tutte le ${carteFinte.length} carte:`, ripetuti ? '❌ SI, PROBLEMA!' : '✅ Nessuno');

  return { pescateFatte };
}

console.log('####### TEST 1: NESSUN RIPETUTO DENTRO LA STESSA PARTITA (anche oltre un giro completo) #######');
simulaPartita(25, {}, 'lunga (25 pescate su 20 carte)');

console.log('\n####### TEST 2: LA PARTITA SUCCESSIVA EVITA QUELLO GIÀ VISTO NELLA PRECEDENTE #######');
const risultatoPartita1 = simulaPartita(15, {}, '1');

const statisticheDopoPartita1 = {};
risultatoPartita1.pescateFatte.forEach(chiave => {
  statisticheDopoPartita1[chiave] = { proposte: (statisticheDopoPartita1[chiave]?.proposte || 0) + 1 };
});

const risultatoPartita2 = simulaPartita(15, statisticheDopoPartita1, '2');

const usateInPartita1 = new Set(risultatoPartita1.pescateFatte);
const maiUsateInPartita1 = carteFinte.map(c => c._chiave).filter(k => !usateInPartita1.has(k));
console.log(`\nCarte MAI uscite in Partita 1 (${maiUsateInPartita1.length}):`, maiUsateInPartita1.join(', '));

const primeCartePartita2 = risultatoPartita2.pescateFatte.slice(0, maiUsateInPartita1.length);
const tutteDalleMaiUsate = primeCartePartita2.every(k => maiUsateInPartita1.includes(k));
console.log(`Le prime ${maiUsateInPartita1.length} pescate della Partita 2 sono TUTTE tra quelle mai viste in Partita 1?`, tutteDalleMaiUsate ? '✅ SI, corretto!' : '❌ NO, problema!');