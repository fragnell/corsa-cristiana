// sincronizzazione.js
// Tutte le funzioni che parlano con Firebase durante una partita: creare
// il codice, pubblicare e leggere lo stato, inviare e aspettare le
// intenzioni dei giocatori. Un solo file che conosce i percorsi dentro il
// database, così tabellone e telefono restano sempre d'accordo tra loro.

import { db, ref, set, get, onValue, push } from './rete.js';

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


export function inviaIntenzioneRisposta(codicePartita, giocatoreId, risposte) {
  return set(ref(db, `partite/${codicePartita}/intenzione`), {
    tipo: 'RISPOSTA_CONOSCENZA',
    giocatoreId,
    risposte
  });
}

// Aspetta che arrivi la risposta di Conoscenza dal giocatore atteso.
// Restituisce l'elenco di risposte che ha scritto.
export function aspettaIntenzioneRisposta(codicePartita, giocatoreAtteso) {
  return new Promise(risolvi => {
    const percorsoIntenzione = ref(db, `partite/${codicePartita}/intenzione`);
    const staccaAscolto = onValue(percorsoIntenzione, (istantanea) => {
      const intenzione = istantanea.val();
      if (intenzione && intenzione.tipo === 'RISPOSTA_CONOSCENZA' && intenzione.giocatoreId === giocatoreAtteso) {
        staccaAscolto();
        set(percorsoIntenzione, null);
        risolvi(intenzione.risposte || []); // Firebase cancella gli array vuoti: senza questo, un elenco confermato senza aggiungere nulla arriverebbe come "undefined" e bloccherebbe tutto
      }
    });
  });
}


// --- La lobby: i giocatori si uniscono prima che la partita inizi ---

export function iniziaLobby(codicePartita) {
  return set(ref(db, `partite/${codicePartita}`), {
    creataIl: Date.now(),
    lobby: []
  });
}

// Controlla se la partita esiste, guardando "creataIl" invece della
// lobby — perché la lobby può essere vuota (nessuno si è ancora unito),
// e Firebase non distingue "vuoto" da "non esiste".
export function verificaPartitaEsiste(codicePartita) {
  return get(ref(db, `partite/${codicePartita}/creataIl`)).then(istantanea => istantanea.val() !== null);
}

export function leggiLobbyUnaVolta(codicePartita) {
  return get(ref(db, `partite/${codicePartita}/lobby`)).then(istantanea => istantanea.val() || []);
}

export function ascoltaLobby(codicePartita, callback) {
  return onValue(ref(db, `partite/${codicePartita}/lobby`), (istantanea) => {
    callback(istantanea.val() || []);
  });
}

// Aggiunge un giocatore alla lobby. Controlla che il nome non sia già
// preso (un controllo "alla buona": se due persone si iscrivono nello
// stesso istante esatto è teoricamente possibile un conflitto, ma per una
// partita in famiglia è un rischio trascurabile).
export async function unisciti(codicePartita, nome, colore) {
  const lobbyAttuale = (await leggiLobbyUnaVolta(codicePartita)) || [];
  const nomeGiaPreso = lobbyAttuale.some(g => g.nome.toLowerCase() === nome.toLowerCase());
  if (nomeGiaPreso) {
    return { ok: false, motivo: 'nome-preso' };
  }
  const nuovaLobby = [...lobbyAttuale, { nome, colore }];
  await set(ref(db, `partite/${codicePartita}/lobby`), nuovaLobby);
  return { ok: true };
}


// --- I mazzi di carte, ora dentro Firebase invece che in file statici ---

// Legge un mazzo intero (conoscenza / imprevisto / prova) e restituisce
// un array di carte, ciascuna con in più "_chiave" — la chiave Firebase
// di quella carta, utile più avanti per modificarla o cancellarla.
export async function leggiMazzoDaFirebase(nomeMazzo) {
  const istantanea = await get(ref(db, `mazzi/${nomeMazzo}`));
  const oggetto = istantanea.val() || {};
  return Object.entries(oggetto).map(([chiave, carta]) => ({ ...carta, _chiave: chiave }));
}

// Genera una chiave unica pronta all'uso, senza scrivere nulla.
export function nuovaChiaveMazzo(nomeMazzo) {
  return push(ref(db, `mazzi/${nomeMazzo}`)).key;
}