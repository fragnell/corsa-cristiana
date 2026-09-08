// admin-importa.js
// Sezione "Importa carte" del pannello: legge un file Excel (.xlsx), una
// scheda per tipo di carta, e aggiunge le domande a quelle già presenti
// — non le sostituisce mai. Usa la libreria SheetJS (caricata in
// admin.html con un tag <script> a parte) per leggere il file Excel
// direttamente nel browser, senza bisogno di convertirlo prima in JSON.

import { nuovaChiaveMazzo, salvaCarta } from './sincronizzazione.js';

function pulisci(valore) {
  return (valore === undefined || valore === null) ? '' : valore.toString().trim();
}

// Le celle con più valori insieme (risposte, opzioni) li separano con ";"
function splitLista(testo) {
  const pulito = pulisci(testo);
  if (!pulito) return [];
  return pulito.split(';').map(s => s.trim()).filter(Boolean);
}

function rigaACarta(nomeMazzo, riga) {
  if (nomeMazzo === 'conoscenza') {
    const carta = { domanda: pulisci(riga.domanda), tipo: pulisci(riga.tipo).toLowerCase() };
    if (carta.tipo === 'diretta') {
      const parti = splitLista(riga.risposta);
      if (parti.length === 1) carta.risposta = parti[0];
      else if (parti.length > 1) carta.risposta = parti;
    } else if (carta.tipo === 'elenco') {
      const minimo = Number(riga.minimoRichiesto);
      if (minimo) carta.minimoRichiesto = minimo;
      const possibili = splitLista(riga.rispostePossibili);
      if (possibili.length > 0) carta.rispostePossibili = possibili;
    } else if (carta.tipo === 'scelta') {
      const opzioni = splitLista(riga.opzioni);
      if (opzioni.length > 0) carta.opzioni = opzioni;
      const corretta = pulisci(riga.rispostaCorretta);
      if (corretta) carta.rispostaCorretta = corretta;
    }
    return carta;
  }
  const carta = { testo: pulisci(riga.testo) };
  if (nomeMazzo === 'imprevisto') {
    const riferimento = pulisci(riga.riferimento);
    if (riferimento) carta.riferimento = riferimento;
  }
  return carta;
}

function validaCarta(nomeMazzo, carta, indice) {
  const n = `Riga ${indice + 2}`; // +2: la riga 1 è l'intestazione in Excel

  if (nomeMazzo === 'conoscenza') {
    if (!carta.domanda) return `${n}: manca "domanda"`;
    if (!['diretta', 'elenco', 'scelta'].includes(carta.tipo)) {
      return `${n}: "tipo" deve essere diretta, elenco o scelta (trovato: "${carta.tipo}")`;
    }
    if (carta.tipo === 'diretta') {
      const haRisposta = Array.isArray(carta.risposta) ? carta.risposta.length > 0 : !!carta.risposta;
      if (!haRisposta) return `${n} (diretta): manca "risposta"`;
    }
    if (carta.tipo === 'elenco' && (!Array.isArray(carta.rispostePossibili) || carta.rispostePossibili.length === 0 || !carta.minimoRichiesto)) {
      return `${n} (elenco): servono "minimoRichiesto" e "rispostePossibili"`;
    }
    if (carta.tipo === 'scelta' && (!Array.isArray(carta.opzioni) || carta.opzioni.length === 0 || !carta.rispostaCorretta)) {
      return `${n} (scelta): servono "opzioni" e "rispostaCorretta"`;
    }
    if (carta.tipo === 'scelta' && Array.isArray(carta.opzioni) && carta.rispostaCorretta && !carta.opzioni.includes(carta.rispostaCorretta)) {
      return `${n} (scelta): "rispostaCorretta" deve essere identica a una delle "opzioni"`;
    }
  } else {
    if (!carta.testo) return `${n}: manca "testo"`;
  }
  return null;
}

export function avviaSezioneImporta() {
  document.getElementById('importa-btn-importa').addEventListener('click', eseguiImportazione);
}

async function eseguiImportazione() {
  const risultato = document.getElementById('importa-risultato');
  const nomeMazzo = document.getElementById('importa-select-mazzo').value;
  const fileInput = document.getElementById('importa-input-file');

  if (!fileInput.files.length) {
    risultato.textContent = '❌ Scegli prima un file Excel.';
    return;
  }

  risultato.textContent = 'Leggo il file...';

  try {
    const buffer = await fileInput.files[0].arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const nomeFoglioAtteso = { conoscenza: 'Conoscenza', imprevisto: 'Imprevisto', prova: 'Prova' }[nomeMazzo];
    const nomeFoglio = workbook.SheetNames.includes(nomeFoglioAtteso) ? nomeFoglioAtteso : workbook.SheetNames[0];
    const foglio = workbook.Sheets[nomeFoglio];
    const righe = XLSX.utils.sheet_to_json(foglio, { defval: '' });

    if (righe.length === 0) {
      risultato.textContent = `❌ Nessuna riga trovata nella scheda "${nomeFoglio}".`;
      return;
    }

    const carte = righe.map(riga => rigaACarta(nomeMazzo, riga));
    const errori = carte
      .map((carta, indice) => validaCarta(nomeMazzo, carta, indice))
      .filter(e => e !== null);

    if (errori.length > 0) {
      risultato.innerHTML = `❌ Trovati ${errori.length} problemi nella scheda "${nomeFoglio}", nessuna carta importata:<br>` + errori.join('<br>');
      return;
    }

    risultato.textContent = `Tutto in ordine, importo ${carte.length} carte...`;

    for (const carta of carte) {
      const chiave = nuovaChiaveMazzo(nomeMazzo);
      await salvaCarta(nomeMazzo, chiave, carta);
    }

    risultato.textContent = `✅ Aggiunte ${carte.length} carte a "${nomeMazzo}" dalla scheda "${nomeFoglio}". Quelle già presenti non sono state toccate.`;
    fileInput.value = '';
  } catch (errore) {
    risultato.textContent = '❌ Errore: ' + errore.message;
    console.error(errore);
  }
}