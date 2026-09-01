// carta-ui.js
// Mostra la carta pescata (Conoscenza, Imprevisto, Prova) con l'animazione
// di rotazione, e aspetta che il giudice prema un bottone per continuare.
// Non sa nulla del tabellone: riceve una carta e degli "opzioni" di risposta,
// restituisce quale opzione è stata scelta.

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

    // Conoscenza mostra solo la domanda: la risposta resta privata, la vedrà
    // il giudice sul proprio telefono quando costruiremo quella parte.
    if (tipoCarta === 'CONOSCENZA') {
      elTesto.textContent = carta.domanda;
      if (carta.tipo === 'elenco') {
        elRiferimento.textContent = `(cita almeno ${carta.minimoRichiesto})`;
      }
    } else {
      // Imprevisto e Prova sono pubbliche per intero: niente da nascondere.
      elTesto.textContent = carta.testo;
      if (tipoCarta === 'IMPREVISTO') {
        elRiferimento.textContent = carta.riferimento || '';
      }
    }

    elBottoni.innerHTML = '';
    opzioni.forEach(opz => {
      const bottone = document.createElement('button');
      bottone.textContent = opz.etichetta;
      bottone.addEventListener('click', () => {
        overlay.classList.add('nascosta');
        risolvi(opz.valore);
      });
      elBottoni.appendChild(bottone);
    });

    elCarta.classList.remove('girata');
    overlay.classList.remove('nascosta');

    // piccola pausa a carta coperta, prima di girarla
    setTimeout(() => elCarta.classList.add('girata'), 400);
  });
}