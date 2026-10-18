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

// ---------- NUMERO SCRITTO SULLA CASELLA ----------

// La casella di partenza si chiama "VIA!" (non ha un numero): tutte le altre mostrano il numero
// che avrebbero se "VIA!" non contasse come casella 1 (la 2 diventa "1", la 63/ARRIVO diventa "62"...).
// La posizione vera (quella usata per muoversi, saltare, vincere) resta sempre 1-63: cambia solo
// la scritta che vede chi gioca.
export function etichettaPosizione(numero) {
  return numero === 1 ? 'VIA!' : String(numero - 1);
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

// ---------- SALTO CHE ATTIVA LA CASELLA DI ARRIVO ----------

// Un salto che porta su un altro salto (e cosi' via) non puo' andare avanti all'infinito:
// dopo tre salti di fila la catena si ferma, qualunque sia il percorso.
export const MAX_SALTI_DI_FILA = 3;

// True se, dopo questo evento, bisogna far scattare anche la casella su cui il giocatore e'
// arrivato: succede solo dopo un SALTO, con la regola "saltoAttivaCasella" accesa e senza aver
// superato il limite di salti di fila. "saltiFatti" = quanti salti sono gia' stati risolti in questo turno.
export function saltoAttivaArrivo(evento, config = CONFIG, saltiFatti = 0) {
  return !!evento
    && evento.tipo === 'SALTO'
    && !!(config.regole && config.regole.saltoAttivaCasella)
    && saltiFatti < MAX_SALTI_DI_FILA;
}

// Dopo un SALTO, se la regola "saltoAttivaCasella" e' accesa, la casella su cui
// si arriva scatta come se ci si fosse atterrati con il dado (per esempio una
// domanda Conoscenza). Non sposta nessuno: risolve la casella su cui il
// giocatore di turno si trova adesso. Restituisce lo stesso tipo di risultato
// di muoviGiocatore: { stato, evento }.
export function risolviCasellaDiArrivo(stato, percorso, config = CONFIG) {
  const nuovoStato = copiaStato(stato);
  const giocatore = nuovoStato.giocatori[nuovoStato.turnoDi];
  const casella = trovaCasella(percorso, giocatore.posizione);
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