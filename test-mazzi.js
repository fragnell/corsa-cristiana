// test-mazzi.js
// Verifica mazzi.js con carte finte (segnaposto), solo per controllare
// che mescolare, pescare e rimescolare funzionino bene.

import { creaMazzo, pesca } from './js/mazzi.js';

console.log('=== TEST 1: pesca tutte le carte di un mazzo piccolo, nessuna ripetuta ===');

const carteFinte = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
let mazzo = creaMazzo(carteFinte);

const estratte = [];
for (let i = 0; i < 5; i++) {
  const r = pesca(mazzo);
  mazzo = r.mazzo;
  estratte.push(r.carta.id);
}
console.log('Ordine di uscita:', estratte);
console.log('Tutte diverse?', new Set(estratte).size === 5 ? 'sì' : 'NO, problema!');

console.log('\n=== TEST 2: pesca una carta in più — deve rimescolare gli scarti ===');
const r6 = pesca(mazzo);
console.log('Sesta pescata (dopo rimescolo):', r6.carta.id);
console.log('Carte pescabili rimaste:', r6.mazzo.pescabili.length, '- scarti:', r6.mazzo.scarti.length);

console.log('\n=== TEST 3: 500 pescate da un mazzo di 20, controllo che sia equilibrato ===');
const carte20 = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
let m = creaMazzo(carte20);
const conteggio = {};
for (let i = 0; i < 500; i++) {
  const r = pesca(m);
  m = r.mazzo;
  conteggio[r.carta.id] = (conteggio[r.carta.id] || 0) + 1;
}
const valori = Object.values(conteggio);
console.log('Carte diverse uscite almeno una volta:', Object.keys(conteggio).length, '/ 20');
console.log('Uscite minime/massime per singola carta:', Math.min(...valori), '/', Math.max(...valori), '(atteso: circa 25 ciascuna)');