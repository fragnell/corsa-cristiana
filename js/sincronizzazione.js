// sincronizzazione.js
// Tutte le funzioni che parlano con Firebase durante una partita: creare
// il codice, pubblicare e leggere lo stato, inviare e aspettare le
// intenzioni dei giocatori. Un solo file che conosce i percorsi dentro il
// database, così tabellone e telefono restano sempre d'accordo tra loro.

import { db, ref, set, get, onValue, push, runTransaction, remove, onDisconnect } from './rete.js';

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

// Aspetta che il giocatore atteso tiri il dado, ma non per sempre: se
// scade il tempo (timeoutMs), procede comunque — il valore del dado resta
// deciso da tiraDado() indipendentemente da cosa ha fatto scattare il
// turno, quindi non cambia nulla sulla casualità.
export function aspettaIntenzioneDado(codicePartita, giocatoreAtteso, timeoutMs) {
  return new Promise(risolvi => {
    const percorsoIntenzione = ref(db, `partite/${codicePartita}/intenzione`);
    let concluso = false;

    const staccaAscolto = onValue(percorsoIntenzione, (istantanea) => {
      const intenzione = istantanea.val();
      if (intenzione && intenzione.tipo === 'TIRA_DADO' && intenzione.giocatoreId === giocatoreAtteso) {
        concludi();
      }
    });

    const timer = setTimeout(concludi, timeoutMs);

    function concludi() {
      if (concluso) return;
      concluso = true;
      clearTimeout(timer);
      staccaAscolto();
      set(percorsoIntenzione, null);
      risolvi();
    }
  });
}

export function inviaIntenzioneRisposta(codicePartita, giocatoreId, risposte) {
  return set(ref(db, `partite/${codicePartita}/intenzione`), {
    tipo: 'RISPOSTA_CONOSCENZA',
    giocatoreId,
    risposte
  });
}

// Stesso principio del dado: se scade il tempo senza risposta, si
// procede con un elenco vuoto — che per come valutaRisposta controlla
// diretta/elenco/scelta risulta sempre in una risposta sbagliata, senza
// bisogno di un caso speciale.
export function aspettaIntenzioneRisposta(codicePartita, giocatoreAtteso, timeoutMs) {
  return new Promise(risolvi => {
    const percorsoIntenzione = ref(db, `partite/${codicePartita}/intenzione`);
    let concluso = false;

    const staccaAscolto = onValue(percorsoIntenzione, (istantanea) => {
      const intenzione = istantanea.val();
      if (intenzione && intenzione.tipo === 'RISPOSTA_CONOSCENZA' && intenzione.giocatoreId === giocatoreAtteso) {
        concludi(intenzione.risposte || []);
      }
    });

    const timer = setTimeout(() => concludi([]), timeoutMs);

    function concludi(risposte) {
      if (concluso) return;
      concluso = true;
      clearTimeout(timer);
      staccaAscolto();
      set(percorsoIntenzione, null);
      risolvi(risposte);
    }
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

// Aggiunge un giocatore alla lobby, controllando nome e colore in modo
// sicuro anche se più persone si iscrivono nello stesso istante — usa una
// "transazione" di Firebase: il tentativo di scrittura viene ricontrollato
// sui dati più freschi possibile appena prima di scrivere, e ritentato da
// solo se qualcosa è cambiato nel frattempo. Niente più finestra in cui
// due persone possono leggere "libero" nello stesso momento.
//
// Nota per il futuro: quando arriveranno gli avatar, "colore" smetterà di
// essere scelto direttamente — diventerà una proprietà intrinseca
// dell'avatar scelto (ogni avatar avrà il suo colore fisso). Il controllo
// di unicità qui sotto si sposterà quindi sull'avatar scelto invece che
// sul colore ("g.avatar === avatarScelto" al posto di "g.colore ===
// colore"), ma la "cornice" della transazione — quella che rende il
// controllo sicuro anche con più persone insieme — resta identica: è
// la stessa che protegge il colore oggi che proteggerà l'avatar domani.
// Aggiunge un giocatore alla lobby, controllando nome e colore in modo
// sicuro anche se più persone si iscrivono nello stesso istante (stessa
// transazione di sempre). "junior" è facoltativo: se true, viene salvato
// insieme al resto — la conferma dal tabellone avviene altrove, guardando
// la lobby e reagendo a questo stesso campo.
export async function unisciti(codicePartita, nome, colore, junior) {
  const percorsoLobby = ref(db, `partite/${codicePartita}/lobby`);
  let motivoFallimento = null;

  const risultato = await runTransaction(percorsoLobby, (lobbyAttuale) => {
    const lobby = lobbyAttuale || [];

    if (lobby.some(g => g.nome.toLowerCase() === nome.toLowerCase())) {
      motivoFallimento = 'nome-preso';
      return;
    }
    if (lobby.some(g => g.colore === colore)) {
      motivoFallimento = 'colore-preso';
      return;
    }

    const nuovoGiocatore = { nome, colore };
    if (junior) nuovoGiocatore.junior = true;
    return [...lobby, nuovoGiocatore];
  });

  if (!risultato.committed) {
    return { ok: false, motivo: motivoFallimento || 'sconosciuto' };
  }
  return { ok: true };
}


// --- Presenza: sa il server, non il client, quando un dispositivo sparisce ---

// Da chiamare una volta che un giocatore ha il proprio id (a partita
// iniziata). Usa .info/connected, il percorso speciale che Firebase offre
// sempre per sapere quando la connessione è (ri)stabilita — così, anche
// se la connessione cade e poi torna, il segnale si registra di nuovo da
// solo, senza bisogno di ricordarsene altrove.
export function impostaPresenza(codicePartita, giocatoreId) {
  const percorsoPresenza = ref(db, `partite/${codicePartita}/presenza/${giocatoreId}`);
  onValue(ref(db, '.info/connected'), (istantanea) => {
    if (istantanea.val() === true) {
      onDisconnect(percorsoPresenza).set(false);
      set(percorsoPresenza, true);
    }
  });
}

export function ascoltaPresenza(codicePartita, callback) {
  return onValue(ref(db, `partite/${codicePartita}/presenza`), (istantanea) => {
    callback(istantanea.val() || {});
  });
}

// Toglie il segno "junior" da un giocatore già in lobby — usata quando il
// tabellone rifiuta la richiesta (il gruppo ha detto di no, o si è scelto
// esplicitamente "no" al countdown). Il giocatore resta in lobby, gioca
// solo con le domande normali.
export async function rifiutaJuniorInLobby(codicePartita, nome) {
  const percorsoLobby = ref(db, `partite/${codicePartita}/lobby`);
  await runTransaction(percorsoLobby, (lobbyAttuale) => {
    const lobby = lobbyAttuale || [];
    return lobby.map(g => {
      if (g.nome !== nome) return g;
      const { junior, ...resto } = g;
      return resto;
    });
  });
}

// --- I mazzi di carte, dentro Firebase invece che in file statici ---

export async function leggiMazzoDaFirebase(nomeMazzo) {
  const istantanea = await get(ref(db, `mazzi/${nomeMazzo}`));
  const oggetto = istantanea.val() || {};
  return Object.entries(oggetto).map(([chiave, carta]) => ({ ...carta, _chiave: chiave }));
}

export function nuovaChiaveMazzo(nomeMazzo) {
  return push(ref(db, `mazzi/${nomeMazzo}`)).key;
}

export function ascoltaMazzo(nomeMazzo, callback) {
  return onValue(ref(db, `mazzi/${nomeMazzo}`), (istantanea) => {
    const oggetto = istantanea.val() || {};
    const carte = Object.entries(oggetto).map(([chiave, carta]) => ({ ...carta, _chiave: chiave }));
    callback(carte);
  });
}

export function salvaCarta(nomeMazzo, chiave, carta) {
  return set(ref(db, `mazzi/${nomeMazzo}/${chiave}`), carta);
}

export function eliminaCarta(nomeMazzo, chiave) {
  return set(ref(db, `mazzi/${nomeMazzo}/${chiave}`), null);
}

export function aggiungiRispostaACarta(carta, nuovaRisposta) {
  const rispostaAggiornata = Array.isArray(carta.risposta)
    ? [...carta.risposta, nuovaRisposta]
    : [carta.risposta, nuovaRisposta];

  carta.risposta = rispostaAggiornata;

  const { _chiave, ...contenutoCarta } = carta;
  return salvaCarta('conoscenza', _chiave, contenutoCarta);
}


// --- Regole personalizzate dal pannello (sovrascrivono config.js) ---

export async function leggiConfigDaFirebase() {
  const istantanea = await get(ref(db, 'configurazione'));
  return istantanea.val() || {};
}

export async function salvaConfigDaFirebase(configParziale) {
  await set(ref(db, 'configurazione'), configParziale);
}

export async function eliminaConfigDaFirebase() {
  await remove(ref(db, 'configurazione'));
}


// --- Abbandono volontario ---
// Il telefono non scrive mai "abbandonato" direttamente dentro stato
// (verrebbe cancellato alla prossima pubblicazione del tabellone, che
// non ne saprebbe nulla) — manda invece un segnale a parte, che il
// tabellone recepisce e scrive lui stesso, come già fa con dado e
// risposte.
export async function richiediAbbandono(codicePartita, giocatoreId) {
  await set(ref(db, `partite/${codicePartita}/abbandoni/${giocatoreId}`), true);
}

export function ascoltaAbbandoni(codicePartita, callback) {
  return onValue(ref(db, `partite/${codicePartita}/abbandoni`), (istantanea) => {
    callback(istantanea.val() || {});
  });
}