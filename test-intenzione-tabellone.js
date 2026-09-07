// test-intenzione-tabellone.js
// Resta in ascolto: appena qualcuno scrive su "test/segnale" da qualunque
// dispositivo, questa pagina se ne accorge da sola e si aggiorna.

import { db, ref, onValue } from './js/rete.js';

const percorso = ref(db, 'test/segnale');
const div = document.getElementById('risultato');

onValue(percorso, (istantanea) => {
  const valore = istantanea.val();
  div.textContent = valore
    ? '🔔 Segnale ricevuto! Inviato alle ' + valore
    : 'In ascolto, nessun segnale ancora...';
});