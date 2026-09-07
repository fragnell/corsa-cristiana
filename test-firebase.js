// test-firebase.js
// Scrive un valore di prova su Firebase e lo rilegge subito dopo.
// Se questo funziona, il collegamento è solido e possiamo costruirci sopra.

import { db, ref, set, get } from './js/rete.js';

async function test() {
  const div = document.getElementById('risultato');
  try {
    div.textContent = 'Scrivo un valore di prova...';
    const messaggio = 'Ciao da Corsa Cristiana! ' + new Date().toLocaleTimeString();
    await set(ref(db, 'test/messaggio'), messaggio);

    div.textContent = 'Scritto. Ora lo rileggo...';
    const istantanea = await get(ref(db, 'test/messaggio'));

    if (istantanea.exists()) {
      div.textContent = '✅ Funziona! Valore letto: ' + istantanea.val();
    } else {
      div.textContent = '❌ Scritto ma non trovato in lettura — strano.';
    }
  } catch (errore) {
    div.textContent = '❌ Errore: ' + errore.message;
    console.error(errore);
  }
}

test();