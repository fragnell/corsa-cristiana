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