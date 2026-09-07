// migra-carte.js
// Da eseguire UNA SOLA VOLTA: prende le carte dai file JSON locali e le
// scrive dentro Firebase, con una chiave unica per ciascuna — da qui in
// avanti il gioco (e presto il pannello impostazioni) lavorerà
// direttamente su Firebase, senza più bisogno di questi file.

import { db, ref, set } from './rete.js';
import { nuovaChiaveMazzo } from './sincronizzazione.js';

async function migraMazzo(nomeMazzo, percorsoFile) {
  const dati = await (await fetch(percorsoFile)).json();
  const carte = dati.carte;

  const oggetto = {};
  carte.forEach(carta => {
    const chiave = nuovaChiaveMazzo(nomeMazzo);
    oggetto[chiave] = carta;
  });

  await set(ref(db, `mazzi/${nomeMazzo}`), oggetto);
  return carte.length;
}

document.getElementById('btn-migra').addEventListener('click', async () => {
  const risultato = document.getElementById('risultato');
  risultato.textContent = 'Migrazione in corso...';

  try {
    const nConoscenza = await migraMazzo('conoscenza', 'dati/carte-conoscenza.json');
    const nImprevisto = await migraMazzo('imprevisto', 'dati/carte-imprevisto.json');
    const nProva = await migraMazzo('prova', 'dati/carte-prova.json');

    risultato.textContent = `✅ Fatto: ${nConoscenza} Conoscenza, ${nImprevisto} Imprevisto, ${nProva} Prova copiate su Firebase.`;
  } catch (errore) {
    risultato.textContent = '❌ Errore: ' + errore.message;
    console.error(errore);
  }
});