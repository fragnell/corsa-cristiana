// ordine-gioco.js
// Il sorteggio dell'ordine di gioco. Quando il tabellone preme "Inizia partita", i giocatori
// entrati in lobby vengono rimescolati a sorte: chi e' entrato per primo non gioca per forza
// per primo (e chi e' entrato per ultimo non gioca per forza per ultimo). In questo modo
// nessuno parte avvantaggiato.
//
// Questo file non tocca Firebase e non cambia le regole: sorteggia l'elenco e, se serve,
// mostra l'ordine sul tabellone. Il sorteggio si fa PRIMA di creare lo stato della partita:
// i numeri dei giocatori (id) nascono da li' (il primo dell'elenco e' il numero 0, e cosi'
// via) e i telefoni si riconoscono dal nome, quindi niente puo' disallinearsi.

import { PALETTE } from './colori.js';

const DURATA_ANNUNCIO_MS = 10000;   // quanto resta sul tabellone l'elenco dell'ordine
let timerAnnuncio = null;

// Rimescola un elenco (metodo di Fisher-Yates) senza modificare quello originale.
// "caso" e' una funzione che da' un numero da 0 (incluso) a 1 (escluso), di solito
// Math.random: nei test se ne passa una finta, per avere risultati prevedibili.
export function mescola(elenco, caso = Math.random) {
  const copia = elenco.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    let j = Math.floor(caso() * (i + 1));
    if (!(j >= 0)) j = 0;   // un "caso" strano (NaN, negativo...) non fa mai uscire dall'elenco
    if (j > i) j = i;
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// L'elenco dopo il sorteggio deve contenere esattamente gli stessi giocatori di prima,
// ognuno una volta sola: altrimenti qualcuno sparirebbe (o comparirebbe due volte).
export function stessiGiocatori(prima, dopo) {
  if (!Array.isArray(prima) || !Array.isArray(dopo) || dopo.length !== prima.length) return false;
  return prima.every(g => dopo.filter(x => x === g).length === 1);
}

// Sorteggia l'ordine di gioco. Non puo' rompere la partita: se per qualunque motivo il
// risultato non e' una vera rimescolata dello stesso elenco, si usa l'ordine di ingresso.
// ("rimescola" serve solo ai test, per provare proprio questo controllo.)
export function sorteggiaOrdine(giocatoriInfo, caso = Math.random, rimescola = mescola) {
  try {
    const mescolato = rimescola(giocatoriInfo, caso);
    if (stessiGiocatori(giocatoriInfo, mescolato)) return mescolato;
    console.warn("Sorteggio dell'ordine non valido, si gioca nell'ordine di ingresso");
  } catch (errore) {
    console.warn("Sorteggio dell'ordine non riuscito, si gioca nell'ordine di ingresso", errore);
  }
  return giocatoriInfo;
}

// Mostra sul tabellone, per qualche secondo, l'ordine sorteggiato ("1° Anna, 2° Bruno...").
// Non blocca niente e non puo' rompere niente: se qualcosa non va, si gioca lo stesso.
// I nomi entrano sempre come semplice testo, mai come HTML.
export function annunciaOrdine(giocatori, { durataMs = DURATA_ANNUNCIO_MS, documento = globalThis.document } = {}) {
  try {
    const riquadro = documento.getElementById('annuncio-ordine');
    const elenco = documento.getElementById('annuncio-ordine-lista');
    if (!riquadro || !elenco) return;

    elenco.replaceChildren();
    giocatori.forEach(g => {
      const voce = documento.createElement('li');
      const pallino = documento.createElement('span');
      pallino.className = 'pallino-lista';
      pallino.style.background = PALETTE[g.colore] || g.colore;
      voce.append(pallino, String(g.nome));
      elenco.appendChild(voce);
    });

    riquadro.classList.remove('nascosta');
    clearTimeout(timerAnnuncio);
    timerAnnuncio = setTimeout(() => riquadro.classList.add('nascosta'), durataMs);
  } catch (errore) {
    console.warn("Annuncio dell'ordine non riuscito (si gioca lo stesso)", errore);
  }
}
