// carta-ui.js
// Mostra la carta pescata (Conoscenza, Imprevisto, Prova) con l'animazione
// di rotazione. Se ci sono opzioni (bottoni), aspetta che se ne prema uno.
// Se non ce ne sono (caso della Conoscenza, dove ora risponde il giocatore),
// la mostra e basta, poi prosegue da sola dopo un attimo per leggerla.

export function mostraCartaEAspettaScelta(tipoCarta, carta, opzioni) {
  return new Promise(risolvi => {
    const overlay = document.getElementById('carta-overlay');
    const elCarta = document.getElementById('carta');
    const elTipo = document.getElementById('carta-tipo');
    const elTesto = document.getElementById('carta-testo');
    const elRiferimento = document.getElementById('carta-riferimento');
    const elBottoni = document.getElementById('carta-bottoni');

    elTipo.textContent = tipoCarta;
    elRiferimento.textContent = '';

    if (tipoCarta === 'CONOSCENZA') {
      elTesto.textContent = carta.domanda;
      if (carta.tipo === 'elenco') {
        elRiferimento.textContent = `(cita almeno ${carta.minimoRichiesto})`;
      }
    } else {
      elTesto.textContent = carta.testo;
      if (tipoCarta === 'IMPREVISTO') {
        elRiferimento.textContent = carta.riferimento || '';
      }
    }

    elBottoni.innerHTML = '';
    elCarta.classList.remove('girata');
    overlay.classList.remove('nascosta');

    if (opzioni.length === 0) {
      setTimeout(() => {
        elCarta.classList.add('girata');
        setTimeout(() => {
          overlay.classList.add('nascosta');
          risolvi(null);
        }, 1400);
      }, 400);
      return;
    }

    opzioni.forEach(opz => {
      const bottone = document.createElement('button');
      bottone.textContent = opz.etichetta;
      bottone.addEventListener('click', () => {
        overlay.classList.add('nascosta');
        risolvi(opz.valore);
      });
      elBottoni.appendChild(bottone);
    });

    setTimeout(() => elCarta.classList.add('girata'), 400);
  });
}