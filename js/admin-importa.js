// admin-importa.js
// Importa ed esporta le carte in Excel. L'importazione riconosce le
// domande già esistenti (stesso testo di "domanda", o di "testo" per
// Imprevisto/Prova) e le aggiorna al posto di duplicarle; quelle nuove
// le aggiunge. Non cancella mai nulla: una riga tolta dal file non tocca
// la carta corrispondente su Firebase — per cancellare si usa sempre il
// cestino nel pannello. Usa la libreria SheetJS (caricata in admin.html
// con un tag <script> a parte) per leggere e scrivere file Excel
// direttamente nel browser.

import { nuovaChiaveMazzo, salvaCarta, leggiMazzoDaFirebase } from './sincronizzazione.js';

const NOMI_FOGLIO = { conoscenza: 'Conoscenza', imprevisto: 'Imprevisto', prova: 'Prova' };
const CAMPO_TESTO = { conoscenza: 'domanda', imprevisto: 'testo', prova: 'testo' };

function pulisci(valore) {
  return (valore === undefined || valore === null) ? '' : valore.toString().trim();
}

function splitLista(testo) {
  const pulito = pulisci(testo);
  if (!pulito) return [];
  return pulito.split(';').map(s => s.trim()).filter(Boolean);
}

// --- da riga di Excel a carta ---

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

// --- da carta a riga di Excel (l'operazione inversa, per l'esportazione) ---

function cartaARiga(nomeMazzo, carta) {
  if (nomeMazzo === 'conoscenza') {
    return {
      domanda: carta.domanda || '',
      tipo: carta.tipo || '',
      risposta: carta.tipo === 'diretta' ? (Array.isArray(carta.risposta) ? carta.risposta.join('; ') : (carta.risposta || '')) : '',
      minimoRichiesto: carta.tipo === 'elenco' ? (carta.minimoRichiesto || '') : '',
      rispostePossibili: carta.tipo === 'elenco' ? (carta.rispostePossibili || []).join('; ') : '',
      opzioni: carta.tipo === 'scelta' ? (carta.opzioni || []).join('; ') : '',
      rispostaCorretta: carta.tipo === 'scelta' ? (carta.rispostaCorretta || '') : ''
    };
  }
  if (nomeMazzo === 'imprevisto') {
    return { testo: carta.testo || '', riferimento: carta.riferimento || '' };
  }
  return { testo: carta.testo || '' };
}

function validaCarta(nomeMazzo, carta, indice) {
  const n = `Riga ${indice + 2}`;

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
  document.getElementById('importa-btn-esporta').addEventListener('click', eseguiEsportazione);
}

async function eseguiEsportazione() {
  const risultato = document.getElementById('importa-risultato');
  risultato.textContent = 'Preparo il file...';

  try {
    const wb = XLSX.utils.book_new();
    let totale = 0;

    for (const nomeMazzo of ['conoscenza', 'imprevisto', 'prova']) {
      const carte = await leggiMazzoDaFirebase(nomeMazzo);
      const righe = carte.map(c => cartaARiga(nomeMazzo, c));
      const foglio = XLSX.utils.json_to_sheet(righe);
      XLSX.utils.book_append_sheet(wb, foglio, NOMI_FOGLIO[nomeMazzo]);
      totale += carte.length;
    }

    const dataOggi = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `carte-corsa-cristiana-${dataOggi}.xlsx`);
    risultato.textContent = `✅ Esportate ${totale} carte in totale.`;
  } catch (errore) {
    risultato.textContent = '❌ Errore: ' + errore.message;
    console.error(errore);
  }
}

async function eseguiImportazione() {
  const risultato = document.getElementById('importa-risultato');
  const fileInput = document.getElementById('importa-input-file');

  if (!fileInput.files.length) {
    risultato.textContent = '❌ Scegli prima un file Excel.';
    return;
  }

  risultato.textContent = 'Leggo il file...';

  try {
    const buffer = await fileInput.files[0].arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const righeDiRiepilogo = [];
    let erroriTotali = [];

    for (const nomeMazzo of ['conoscenza', 'imprevisto', 'prova']) {
      const nomeFoglio = NOMI_FOGLIO[nomeMazzo];
      if (!workbook.SheetNames.includes(nomeFoglio)) continue;

      const foglio = workbook.Sheets[nomeFoglio];
      const righe = XLSX.utils.sheet_to_json(foglio, { defval: '' });
      if (righe.length === 0) continue;

      const carte = righe.map(riga => rigaACarta(nomeMazzo, riga));
      const errori = carte
        .map((carta, indice) => validaCarta(nomeMazzo, carta, indice))
        .filter(e => e !== null)
        .map(e => `[${nomeFoglio}] ${e}`);

      if (errori.length > 0) {
        erroriTotali = erroriTotali.concat(errori);
        continue;
      }

      const campoTesto = CAMPO_TESTO[nomeMazzo];
      const esistenti = await leggiMazzoDaFirebase(nomeMazzo);

      let aggiornate = 0;
      let aggiunte = 0;
      for (const carta of carte) {
        const testoCarta = (carta[campoTesto] || '').trim();
        const trovata = esistenti.find(e => (e[campoTesto] || '').trim() === testoCarta);

        if (trovata) {
          await salvaCarta(nomeMazzo, trovata._chiave, carta);
          aggiornate++;
        } else {
          const chiave = nuovaChiaveMazzo(nomeMazzo);
          await salvaCarta(nomeMazzo, chiave, carta);
          aggiunte++;
        }
      }
      righeDiRiepilogo.push(`${nomeFoglio}: ${aggiornate} aggiornate, ${aggiunte} nuove`);
    }

    if (erroriTotali.length > 0) {
      let messaggio = `❌ Trovati ${erroriTotali.length} problemi (quei fogli non sono stati importati):<br>` + erroriTotali.join('<br>');
      if (righeDiRiepilogo.length > 0) {
        messaggio += '<br><br>✅ Gli altri fogli, senza errori, sono stati importati:<br>' + righeDiRiepilogo.join('<br>');
      }
      risultato.innerHTML = messaggio;
      return;
    }

    if (righeDiRiepilogo.length === 0) {
      risultato.textContent = '❌ Nessuna scheda con dati trovata nel file (cerco "Conoscenza", "Imprevisto", "Prova").';
      return;
    }

    risultato.innerHTML = '✅ Fatto:<br>' + righeDiRiepilogo.join('<br>');
    fileInput.value = '';
  } catch (errore) {
    risultato.textContent = '❌ Errore: ' + errore.message;
    console.error(errore);
  }
}