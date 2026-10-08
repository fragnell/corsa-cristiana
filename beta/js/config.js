// config.js
// Tutti i numeri e le regole del gioco in un posto solo.
// Per bilanciare diversamente, si cambia un valore qui — non serve toccare il resto del codice.

export const CONFIG = {

  // Il dado
  dado: {
    facce: 6,
    numeroDadi: 1
  },

  // Caselle CONOSCENZA
  conoscenza: {
    bonusRispostaCorretta: 3,   // risposta giusta: avanza di 3
    malusRispostaErrata: 0,     // risposta sbagliata: resta fermo
    sfidaBonusVincitore: 3,     // provvisorio: chi vince la sfida avanza
    sfidaMalusPerdente: -2      // provvisorio: chi perde la sfida retrocede
  },

  // Caselle IMPREVISTO
  imprevisto: {
    malus: -5   // sempre negativo: arretra di 5
  },

  // Caselle PROVA
  prova: {
    bonusSuperata: 1,   // prova superata: avanza di 1
    malusFallita: 0     // prova fallita: resta fermo
  },

  // Regole generali del motore
  regole: {
    bonusAttivaCasella: false,   // un movimento-bonus (es. +3 Conoscenza) non fa scattare la casella su cui atterra
    saltoAttivaCasella: false,   // atterrare su SALTO ti sposta, ma non attiva subito la casella di arrivo
    arrivoLibero: true           // basta superare l'ultima casella per vincere, nessun rimbalzo indietro
  },

  // Numero giocatori ammessi
  giocatori: {
    minimo: 1,
    massimo: 12
  },

  // Salmo 133:1 — "COLLABORIAMO!", la prova a due. Scatta (senza dado, con
  // regole precise) quando chi sta per giocare e' molto indietro rispetto al
  // primo: il primo ha visto un mosaico e lo descrive a voce, l'ultimo lo
  // rimette in ordine. Se riesce l'ultimo avanza, se fallisce arretra il primo.
  // Tutta la logica sta in js/salmo/. Nel gioco vero questa sezione resta
  // spenta (attivo: false); nella beta e' accesa.
  salmo: {
    attivo: true,
    giocatoriMinimi: 3,           // con 2 giocatori non scatta mai
    distacchi: {                  // distacco minimo primo-ultimo, in caselle, per numero di giocatori
      finoA4: 20,
      finoA6: 22,
      finoA8: 24,
      finoA10: 26,
      finoA12: 28
    },
    primoMassimo: 50,             // se il primo e' dalla casella 51 in poi, niente Salmo
    giriDiPausa: 2,               // giri completi del tavolo tra un Salmo e il successivo
    maxPerPartita: 2,             // al massimo due volte in una partita
    bonusUltimo: 10,              // prova riuscita: l'ultimo avanza di tanto
    malusPrimo: -10,              // prova fallita: il primo arretra di tanto (sempre negativo)
    ultimoSaltaSeFallisce: true,  // prova fallita: l'ultimo resta fermo e non tira il dado
    ultimoTiraDopoSuccesso: false, // prova riuscita: la prova sostituisce il turno, l'ultimo non tira
    tentativi: 2,                 // quante volte l'ultimo puo' premere "Ho finito"
    prontoMs: 60000,              // tempo per premere "Sono pronto"
    sbirciataMs: 10000,           // la sbirciata del primo (una sola volta)
    esitoMs: 8000,                // quanto restano sullo schermo esito e soluzione
    livelli: {
      bambini: { riquadri: 4, provaMs: 75000, anteprimaMs: 10000 },
      normale: { riquadri: 16, provaMs: 90000, anteprimaMs: 15000 }
    }
  },

  // Quanto aspettare prima di procedere da soli, se un giocatore non
  // risponde (disconnesso, distratto, telefono in stand-by...)
  timeout: {
    dadoMs: 60000,       // un minuto per tirare il dado
    rispostaMs: 60000    // un minuto per rispondere a Conoscenza
  }

};


// Unisce le personalizzazioni salvate su Firebase sopra ai valori di base
// qui sopra — se una sezione non è stata toccata, resta quella di sempre.
export function unisciConfig(base, override) {
  return {
    dado: { ...base.dado, ...(override.dado || {}) },
    conoscenza: { ...base.conoscenza, ...(override.conoscenza || {}) },
    imprevisto: { ...base.imprevisto, ...(override.imprevisto || {}) },
    prova: { ...base.prova, ...(override.prova || {}) },
    regole: { ...base.regole, ...(override.regole || {}) },
    giocatori: { ...base.giocatori, ...(override.giocatori || {}) },
    timeout: { ...base.timeout, ...(override.timeout || {}) },
    salmo: unisciSalmo(base.salmo, override.salmo)
  };
}

// La sezione "salmo" ha due sottosezioni (distacchi, livelli): vanno unite
// anche loro, altrimenti salvarne una sola dall'Admin cancellerebbe le altre.
function unisciSalmo(base, override) {
  if (!base) return undefined;
  const o = override || {};
  const oLivelli = o.livelli || {};
  return {
    ...base,
    ...o,
    distacchi: { ...base.distacchi, ...(o.distacchi || {}) },
    livelli: {
      bambini: { ...base.livelli.bambini, ...(oLivelli.bambini || {}) },
      normale: { ...base.livelli.normale, ...(oLivelli.normale || {}) }
    }
  };
}