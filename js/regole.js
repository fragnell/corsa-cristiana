// regole.js
// Il motore del gioco: dado, movimento, risoluzione delle caselle.
// Funzioni pure: ricevono uno stato, restituiscono un nuovo stato — non modificano mai l'originale.
// Chi chiama queste funzioni deve passare "percorso" (il contenuto di percorso.json):
// così regole.js non si preoccupa di come viene caricato il file, e resta facile da testare.

import { CONFIG } from './config.js';

// ---------- IL DADO ----------

export function tiraDado() {
  let totale = 0;
  for (let i = 0; i < CONFIG.dado.numeroDadi; i++) {
    totale += 1 + Math.floor(Math.random() * CONFIG.dado.facce);
  }
  return totale;
}

// ---------- FUNZIONI DI SUPPORTO (uso interno, non esportate) ----------

function trovaCasella(percorso, numero) {
  return percorso.find(c => c.numero === numero);
}

// La casella con il numero più alto: essendo numerate 1..N senza buchi,
// coincide con quante caselle ci sono in tutto. Non è un numero scritto a mano.
function ultimaCasella(percorso) {
  return percorso.length;
}

function copiaStato(stato) {
  return structuredClone(stato);
}

// Sposta il giocatore di turno di "quantita" caselle (può essere negativa).
// Non attiva mai la casella su cui atterra: usata per i bonus/malus di
// Conoscenza, Imprevisto e Prova.
function spostaGiocatore(stato, percorso, quantita, evento) {
  const giocatore = stato.giocatori[stato.turnoDi];
  let nuovaPosizione = giocatore.posizione + quantita;

  if (nuovaPosizione >= ultimaCasella(percorso)) {
    giocatore.posizione = ultimaCasella(percorso);
    stato.vincitore = giocatore.id;
    return { stato, evento: { tipo: 'VITTORIA' } };
  }

  if (nuovaPosizione < 1) nuovaPosizione = 1; // non si scende mai sotto la partenza

  giocatore.posizione = nuovaPosizione;
  return { stato, evento };
}

// Guarda che tipo di casella è e applica subito l'effetto, se non richiede un giudice.
function risolviCasella(stato, percorso, casella) {
  const giocatore = stato.giocatori[stato.turnoDi];

  switch (casella.tipo) {

    case 'IMPREVISTO':
      return spostaGiocatore(stato, percorso, CONFIG.imprevisto.malus, { tipo: 'IMPREVISTO' });

    case 'FERMO':
      giocatore.saltaProssimoTurno = true;
      return { stato, evento: { tipo: 'FERMO' } };

    case 'SALTO': {
      giocatore.posizione = casella.vaiA;
      // saltoAttivaCasella è false nella configurazione attuale: la casella
      // di arrivo resta silenziosa. Per farla attivare, si interviene qui.
      return { stato, evento: { tipo: 'SALTO', destinazione: casella.vaiA, nomeEvento: casella.evento } };
    }

    case 'CONOSCENZA':
      // Il giocatore resta qui: serve applicaRispostaConoscenza per completare l'effetto.
      return { stato, evento: { tipo: 'IN_ATTESA', casella: 'CONOSCENZA' } };

    case 'PROVA':
      // Il giocatore resta qui: serve applicaEsitoProva per completare l'effetto.
      return { stato, evento: { tipo: 'IN_ATTESA', casella: 'PROVA' } };

    case 'PARTENZA':
    case 'ARRIVO':
      return { stato, evento: { tipo: 'NESSUN_EFFETTO' } };

    default:
      throw new Error(`Tipo di casella sconosciuto: ${casella.tipo}`);
  }
}

// ---------- MOVIMENTO ----------

// Muove il giocatore di turno di "valoreDado" caselle e risolve dove atterra.
export function muoviGiocatore(stato, percorso, valoreDado) {
  const nuovoStato = copiaStato(stato);
  const giocatore = nuovoStato.giocatori[nuovoStato.turnoDi];
  nuovoStato.ultimoLancio = valoreDado;

  const nuovaPosizione = giocatore.posizione + valoreDado;

  if (nuovaPosizione >= ultimaCasella(percorso)) {
    giocatore.posizione = ultimaCasella(percorso);
    nuovoStato.vincitore = giocatore.id;
    return { stato: nuovoStato, evento: { tipo: 'VITTORIA' } };
  }

  giocatore.posizione = nuovaPosizione;
  const casella = trovaCasella(percorso, nuovaPosizione);
  return risolviCasella(nuovoStato, percorso, casella);
}

// ---------- ESITI CHE RICHIEDONO UN GIUDICE ----------

// Da chiamare dopo che il giudice ha detto se la risposta alla Conoscenza era giusta.
export function applicaRispostaConoscenza(stato, percorso, corretta) {
  const nuovoStato = copiaStato(stato);
  const quantita = corretta
    ? CONFIG.conoscenza.bonusRispostaCorretta
    : CONFIG.conoscenza.malusRispostaErrata;
  return spostaGiocatore(nuovoStato, percorso, quantita, { tipo: 'CONOSCENZA', corretta });
}

// Da chiamare dopo che il gruppo ha detto se la Prova è stata superata.
export function applicaEsitoProva(stato, percorso, superata) {
  const nuovoStato = copiaStato(stato);
  const quantita = superata
    ? CONFIG.prova.bonusSuperata
    : CONFIG.prova.malusFallita;
  return spostaGiocatore(nuovoStato, percorso, quantita, { tipo: 'PROVA', superata });
}

// ---------- PASSAGGIO DI TURNO ----------

// Passa al giocatore successivo, saltando automaticamente chi ha
// saltaProssimoTurno attivo (le caselle FERMO).
export function passaTurno(stato) {
  const nuovoStato = copiaStato(stato);
  const n = nuovoStato.giocatori.length;
  let prossimo = (nuovoStato.turnoDi + 1) % n;

  let tentativi = 0;
  while (nuovoStato.giocatori[prossimo].saltaProssimoTurno && tentativi < n) {
    nuovoStato.giocatori[prossimo].saltaProssimoTurno = false;
    prossimo = (prossimo + 1) % n;
    tentativi++;
  }

  nuovoStato.turnoDi = prossimo;
  return nuovoStato;
}