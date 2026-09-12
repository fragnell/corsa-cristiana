// stato.js
// Crea e legge lo stato della partita.
// Questo file non applica regole (quello è compito di regole.js) —
// si occupa solo della "forma" dei dati e di come nasce una partita nuova.

import { CONFIG } from './config.js';

// Crea un singolo giocatore
function creaGiocatore(indice, nome, colore, junior) {
  const giocatore = {
    id: indice,
    nome: nome,
    colore: colore,
    posizione: 1,
    saltaProssimoTurno: false
  };
  if (junior) giocatore.junior = true;
  return giocatore;
}

export function creaStatoIniziale(giocatoriInfo) {
  const n = giocatoriInfo.length;

  if (n < CONFIG.giocatori.minimo || n > CONFIG.giocatori.massimo) {
    throw new Error(
      `Servono da ${CONFIG.giocatori.minimo} a ${CONFIG.giocatori.massimo} giocatori, ricevuti: ${n}`
    );
  }

  return {
    giocatori: giocatoriInfo.map((g, indice) => creaGiocatore(indice, g.nome, g.colore, g.junior)),
    turnoDi: 0,
    ultimoLancio: null,
    vincitore: null
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