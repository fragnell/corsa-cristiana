// rete-salmo.js
// Salmo 133:1 — tutto cio' che la prova scrive e legge su Firebase, in un
// posto solo (come fa sincronizzazione.js per il resto del gioco).
//
// Dove stanno i dati (sotto partite/{codice}):
//   salmo/segreti/primo            { sid, tessere }     letto solo dal primo
//   salmo/segreti/ultimo           { sid, mescolata }   letto solo dall'ultimo
//   salmo/risposte/{sid}/pronto/{giocatore}   true
//   salmo/risposte/{sid}/sbirciata            true
//   salmo/risposte/{sid}/consegne/{n}         { ordine, automatica }
//   salmo/capacita/{giocatore}     true   "questo telefono sa fare la prova"
//   intenzione                     la casella del dado (la prova la tiene pulita)
// E le statistiche anonime in: statistiche/salmo/...
//
// Le scritture dei telefoni hanno un tempo massimo (conLimite): con la rete
// caduta Firebase non fallisce, aspetta all'infinito.

import { db, ref, set, get, onValue, update, increment } from '../rete.js';
import { conLimite } from './tempo.js';

const LIMITE_RETE_MS = 8000;

const radice = codice => `partite/${codice}/salmo`;

// ---------- sul tabellone ----------

export function creaReteTabellone(codicePartita) {
  const r = radice(codicePartita);
  return {
    // Una sola scrittura per tutti e due i segreti.
    scriviSegreti(sessione) {
      return update(ref(db), {
        [`${r}/segreti/primo`]: sessione.segretoPrimo,
        [`${r}/segreti/ultimo`]: sessione.segretoUltimo
      });
    },

    // Ascolta cio' che mandano i telefoni per QUESTA prova. Restituisce la
    // funzione per smettere di ascoltare.
    ascolta(sid, callback) {
      return onValue(ref(db, `${r}/risposte/${sid}`), istantanea => callback(istantanea.val() || {}));
    },

    // Toglie segreti e risposte, e anche l'eventuale "intenzione" rimasta nella
    // casella del dado (altrimenti un vecchio "tiro il dado" potrebbe far
    // tirare subito il turno dopo).
    pulisci() {
      return update(ref(db), {
        [`${r}/segreti`]: null,
        [`${r}/risposte`]: null,
        [`partite/${codicePartita}/intenzione`]: null
      });
    }
  };
}

export function ascoltaCapacita(codicePartita, callback) {
  return onValue(ref(db, `${radice(codicePartita)}/capacita`), istantanea => callback(istantanea.val() || {}));
}

// ---------- sul telefono ----------

// "Il mio telefono sa fare la prova": cosi' il tabellone non la avvia mai con
// un telefono rimasto con una versione vecchia della pagina.
export function dichiaraCapacita(codicePartita, giocatoreId) {
  return conLimite(() => set(ref(db, `${radice(codicePartita)}/capacita/${giocatoreId}`), true), LIMITE_RETE_MS);
}

// ruolo: 'primo' | 'ultimo'. Restituisce { sid, tessere } oppure { sid, mescolata }, o null.
export async function leggiSegreto(codicePartita, ruolo) {
  const istantanea = await conLimite(() => get(ref(db, `${radice(codicePartita)}/segreti/${ruolo}`)), LIMITE_RETE_MS);
  return istantanea.val();
}

export function inviaPronto(codicePartita, sid, giocatoreId) {
  return conLimite(() => set(ref(db, `${radice(codicePartita)}/risposte/${sid}/pronto/${giocatoreId}`), true), LIMITE_RETE_MS);
}

export function inviaSbirciata(codicePartita, sid) {
  return conLimite(() => set(ref(db, `${radice(codicePartita)}/risposte/${sid}/sbirciata`), true), LIMITE_RETE_MS);
}

// "indice" e' il numero del tentativo (0 il primo, 1 il secondo...).
export function inviaConsegna(codicePartita, sid, indice, ordine, automatica) {
  return conLimite(
    () => set(ref(db, `${radice(codicePartita)}/risposte/${sid}/consegne/${indice}`), { ordine, automatica: !!automatica }),
    LIMITE_RETE_MS
  );
}

// Una lettura sola di cio' che e' gia' stato mandato (serve a un telefono che
// ricarica la pagina a meta' prova: ad esempio per sapere se la sbirciata e'
// gia' stata usata).
export async function leggiRisposte(codicePartita, sid) {
  const istantanea = await conLimite(() => get(ref(db, `${radice(codicePartita)}/risposte/${sid}`)), LIMITE_RETE_MS);
  return istantanea.val() || {};
}

// ---------- statistiche anonime ----------

// Solo numeri: nessun nome, nessun codice partita. Si usa "increment", cosi'
// non serve leggere prima il valore e non si rallenta mai la partita.
export function registraStatisticheSalmo({ esito, motivo, durataMs, tentativi, sbirciata, livello }) {
  const quale = esito === 'successo' ? 'successi' : (esito === 'fallimento' ? 'fallimenti' : 'annullate');
  const lv = livello === 'bambini' ? 'bambini' : 'normale';
  const aggiornamenti = {
    'statistiche/salmo/attivate': increment(1),
    [`statistiche/salmo/${quale}`]: increment(1),
    [`statistiche/salmo/perLivello/${lv}/${quale}`]: increment(1)
  };
  if (esito === 'annullato') {
    const m = String(motivo || 'sconosciuto').replace(/[.$#\[\]\/]/g, '-');
    aggiornamenti[`statistiche/salmo/motiviAnnullo/${m}`] = increment(1);
  } else {
    aggiornamenti['statistiche/salmo/proveConcluse'] = increment(1);
    aggiornamenti['statistiche/salmo/tempoTotaleMs'] = increment(Math.max(0, Math.round(Number(durataMs) || 0)));
    aggiornamenti['statistiche/salmo/consegneSbagliate'] = increment(Math.max(0, Math.floor(Number(tentativi) || 0)));
    if (sbirciata) aggiornamenti['statistiche/salmo/sbirciate'] = increment(1);
  }
  return update(ref(db), aggiornamenti);
}

export async function leggiStatisticheSalmo() {
  const istantanea = await get(ref(db, 'statistiche/salmo'));
  return istantanea.val() || {};
}
