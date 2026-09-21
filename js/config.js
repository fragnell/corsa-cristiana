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
    timeout: { ...base.timeout, ...(override.timeout || {}) }
  };
}