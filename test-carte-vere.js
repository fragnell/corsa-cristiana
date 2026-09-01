// test-carte-vere.js
// Carica i mazzi Imprevisto e Prova veri (non più segnaposto) e ne pesca qualcuna.

import fs from 'node:fs';
import { creaMazzo, pesca } from './js/mazzi.js';

const imprevisto = JSON.parse(fs.readFileSync('./dati/carte-imprevisto.json', 'utf-8')).carte;
const prova = JSON.parse(fs.readFileSync('./dati/carte-prova.json', 'utf-8')).carte;

console.log(`Mazzo Imprevisto caricato: ${imprevisto.length} carte`);
console.log(`Mazzo Prova caricato: ${prova.length} carte`);

let mazzoImprevisto = creaMazzo(imprevisto);
let mazzoProva = creaMazzo(prova);

console.log('\n=== 3 carte Imprevisto pescate a caso ===');
for (let i = 0; i < 3; i++) {
  const r = pesca(mazzoImprevisto);
  mazzoImprevisto = r.mazzo;
  console.log(`- "${r.carta.testo}" (${r.carta.riferimento}) ${r.carta.effetto} caselle`);
}

console.log('\n=== 3 carte Prova pescate a caso ===');
for (let i = 0; i < 3; i++) {
  const r = pesca(mazzoProva);
  mazzoProva = r.mazzo;
  console.log(`- [${r.carta.tipo}] "${r.carta.testo.slice(0, 60)}..."`);
}
EOF