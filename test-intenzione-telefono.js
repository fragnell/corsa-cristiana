// test-intenzione-telefono.js
// Scrive un segnale su Firebase quando premi il bottone — è quello che
// il tabellone (o chiunque sia in ascolto) riceverà istantaneamente.

import { db, ref, set } from './js/rete.js';

document.getElementById('btn-segnale').addEventListener('click', async () => {
  const ora = new Date().toLocaleTimeString();
  await set(ref(db, 'test/segnale'), ora);
});