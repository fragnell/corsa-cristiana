// dado-ui.js
// Il pannello "tocca a te" (simula il telefono del giocatore di turno) e
// l'animazione del dado che rotola sul tabellone prima di mostrare il numero.

const FACCE_DADO = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']; // indice 0 = faccia "1"

export function aspettaTurnoGiocatore(nomeGiocatore) {
  return new Promise(risolvi => {
    const area = document.getElementById('turno-giocatore-area');
    area.classList.remove('nascosta');
    area.innerHTML = `
      <p class="turno-giocatore-nome">🎲 ${nomeGiocatore}, tocca a te!</p>
      <button id="btn-tira-dado">Tira il dado</button>
    `;
    document.getElementById('btn-tira-dado').addEventListener('click', () => {
      area.classList.add('nascosta');
      risolvi();
    });
  });
}

export function animaDado(valoreFinale) {
  return new Promise(risolvi => {
    const overlay = document.getElementById('dado-overlay');
    const faccia = document.getElementById('dado-faccia');
    overlay.classList.remove('nascosta');

    let tiri = 0;
    const TIRI_TOTALI = 10;

    const scatta = () => {
      faccia.classList.remove('dado-scatto');
      void faccia.offsetWidth;
      faccia.classList.add('dado-scatto');
    };

    const intervallo = setInterval(() => {
      const casuale = 1 + Math.floor(Math.random() * 6);
      faccia.textContent = FACCE_DADO[casuale - 1];
      scatta();
      tiri++;

      if (tiri >= TIRI_TOTALI) {
        clearInterval(intervallo);
        faccia.textContent = FACCE_DADO[valoreFinale - 1];
        scatta();
        setTimeout(() => {
          overlay.classList.add('nascosta');
          risolvi();
        }, 700);
      }
    }, 90);
  });
}