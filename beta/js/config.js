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
    malusRispostaErrata: 0      // risposta sbagliata: resta fermo
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

  // Regole generali del motore.
  // (Sono regole fisse e non si cambiano: un movimento-bonus non attiva mai la casella su cui
  // atterra, e superare l'ultima casella basta per vincere, senza rimbalzi indietro.)
  regole: {
    // Interruttore interno del motore: NON si cambia qui e non sta nell'Admin, lo imposta la modalita' della
    // partita (vedi configPerModalita). Partita NORMALE: sempre false, il SALTO ti sposta e basta, non scatta
    // la casella di arrivo. Partita VELOCE: vale la spunta "saltoAttivaCasella" della sezione "veloce".
    saltoAttivaCasella: false
  },

  // Partita veloce: si sceglie in lobby ("Normale" o "Veloce") e accorcia la partita di circa un terzo.
  // Cambia solo questi quattro valori rispetto alla partita normale; tutto il resto resta uguale.
  veloce: {
    bonusConoscenza: 8,          // risposta giusta: avanza di 8 (nella partita normale: 3)
    bonusProva: 3,               // prova superata: avanza di 3 (nella partita normale: 1)
    malusImprevisto: -1,         // imprevisto: arretra di 1 (nella partita normale: 5); sempre negativo
    saltoAttivaCasella: true     // true: dopo un salto scatta anche la casella su cui arrivi (per esempio una
                                 // domanda Conoscenza); false: il salto sposta e basta, come nella partita normale.
                                 // Solo la partita veloce lo usa: nella normale il salto non attiva mai la casella.
  },

  // Recensioni di fine partita: ai giocatori "alle prime partite" il telefono propone di lasciare
  // delle stelline e un commento. Si accendono e si spengono dall'Admin (scheda Regole).
  recensioni: {
    attiva: true,                // false: nessuno vede mai la richiesta di recensione
    soloNuovi: true,             // true: solo chi ha giocato poche partite su questo telefono; false: sempre
    primePartite: 3              // quante sono "poche partite" (le prime 3 partite di quel telefono)
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
  // Tutta la logica sta in js/salmo/. Si accende e si spegne dall'Admin
  // (casella "COLLABORIAMO! attivo"), senza toccare il codice.
  salmo: {
    attivo: true,
    giocatoriMinimi: 3,           // con 2 giocatori non scatta mai
    distacchi: {                  // distacco minimo primo-ultimo, in caselle, per numero di giocatori
      finoA4: 16,                 //   3 o 4 giocatori
      finoA6: 18,                 //   5 o 6 giocatori
      finoA8: 20,                 //   7 o 8 giocatori
      finoA10: 20,                //   9 o 10 giocatori
      finoA12: 20                 //   11 o 12 giocatori
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
    // "regole" salvata su Firebase non si legge piu': contiene solo vecchi valori (le due spunte tolte) e la
    // vecchia spunta del Salto, che ora vive solo nella sezione "veloce". Cosi' non puo' mai accendere il Salto
    // nella partita normale.
    regole: { ...base.regole },
    giocatori: { ...base.giocatori, ...(override.giocatori || {}) },
    timeout: { ...base.timeout, ...(override.timeout || {}) },
    veloce: { ...base.veloce, ...(override.veloce || {}) },
    recensioni: { ...base.recensioni, ...(override.recensioni || {}) },
    salmo: unisciSalmo(base.salmo, override.salmo)
  };
}

// La configurazione da usare in una partita, secondo la modalita':
//  - "veloce": al posto dei valori normali valgono i quattro della sezione "veloce" (bonus Conoscenza, bonus Prova,
//    malus Imprevisto e se il Salto attiva la casella di arrivo);
//  - qualunque altra modalita' (o nessuna, come nelle partite iniziate prima della partita veloce): i valori
//    normali, e il Salto sposta e basta: la casella di arrivo NON scatta mai nella partita normale.
// Non modifica mai l'originale.
export function configPerModalita(config, modalita) {
  if (modalita !== 'veloce' || !config.veloce) {
    return { ...config, regole: { ...config.regole, saltoAttivaCasella: false } };
  }
  const v = config.veloce;
  return {
    ...config,
    conoscenza: { ...config.conoscenza, bonusRispostaCorretta: v.bonusConoscenza },
    prova: { ...config.prova, bonusSuperata: v.bonusProva },
    imprevisto: { ...config.imprevisto, malus: v.malusImprevisto },
    regole: { ...config.regole, saltoAttivaCasella: !!v.saltoAttivaCasella }
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