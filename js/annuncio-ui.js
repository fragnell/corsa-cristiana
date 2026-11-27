// annuncio-ui.js
// Una scritta grande al centro del tabellone, per pochi secondi: "Anna avanza di 3 caselle",
// "Bruno torna indietro di 3 caselle", "Anna resta sulla casella 12"... Cosi' chi guarda la TV da
// lontano capisce subito cosa e' successo, senza dover seguire la pedina casella per casella.
// Non blocca niente e non si tocca: compare sopra il tabellone (sotto le carte) e sparisce da sola.

const DURATA_MS = 2600;

let corrente = null;

// verso: 'avanti' | 'indietro' | 'fermo' | 'info' (cambia solo il colore e l'icona).
// Restituisce una Promise che si risolve quando l'annuncio sparisce.
export function annuncia(testo, verso = 'info') {
  return new Promise(risolvi => {
    try {
      if (corrente) corrente.remove();
      const icone = { avanti: '⬆️', indietro: '🔙', fermo: '⏸️', info: 'ℹ️' };
      const scatola = document.createElement('div');
      scatola.className = `annuncio-grande annuncio-${verso}`;
      scatola.setAttribute('role', 'status');
      scatola.setAttribute('aria-live', 'polite');
      const icona = document.createElement('span');
      icona.className = 'annuncio-icona';
      icona.textContent = icone[verso] || icone.info;
      const scritta = document.createElement('span');
      scritta.textContent = testo;          // i nomi arrivano dai telefoni: solo testo, mai HTML
      scatola.append(icona, scritta);
      document.body.appendChild(scatola);
      corrente = scatola;
      setTimeout(() => {
        scatola.classList.add('annuncio-via');
        setTimeout(() => {
          scatola.remove();
          if (corrente === scatola) corrente = null;
          risolvi();
        }, 450);
      }, DURATA_MS);
    } catch (errore) {
      risolvi();   // un annuncio che non si vede non deve mai fermare il gioco
    }
  });
}
