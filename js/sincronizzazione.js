// sincronizzazione.js
// Tutte le funzioni che parlano con Firebase durante una partita: creare
// il codice, pubblicare e leggere lo stato, inviare e aspettare le
// intenzioni dei giocatori. Un solo file che conosce i percorsi dentro il
// database, così tabellone e telefono restano sempre d'accordo tra loro.

import { db, ref, set, get, onValue } from './rete.js';

// Un codice a 4 lettere, facile da leggere e da dettare a voce.
// Niente I/O: si confondono troppo facilmente con 1/0.
export function generaCodicePartita() {
  const lettere = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let codice = '';
  for (let i = 0; i < 4; i++) {
    codice += lettere[Math.floor(Math.random() * lettere.length)];
  }
  return codice;
}

export function pubblicaStato(codicePartita, stato) {
  return set(ref(db, `partite/${codicePartita}/stato`), stato);
}

export function leggiStatoUnaVolta(codicePartita) {
  return get(ref(db, `partite/${codicePartita}/stato`)).then(istantanea => istantanea.val());
}

// Chiama "callback" ogni volta che lo stato cambia.
export function ascoltaStato(codicePartita, callback) {
  return onValue(ref(db, `partite/${codicePartita}/stato`), (istantanea) => {
    callback(istantanea.val());
  });
}

export function inviaIntenzioneDado(codicePartita, giocatoreId) {
  return set(ref(db, `partite/${codicePartita}/intenzione`), {
    tipo: 'TIRA_DADO',
    giocatoreId
  });
}

// Aspetta che arrivi l'intenzione "tira il dado" per il giocatore atteso.
// Si risolve una volta sola: poi smette di ascoltare e consuma
// l'intenzione (la rimette a null), così non viene mai elaborata due volte.
export function aspettaIntenzioneDado(codicePartita, giocatoreAtteso) {
  return new Promise(risolvi => {
    const percorsoIntenzione = ref(db, `partite/${codicePartita}/intenzione`);
    const staccaAscolto = onValue(percorsoIntenzione, (istantanea) => {
      const intenzione = istantanea.val();
      if (intenzione && intenzione.tipo === 'TIRA_DADO' && intenzione.giocatoreId === giocatoreAtteso) {
        staccaAscolto();
        set(percorsoIntenzione, null);
        risolvi();
      }
    });
  });
}