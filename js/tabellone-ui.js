// tabellone-ui.js
// Per ora: carica il percorso, le carte e il motore, e conferma che sia
// andato tutto bene. Qui aggiungeremo il disegno vero del tabellone.

import { creaStatoIniziale, giocatoreDiTurno } from './stato.js';
import { tiraDado, muoviGiocatore } from './regole.js';

async function caricaJSON(url) {
  const risposta = await fetch(url);
  if (!risposta.ok) {
    throw new Error(`Impossibile caricare ${url} (${risposta.status})`);
  }
  return risposta.json();
}

async function avvia() {
  const div = document.getElementById('stato-caricamento');

  try {
    div.textContent = 'Carico il tabellone...';
    const percorso = (await caricaJSON('dati/percorso.json')).celle;

    div.textContent = 'Carico le carte...';
    const carteConoscenza = (await caricaJSON('dati/carte-conoscenza.json')).carte;
    const carteImprevisto = (await caricaJSON('dati/carte-imprevisto.json')).carte;
    const carteProva = (await caricaJSON('dati/carte-prova.json')).carte;

    div.textContent = 'Creo la partita di prova...';
    let stato = creaStatoIniziale([
      { nome: 'Marco', colore: 'rosso' },
      { nome: 'Giulia', colore: 'blu' },
      { nome: 'Luca', colore: 'verde' },
      { nome: 'Sara', colore: 'giallo' }
    ]);

    const dado = tiraDado();
    const risultato = muoviGiocatore(stato, percorso, dado);
    stato = risultato.stato;

    div.innerHTML = `
      <p>✅ Tutto caricato correttamente.</p>
      <p>Percorso: ${percorso.length} caselle</p>
      <p>Carte: ${carteConoscenza.length} Conoscenza, ${carteImprevisto.length} Imprevisto, ${carteProva.length} Prova</p>
      <p>${giocatoreDiTurno(stato).nome} ha tirato ${dado} ed è ora sulla casella ${giocatoreDiTurno(stato).posizione}</p>
      <p>Evento: ${JSON.stringify(risultato.evento)}</p>
    `;
  } catch (errore) {
    div.textContent = '❌ Errore: ' + errore.message;
    console.error(errore);
  }
}

avvia();