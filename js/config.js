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
    malus: -2   // sempre negativo: arretra di 2
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
  }

};