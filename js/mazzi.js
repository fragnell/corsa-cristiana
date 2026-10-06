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


// --- Pescata "a rotazione", pensata per Conoscenza ---
// A differenza di mescola/creaMazzo/pesca (che restano invariate per
// Imprevisto e Prova), qui non si mescola e basta: ogni domanda ricorda
// in quale partita e' uscita l'ultima volta (numero progressivo, salvato
// nel browser del tabellone: vedi rotazione-domande.js) e
// si pesca sempre quella che manca da piu' tempo. E' una vera rotazione:
// una domanda non torna finche' non sono uscite tutte le altre, e vale
// sia dentro la stessa partita sia tra una partita e la successiva, con
// lo stesso identico meccanismo.
//
// Prima si contava quante volte era uscita ciascuna ("meno usata per
// prima"), ma quel numero misura l'equita' totale, non la freschezza: con
// un mazzo sbilanciato (domande appena aggiunte, statistiche azzerate,
// domande cambiate con "Cambia domanda" che non venivano contate) le
// domande appena uscite restavano le meno usate, e la partita dopo
// ricominciava proprio da quelle.

// Due segnali, in quest'ordine: "l'ho gia' vista in QUESTA partita?"
// vince sempre (mai una ripetizione dentro la stessa partita); poi, tra
// le non ancora viste, si prende quella la cui ultima partita e' piu'
// vecchia (0 = mai uscita, quindi le domande nuove escono per prime).
// A parita' decide l'ordine del mescolamento, cioe' il caso.
//
// ultimaPartitaPerChiave: { chiaveDomanda: numeroDellaUltimaPartita }
export function creaMazzoARotazione(carte, ultimaPartitaPerChiave) {
  const ultimaPartita = {};
  carte.forEach(c => {
    ultimaPartita[c._chiave] = ultimaPartitaPerChiave[c._chiave] || 0;
  });
  return { carte: mescola(carte), ultimaPartita, visteInQuestaPartita: new Set() };
}

export function peschaARotazione(mazzo) {
  let nonAncoraViste = mazzo.carte.filter(c => !mazzo.visteInQuestaPartita.has(c._chiave));
  let baseViste = mazzo.visteInQuestaPartita;

  if (nonAncoraViste.length === 0) {
    // Tutto il mazzo è già uscito in questa partita: si ricomincia un
    // giro pulito, come rimescolare un mazzo fisico quando finisce.
    baseViste = new Set();
    nonAncoraViste = mazzo.carte;
  }

  let migliore = nonAncoraViste[0];
  let ultimaMigliore = mazzo.ultimaPartita[migliore._chiave] || 0;
  for (const carta of nonAncoraViste) {
    const ultima = mazzo.ultimaPartita[carta._chiave] || 0;
    if (ultima < ultimaMigliore) {
      migliore = carta;
      ultimaMigliore = ultima;
    }
  }

  const nuoveViste = new Set(baseViste);
  nuoveViste.add(migliore._chiave);

  return {
    mazzo: { carte: mazzo.carte, ultimaPartita: mazzo.ultimaPartita, visteInQuestaPartita: nuoveViste },
    carta: migliore
  };
}
