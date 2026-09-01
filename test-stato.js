// test-stato.js
// Piccolo script solo per verificare che stato.js funzioni. Si può cancellare dopo.

import { creaStatoIniziale, giocatoreDiTurno } from './js/stato.js';

const giocatori = [
  { nome: 'Marco', colore: 'rosso' },
  { nome: 'Giulia', colore: 'blu' },
  { nome: 'Luca', colore: 'verde' },
  { nome: 'Sara', colore: 'giallo' }
];

const stato = creaStatoIniziale(giocatori);

console.log(JSON.stringify(stato, null, 2));
console.log('Tocca a:', giocatoreDiTurno(stato).nome);