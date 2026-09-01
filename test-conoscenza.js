// test-conoscenza.js
// Carica il mazzo Conoscenza vero e controlla che tutte le carte abbiano i campi giusti.

import fs from 'node:fs';
import { creaMazzo, pesca } from './js/mazzi.js';

const conoscenza = JSON.parse(fs.readFileSync('./dati/carte-conoscenza.json', 'utf-8')).carte;
console.log(`Mazzo Conoscenza caricato: ${conoscenza.length} carte`);

const nonVerificate = conoscenza.filter(c => !c.verificato).length;
console.log(`Carte ancora da verificare: ${nonVerificate} / ${conoscenza.length}`);

let mazzo = creaMazzo(conoscenza);
console.log('\n=== 3 carte pescate a caso ===');
for (let i = 0; i < 3; i++) {
  const r = pesca(mazzo);
  mazzo = r.mazzo;
  const c = r.carta;
  if (c.tipo === 'diretta') {
    console.log(`- [diretta] "${c.domanda}" → ${c.risposta}`);
  } else {
    console.log(`- [elenco, min. ${c.minimoRichiesto}] "${c.domanda}"`);
  }
}