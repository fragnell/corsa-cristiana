// stato.js
// Crea e legge lo stato della partita.
// Questo file non applica regole (quello è compito di regole.js) —
// si occupa solo della "forma" dei dati e di come nasce una partita nuova.

import { CONFIG } from './config.js';

// Crea un singolo giocatore
function creaGiocatore(indice, nome, colore) {
  return {
    id: indice,              // 0, 1, 2... la sua posizione nell'elenco giocatori
    nome: nome,
    colore: colore,
    posizione: 1,             // tutti partono dalla casella 1 (PARTENZA)
    saltaProssimoTurno: false
  };
}

// Crea lo stato iniziale di una partita nuova.
// giocatoriInfo: elenco di oggetti { nome, colore }
export function creaStatoIniziale(giocatoriInfo) {
  const n = giocatoriInfo.length;

  if (n < CONFIG.giocatori.minimo || n > CONFIG.giocatori.massimo) {
    throw new Error(
      `Servono da ${CONFIG.giocatori.minimo} a ${CONFIG.giocatori.massimo} giocatori, ricevuti: ${n}`
    );
  }

  return {
    giocatori: giocatoriInfo.map((g, indice) => creaGiocatore(indice, g.nome, g.colore)),
    turnoDi: 0,          // indice del giocatore di turno, si parte dal primo
    ultimoLancio: null,  // risultato dell'ultimo tiro di dado, per mostrarlo a schermo
    vincitore: null      // resta null finché nessuno vince
  };
}

// Il giocatore di cui è il turno adesso
export function giocatoreDiTurno(stato) {
  return stato.giocatori[stato.turnoDi];
}

// True quando la partita è finita
export function partitaFinita(stato) {
  return stato.vincitore !== null;
}