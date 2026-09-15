// mazzi.js
// Mescola, pesca, scarta e rimescola un mazzo di carte.
// Funziona per qualunque mazzo (Conoscenza, Imprevisto, Prova):
// basta dargli l'elenco di carte giusto.

// Mescola un array senza modificare l'originale (algoritmo di Fisher-Yates:
// scorre l'array dalla fine e scambia ogni carta con una scelta a caso
// tra quelle non ancora sistemate).
export function mescola(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Crea un mazzo pronto all'uso, già mescolato.
export function creaMazzo(carte) {
  if (!carte || carte.length === 0) {
    throw new Error('Non si può creare un mazzo vuoto.');
  }
  return {
    pescabili: mescola(carte),
    scarti: []
  };
}

// Pesca la prima carta disponibile. Se il mazzo è finito, rimescola gli
// scarti e riparte da lì — così una carta non si ripete mai finché non
// sono uscite tutte le altre.
export function pesca(mazzo) {
  let pescabili = mazzo.pescabili;
  let scarti = mazzo.scarti;

  if (pescabili.length === 0) {
    if (scarti.length === 0) {
      throw new Error('Il mazzo è completamente vuoto: nessuna carta da pescare.');
    }
    pescabili = mescola(scarti);
    scarti = [];
  }

  const [carta, ...restanti] = pescabili;

  const nuovoMazzo = {
    pescabili: restanti,
    scarti: [...scarti, carta]
  };

  return { mazzo: nuovoMazzo, carta };
}


// --- Pescata "a uso minimo", pensata per Conoscenza ---
// A differenza di mescola/creaMazzo/pesca (che restano invariate per
// Imprevisto e Prova), qui non si mescola e basta: si pesca sempre la
// carta usata meno finora. L'utilizzo di partenza arriva dalle
// statistiche vere salvate su Firebase — così vale sia dentro la stessa
// partita sia tra una partita e la successiva, con lo stesso identico
// meccanismo, senza bisogno di trattarle come due casi diversi.

export function creaMazzoPerUsoMinimo(carte, statistiche) {
  const usiIniziali = {};
  carte.forEach(c => {
    usiIniziali[c._chiave] = (statistiche[c._chiave] && statistiche[c._chiave].proposte) || 0;
  });
  // mescolato una volta in partenza: a parità di utilizzo, chi viene
  // prima nell'array (randomizzato) vince — è così che le parità
  // restano casuali, senza dover rimescolare a ogni pescata.
  return { carte: mescola(carte), usi: usiIniziali };
}

export function peschaPerUsoMinimo(mazzo) {
  let migliore = mazzo.carte[0];
  let usiMigliore = mazzo.usi[migliore._chiave] || 0;

  for (const carta of mazzo.carte) {
    const usi = mazzo.usi[carta._chiave] || 0;
    if (usi < usiMigliore) {
      migliore = carta;
      usiMigliore = usi;
    }
  }

  const nuoviUsi = { ...mazzo.usi, [migliore._chiave]: usiMigliore + 1 };
  return { mazzo: { carte: mazzo.carte, usi: nuoviUsi }, carta: migliore };
}