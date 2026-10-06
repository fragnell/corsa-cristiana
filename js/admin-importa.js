// admin-importa.js
// Importa ed esporta le carte in Excel. L'importazione riconosce le
// domande già esistenti (stesso testo di "domanda", o di "testo" per
// Imprevisto/Prova) e le aggiorna al posto di duplicarle; quelle nuove
// le aggiunge. Non cancella mai nulla: una riga tolta dal file non tocca
// la carta corrispondente su Firebase — per cancellare si usa sempre il
// cestino nel pannello. Usa la libreria SheetJS (caricata in admin.html
// con un tag <script> a parte) per leggere e scrivere file Excel
// direttamente nel browser.
// Le domande Conoscenza hanno anche la colonna "approfondisci": il link
// (facoltativo) del pulsante Approfondisci, controllato da
// link-approfondimento.js. L'importazione sostituisce la carta con quella
// del file, quindi per non perdere i link già salvati: se il file non ha
// la colonna "approfondisci" il link della carta resta com'è; se la colonna
// c'è, vale quella (una cella vuota toglie il link).

import { nuovaChiaveMazzo, salvaCarta, leggiMazzoDaFirebase } from './sincronizzazione.js';
import { controllaLink } from './link-approfondimento.js';

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
      const juniorTesto = pulisci(riga.junior).toLowerCase();
      if (juniorTesto === 'si' || juniorTesto === 'sì') carta.junior = true;
    }
    // Cella vuota = nessun link (il campo non c'è proprio, non resta vuoto).
    // Se il testo non è un link buono lo segnala validaCarta.
    const link = pulisci(riga.approfondisci);
    if (link) carta.linkApprofondimento = link;
    return carta;
  }
  const carta = { testo: pulisci(riga.testo) };
  if (nomeMazzo === 'imprevisto') {
    const riferimento = pulisci(riga.riferimento);
    if (riferimento) carta.riferimento = riferimento;
  }
  if (nomeMazzo === 'prova') {
    const vincoloTesto = pulisci(riga.vincolo).toLowerCase();
    if (vincoloTesto === 'si' || vincoloTesto === 'sì') carta.vincolo = true;
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
      rispostaCorretta: carta.tipo === 'scelta' ? (carta.rispostaCorretta || '') : '',
      junior: carta.tipo === 'scelta' && carta.junior ? 'sì' : '',
      approfondisci: carta.linkApprofondimento || ''
    };
  }
  if (nomeMazzo === 'imprevisto') {
    return { testo: carta.testo || '', riferimento: carta.riferimento || '' };
  }
  return { testo: carta.testo || '', vincolo: carta.vincolo ? 'sì' : '' };
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
    if (carta.linkApprofondimento) {
      const esitoLink = controllaLink(carta.linkApprofondimento);
      if (!esitoLink.valido) return `${n}: il link in "approfondisci" non va bene. ${esitoLink.motivo}`;
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

      // Una colonna scritta "Approfondisci" o "approfondisci " non verrebbe
      // riconosciuta e i suoi link verrebbero ignorati senza dire nulla: meglio
      // fermarsi e dirlo.
      if (nomeMazzo === 'conoscenza') {
        const colonnaSimile = Object.keys(righe[0]).find(nome => nome !== 'approfondisci' && nome.trim().toLowerCase() === 'approfondisci');
        if (colonnaSimile) {
          erroriTotali.push(`[${nomeFoglio}] La colonna "${colonnaSimile}" deve chiamarsi esattamente "approfondisci" (tutto minuscolo, senza spazi).`);
          continue;
        }
      }

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
      // Con defval '' ogni riga ha tutte le colonne del foglio, anche vuote:
      // basta guardare se "approfondisci" è tra le chiavi.
      const foglioHaColonnaLink = righe.some(riga => Object.prototype.hasOwnProperty.call(riga, 'approfondisci'));

      // Se in Firebase ci sono due domande con lo stesso testo, due righe del
      // file con quel testo prendono una domanda ciascuna, in ordine (invece di
      // finire tutte e due sulla prima). Se le righe sono più delle domande,
      // le righe in più aggiornano ancora la prima, come è sempre stato.
      const giaUsate = new Set();
      let aggiornate = 0;
      let aggiunte = 0;
      let linkCambiati = 0;
      for (const carta of carte) {
        const testoCarta = (carta[campoTesto] || '').trim();
        const stesse = esistenti.filter(e => (e[campoTesto] || '').trim() === testoCarta);
        const trovata = stesse.find(e => !giaUsate.has(e._chiave)) || stesse[0];

        if (trovata) {
          giaUsate.add(trovata._chiave);
          // Il file non parla di link: quello già salvato non si tocca.
          if (nomeMazzo === 'conoscenza' && !foglioHaColonnaLink && trovata.linkApprofondimento) {
            carta.linkApprofondimento = trovata.linkApprofondimento;
          }
          // Si conta ogni link che c'era e ora è sparito o diverso, per dirlo nel
          // riepilogo (un file vecchio con la colonna può togliere link nuovi).
          if (nomeMazzo === 'conoscenza' && trovata.linkApprofondimento && trovata.linkApprofondimento !== carta.linkApprofondimento) {
            linkCambiati++;
          }
          await salvaCarta(nomeMazzo, trovata._chiave, carta);
          aggiornate++;
        } else {
          const chiave = nuovaChiaveMazzo(nomeMazzo);
          await salvaCarta(nomeMazzo, chiave, carta);
          aggiunte++;
        }
      }
      const notaLink = linkCambiati > 0 ? ` (link tolti o cambiati: ${linkCambiati})` : '';
      righeDiRiepilogo.push(`${nomeFoglio}: ${aggiornate} aggiornate, ${aggiunte} nuove${notaLink}`);
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