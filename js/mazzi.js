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
    const ultimaScartata = scarti[scarti.length - 1];
    pescabili = mescola(scarti);
    // Evita che il nuovo giro riproponga subito, come prima carta,
    // quella appena uscita: se càpita per caso, la scambiamo con
    // un'altra posizione pescata a caso nel mazzo.
    if (pescabili.length > 1 && pescabili[0] === ultimaScartata) {
      const scambio = 1 + Math.floor(Math.random() * (pescabili.length - 1));
      [pescabili[0], pescabili[scambio]] = [pescabili[scambio], pescabili[0]];
    }
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

// Due segnali separati, non uno solo — è quello che serviva per essere
// certi al 100% di non ripetere mai dentro la stessa partita: "l'ho già
// vista in QUESTA partita?" vince sempre; solo tra le carte non ancora
// viste in questa partita si guarda quale ha meno utilizzo storico
// (quello salvato su Firebase, che è così che il non-ripetersi vale
// anche da una partita alla successiva).
export function creaMazzoPerUsoMinimo(carte, statistiche) {
  const usiStorici = {};
  carte.forEach(c => {
    usiStorici[c._chiave] = (statistiche[c._chiave] && statistiche[c._chiave].proposte) || 0;
  });
  return { carte: mescola(carte), usiStorici, visteInQuestaPartita: new Set() };
}

export function peschaPerUsoMinimo(mazzo) {
  let nonAncoraViste = mazzo.carte.filter(c => !mazzo.visteInQuestaPartita.has(c._chiave));
  let baseViste = mazzo.visteInQuestaPartita;

  if (nonAncoraViste.length === 0) {
    // Tutto il mazzo è già uscito in questa partita: si ricomincia un
    // giro pulito, come rimescolare un mazzo fisico quando finisce.
    baseViste = new Set();
    nonAncoraViste = mazzo.carte;
  }

  let migliore = nonAncoraViste[0];
  let usiMigliore = mazzo.usiStorici[migliore._chiave] || 0;
  for (const carta of nonAncoraViste) {
    const usi = mazzo.usiStorici[carta._chiave] || 0;
    if (usi < usiMigliore) {
      migliore = carta;
      usiMigliore = usi;
    }
  }

  const nuoveViste = new Set(baseViste);
  nuoveViste.add(migliore._chiave);

  return {
    mazzo: { carte: mazzo.carte, usiStorici: mazzo.usiStorici, visteInQuestaPartita: nuoveViste },
    carta: migliore
  };
}