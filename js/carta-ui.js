// carta-ui.js
// Mostra la carta pescata (Conoscenza, Imprevisto, Prova) con l'animazione
// di rotazione.
//
// Due modi d'uso:
// - mostraCartaEAspettaScelta: per Imprevisto e Prova, ha dei bottoni e si
//   chiude da sola quando se ne preme uno.
// - mostraCarta + nascondiCarta: per la Conoscenza, resta visibile finché
//   non viene nascosta esplicitamente da chi la usa — così tutti possono
//   continuare a leggere la domanda mentre il giocatore scrive la risposta.

function popolaContenuto(tipoCarta, carta) {
  const elTipo = document.getElementById('carta-tipo');
  const elTesto = document.getElementById('carta-testo');
  const elRiferimento = document.getElementById('carta-riferimento');

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
}

export function mostraCarta(tipoCarta, carta) {
  return new Promise(risolvi => {
    const overlay = document.getElementById('carta-overlay');
    const elCarta = document.getElementById('carta');
    document.getElementById('carta-bottoni').innerHTML = '';

    popolaContenuto(tipoCarta, carta);

    elCarta.classList.remove('girata');
    overlay.classList.remove('nascosta');
    setTimeout(() => {
      elCarta.classList.add('girata');
      setTimeout(risolvi, 600);
    }, 400);
  });
}

export function nascondiCarta() {
  document.getElementById('carta-overlay').classList.add('nascosta');
}

export function mostraCartaEAspettaScelta(tipoCarta, carta, opzioni) {
  return new Promise(risolvi => {
    const overlay = document.getElementById('carta-overlay');
    const elCarta = document.getElementById('carta');
    const elBottoni = document.getElementById('carta-bottoni');

    popolaContenuto(tipoCarta, carta);

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
    setTimeout(() => elCarta.classList.add('girata'), 400);
  });
}