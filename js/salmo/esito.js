// esito.js
// Salmo 133:1 — cosa cambia nella partita quando la prova finisce.
// Funzione pura: riceve lo stato e restituisce un NUOVO stato (l'originale
// non viene toccato), piu' l'elenco degli spostamenti da animare.
//
// Regole fisse, qualunque cosa dica la configurazione:
//   - la prova non fa mai vincere nessuno (nessuno arriva all'ultima casella);
//   - la prova non mette mai l'ultimo davanti al primo (al massimo pari);
//   - dopo lo spostamento la casella di arrivo NON ha effetto (come per gli
//     altri bonus del gioco: nessun Imprevisto, Salto, Fermo...);
//   - se uno dei due ha abbandonato nel frattempo, non cambia nulla.

import { passaTurno } from '../regole.js';

function copia(stato) {
  return structuredClone(stato);
}

// esito: 'successo' | 'fallimento' | 'annullato'
// ritorna { stato, spostamenti: [{ id, da, a }], turnoPassato }
export function applicaEsitoSalmo(stato, { primoId, ultimoId, esito }, cfg, ultimaCasella) {
  const nuovo = copia(stato);
  const spostamenti = [];
  const primo = nuovo.giocatori[primoId];
  const ultimo = nuovo.giocatori[ultimoId];

  const inValidi = !primo || !ultimo || primo.abbandonato || ultimo.abbandonato || stato.vincitore != null;
  if (inValidi || (esito !== 'successo' && esito !== 'fallimento')) {
    return { stato: nuovo, spostamenti, turnoPassato: false };
  }

  let turnoPassato;

  if (esito === 'successo') {
    const da = ultimo.posizione;
    const tetto = Math.min(primo.posizione, ultimaCasella - 1);
    const a = Math.max(da, Math.min(da + cfg.bonusUltimo, tetto));
    if (a !== da) {
      ultimo.posizione = a;
      spostamenti.push({ id: ultimo.id, da, a });
    }
    turnoPassato = !cfg.ultimoTiraDopoSuccesso;
  } else {
    const da = primo.posizione;
    const pavimento = Math.max(1, ultimo.posizione);
    const a = Math.min(da, Math.max(da + cfg.malusPrimo, pavimento));
    if (a !== da) {
      primo.posizione = a;
      spostamenti.push({ id: primo.id, da, a });
    }
    turnoPassato = cfg.ultimoSaltaSeFallisce;
  }

  const finale = turnoPassato ? passaTurno(nuovo) : nuovo;
  return { stato: finale, spostamenti, turnoPassato };
}
