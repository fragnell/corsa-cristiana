// mosaico-ui.js
// Salmo 133:1 — disegna un mosaico (la griglia di riquadri) dentro un
// contenitore. Serve ai telefoni (il primo lo guarda, l'ultimo lo sistema) e,
// con i riquadri "da indovinare" tutti uguali, al tabellone.
//
// Il tabellone NON usa mai disegnaMosaico con i riquadri veri: usa soltanto
// disegnaSegnaposto, che non contiene nessuna informazione sulla soluzione.

import { crea, svuota } from './dom.js';
import { svgDisegno, nomeDisegno } from './disegni.js';

function preparaGriglia(contenitore, righe, colonne) {
  svuota(contenitore);
  contenitore.classList.add('salmo-mosaico');
  contenitore.style.setProperty('--salmo-colonne', String(colonne));
  contenitore.style.setProperty('--salmo-righe', String(righe));
}

// ordine   elenco di identificativi di disegni, da sinistra a destra e dall'alto in basso
// opzioni  { selezionata: indice|-1, alTocco(i): se manca il mosaico e' solo da guardare,
//            evidenzia: [i, j] riquadri appena scambiati, bloccato: true = non si tocca }
export function disegnaMosaico(contenitore, ordine, righe, colonne, opzioni = {}) {
  preparaGriglia(contenitore, righe, colonne);
  const toccabile = typeof opzioni.alTocco === 'function' && !opzioni.bloccato;

  ordine.forEach((id, i) => {
    const tessera = crea(toccabile ? 'button' : 'div', 'salmo-tessera');
    if (toccabile) {
      tessera.type = 'button';
      tessera.setAttribute('aria-label', `Riquadro ${i + 1}: ${nomeDisegno(id)}`);
      tessera.addEventListener('click', () => opzioni.alTocco(i));
    }
    if (i === opzioni.selezionata) tessera.classList.add('salmo-tessera-scelta');
    if (Array.isArray(opzioni.evidenzia) && opzioni.evidenzia.includes(i)) tessera.classList.add('salmo-tessera-scambiata');
    // L'SVG e' scritto da noi (disegni.js): non contiene mai testo dei giocatori.
    tessera.innerHTML = svgDisegno(id);
    contenitore.appendChild(tessera);
  });
}

// Una griglia "da indovinare": tessere tutte uguali con un punto interrogativo.
// Non dipende da nessun dato della prova, tranne il numero di righe e colonne.
const COLORI_SEGNAPOSTO = ['#f6d98b', '#bfe0c8', '#f2b8b0', '#b9d3ee', '#e3c9ee', '#f7c9a0'];

// "numero" e' quante tessere disegnare: di solito riempiono la griglia, ma con numeri
// "strani" l'ultima riga puo' restare incompleta.
export function disegnaSegnaposto(contenitore, righe, colonne, numero = righe * colonne) {
  preparaGriglia(contenitore, righe, colonne);
  for (let i = 0; i < numero; i++) {
    const tessera = crea('div', 'salmo-tessera salmo-tessera-segnaposto', '?');
    tessera.style.background = COLORI_SEGNAPOSTO[i % COLORI_SEGNAPOSTO.length];
    contenitore.appendChild(tessera);
  }
}
