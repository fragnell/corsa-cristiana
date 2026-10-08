// rotazione-domande.js
// La memoria di "in quale partita e' uscita l'ultima volta ogni domanda
// Conoscenza", salvata nel BROWSER di questo tabellone (localStorage) e non
// su Firebase. Serve alla pescata a rotazione di mazzi.js: la partita dopo
// riparte dalle domande che mancano da piu' tempo.
//
// Perche' qui e non su Firebase: il database e' uno solo per tutti quelli
// che giocano. Se la memoria stesse li', le partite degli altri gruppi
// farebbero avanzare la rotazione anche per noi, e la nostra partita dopo
// potrebbe ripartire proprio dalle domande appena fatte. Cosi' ogni
// tabellone ricorda solo cio' che ha mostrato lui.
//
// Una partita e' un numero progressivo (1, 2, 3...) e non un orario: non
// dipende dall'orologio del dispositivo e il piu' alto e' sempre il piu'
// recente. Se la memoria non e' disponibile (navigazione privata, spazio
// pieno, dati rovinati) non succede nulla di grave: si gioca lo stesso, con
// le domande in ordine casuale.

const CHIAVE_MEMORIA = 'corsa-cristiana-rotazione-conoscenza';

// Il localStorage del browser. Anche solo nominarlo puo' sollevare un errore
// (SecurityError) se il browser blocca i dati dei siti: per questo sta in una
// funzione a parte, che in quel caso restituisce null invece di fallire.
function archivioDelBrowser() {
  try {
    return globalThis.localStorage;
  } catch (errore) {
    return null;
  }
}

// Un numero di partita "vero" e' un intero piccolo (1, 2, 3...). Tutto il
// resto (testi, decimali, negativi, numeri enormi) e' un dato rovinato e
// viene ignorato: un numero gigante, per esempio, bloccherebbe il conteggio
// delle partite.
function eUnNumeroDiPartita(valore) {
  return Number.isInteger(valore) && valore >= 0 && valore < 1e9;
}

// { chiaveDomanda: numeroDellaUltimaPartita }. Non solleva mai errori.
export function leggiMemoriaRotazione(archivio = archivioDelBrowser()) {
  try {
    const salvata = JSON.parse(archivio.getItem(CHIAVE_MEMORIA));
    if (!salvata || typeof salvata !== 'object' || Array.isArray(salvata)) return {};
    const pulita = {};
    for (const [chiave, numero] of Object.entries(salvata)) {
      if (eUnNumeroDiPartita(numero)) pulita[chiave] = numero;
    }
    return pulita;
  } catch (errore) {
    return {};
  }
}

// Il numero della partita che sta per iniziare: uno piu' di quello piu' alto
// gia' visto (1 se non c'e' ancora nessuna memoria).
export function numeroNuovaPartita(memoria) {
  let massimo = 0;
  for (const numero of Object.values(memoria)) {
    if (numero > massimo) massimo = numero;
  }
  return massimo + 1;
}

// Da chiamare appena una domanda viene MOSTRATA sul tabellone, anche se poi
// viene cambiata con "Cambia domanda": i giocatori l'hanno vista comunque,
// quindi non deve ripresentarsi per prima nella partita dopo.
export function segnaDomandaUscita(chiave, numeroPartita, archivio = archivioDelBrowser()) {
  try {
    const memoria = leggiMemoriaRotazione(archivio);
    memoria[chiave] = numeroPartita;
    archivio.setItem(CHIAVE_MEMORIA, JSON.stringify(memoria));
  } catch (errore) {
    // niente memoria, nessun danno: si continua a giocare
  }
}
