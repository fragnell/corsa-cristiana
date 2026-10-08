// regole.js
// Il motore del gioco: dado, movimento, risoluzione delle caselle.
// Funzioni pure: ricevono uno stato, restituiscono un nuovo stato — non modificano mai l'originale.
// Ogni funzione accetta anche "config" come ultimo parametro — se non lo
// passi, usa i valori di base di config.js. Così il pannello Regole può
// sovrascrivere i numeri senza che nulla si rompa se una partita parte
// senza personalizzazioni.

import { CONFIG } from './config.js';

// ---------- IL DADO ----------

export function tiraDado(config = CONFIG) {
  let totale = 0;
  for (let i = 0; i < config.dado.numeroDadi; i++) {
    totale += 1 + Math.floor(Math.random() * config.dado.facce);
  }
  return totale;
}

// ---------- FUNZIONI DI SUPPORTO (uso interno, non esportate) ----------

function trovaCasella(percorso, numero) {
  return percorso.find(c => c.numero === numero);
}

function ultimaCasella(percorso) {
  return percorso.length;
}

function copiaStato(stato) {
  return structuredClone(stato);
}

function spostaGiocatore(stato, percorso, quantita, evento) {
  const giocatore = stato.giocatori[stato.turnoDi];
  let nuovaPosizione = giocatore.posizione + quantita;

  if (nuovaPosizione >= ultimaCasella(percorso)) {
    giocatore.posizione = ultimaCasella(percorso);
    stato.vincitore = giocatore.id;
    return { stato, evento: { tipo: 'VITTORIA' } };
  }

  if (nuovaPosizione < 1) nuovaPosizione = 1;

  giocatore.posizione = nuovaPosizione;
  return { stato, evento };
}

function risolviCasella(stato, percorso, casella, config) {
  const giocatore = stato.giocatori[stato.turnoDi];

  switch (casella.tipo) {

    case 'IMPREVISTO':
      return spostaGiocatore(stato, percorso, config.imprevisto.malus, { tipo: 'IMPREVISTO' });

    case 'FERMO':
      giocatore.saltaProssimoTurno = true;
      return { stato, evento: { tipo: 'FERMO', riferimento: casella.riferimento, testo: casella.testo } };

    case 'SALTO': {
      giocatore.posizione = casella.vaiA;
      return { stato, evento: { tipo: 'SALTO', destinazione: casella.vaiA, nomeEvento: casella.evento } };
    }

    case 'CONOSCENZA':
      return { stato, evento: { tipo: 'IN_ATTESA', casella: 'CONOSCENZA' } };

    case 'PROVA':
      return { stato, evento: { tipo: 'IN_ATTESA', casella: 'PROVA' } };

    case 'PARTENZA':
    case 'ARRIVO':
      return { stato, evento: { tipo: 'NESSUN_EFFETTO' } };

    default:
      throw new Error(`Tipo di casella sconosciuto: ${casella.tipo}`);
  }
}

// ---------- MOVIMENTO ----------

export function muoviGiocatore(stato, percorso, valoreDado, config = CONFIG) {
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
  return risolviCasella(nuovoStato, percorso, casella, config);
}

// ---------- ESITI CHE RICHIEDONO UN GIUDICE ----------

export function applicaRispostaConoscenza(stato, percorso, corretta, config = CONFIG) {
  const nuovoStato = copiaStato(stato);
  const quantita = corretta
    ? config.conoscenza.bonusRispostaCorretta
    : config.conoscenza.malusRispostaErrata;
  return spostaGiocatore(nuovoStato, percorso, quantita, { tipo: 'CONOSCENZA', corretta });
}

export function applicaEsitoProva(stato, percorso, superata, config = CONFIG) {
  const nuovoStato = copiaStato(stato);
  const quantita = superata
    ? config.prova.bonusSuperata
    : config.prova.malusFallita;
  return spostaGiocatore(nuovoStato, percorso, quantita, { tipo: 'PROVA', superata });
}

export function impostaProvaInSospeso(stato, giocatoreId, carta) {
  const nuovoStato = copiaStato(stato);
  nuovoStato.giocatori[giocatoreId].provaInSospeso = { testo: carta.testo, riferimento: carta.riferimento || null };
  return nuovoStato;
}

export function risolviProvaInSospeso(stato, giocatoreId) {
  const nuovoStato = copiaStato(stato);
  nuovoStato.giocatori[giocatoreId].provaInSospeso = null;
  return nuovoStato;
}

// ---------- PASSAGGIO DI TURNO ----------

// Passa al giocatore successivo, saltando chi ha saltaProssimoTurno
// attivo (le caselle FERMO, per UN turno) e chi ha abbandonato la
// partita (per SEMPRE — a differenza di saltaProssimoTurno, questo
// segno non viene mai tolto).
export function passaTurno(stato) {
  const nuovoStato = copiaStato(stato);
  const n = nuovoStato.giocatori.length;
  let prossimo = (nuovoStato.turnoDi + 1) % n;

  let tentativi = 0;
  while ((nuovoStato.giocatori[prossimo].saltaProssimoTurno || nuovoStato.giocatori[prossimo].abbandonato) && tentativi < n) {
    nuovoStato.giocatori[prossimo].saltaProssimoTurno = false;
    prossimo = (prossimo + 1) % n;
    tentativi++;
  }

  nuovoStato.turnoDi = prossimo;
  return nuovoStato;
}