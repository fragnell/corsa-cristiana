// migra-carte.js
// Importatore di carte: scegli un file JSON (scritto a mano, con l'aiuto
// di ChatGPT o come preferisci) nel formato giusto, scegli il mazzo di
// destinazione, e le carte si AGGIUNGONO a quelle già presenti — non le
// sostituiscono. Prima di importare, controlla che ogni carta abbia i
// campi giusti per il suo tipo, e non importa nulla se anche una sola
// è incompleta.

import { nuovaChiaveMazzo, salvaCarta } from './sincronizzazione.js';

function validaCarta(nomeMazzo, carta, indice) {
  const n = `Carta #${indice + 1}`;

  if (nomeMazzo === 'conoscenza') {
    if (!carta.domanda) return `${n}: manca "domanda"`;
    if (!['diretta', 'elenco', 'scelta'].includes(carta.tipo)) {
      return `${n}: "tipo" deve essere diretta, elenco o scelta (trovato: ${carta.tipo})`;
    }
    if (carta.tipo === 'diretta') {
      const haRisposta = Array.isArray(carta.risposta) ? carta.risposta.length > 0 : !!carta.risposta;
      if (!haRisposta) return `${n} (diretta): manca "risposta" (una stringa, o un elenco di frasi tutte accettate)`;
    }
    if (carta.tipo === 'elenco' && (!Array.isArray(carta.rispostePossibili) || !carta.minimoRichiesto)) {
      return `${n} (elenco): servono "rispostePossibili" (elenco) e "minimoRichiesto" (numero)`;
    }
    if (carta.tipo === 'scelta' && (!Array.isArray(carta.opzioni) || !carta.rispostaCorretta)) {
      return `${n} (scelta): servono "opzioni" (elenco) e "rispostaCorretta"`;
    }
    if (carta.tipo === 'scelta' && Array.isArray(carta.opzioni) && !carta.opzioni.includes(carta.rispostaCorretta)) {
      return `${n} (scelta): "rispostaCorretta" deve essere uguale a una delle "opzioni"`;
    }
  } else {
    if (!carta.testo) return `${n}: manca "testo"`;
  }
  return null;
}

document.getElementById('btn-importa').addEventListener('click', async () => {
  const risultato = document.getElementById('risultato');
  const nomeMazzo = document.getElementById('select-mazzo').value;
  const fileInput = document.getElementById('input-file');

  if (!fileInput.files.length) {
    risultato.textContent = '❌ Scegli prima un file.';
    return;
  }

  risultato.textContent = 'Controllo il file...';

  try {
    const testo = await fileInput.files[0].text();
    const dati = JSON.parse(testo);
    const carte = dati.carte;

    if (!Array.isArray(carte) || carte.length === 0) {
      risultato.textContent = '❌ Il file deve contenere un elenco "carte" non vuoto.';
      return;
    }

    const errori = carte
      .map((carta, indice) => validaCarta(nomeMazzo, carta, indice))
      .filter(errore => errore !== null);

    if (errori.length > 0) {
      risultato.innerHTML = `❌ Trovati ${errori.length} problemi, nessuna carta importata:<br>` + errori.join('<br>');
      return;
    }

    risultato.textContent = `Tutto in ordine, importo ${carte.length} carte...`;

    for (const carta of carte) {
      const chiave = nuovaChiaveMazzo(nomeMazzo);
      await salvaCarta(nomeMazzo, chiave, carta);
    }

    risultato.textContent = `✅ Aggiunte ${carte.length} carte a "${nomeMazzo}". Quelle già presenti non sono state toccate.`;
    fileInput.value = '';
  } catch (errore) {
    risultato.textContent = '❌ Errore: ' + errore.message;
    console.error(errore);
  }
});