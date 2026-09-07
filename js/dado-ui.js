// dado-ui.js
// L'animazione del dado che rotola sul tabellone prima di mostrare il
// numero. Il pannello "tocca a te" ora vive sul telefono del giocatore
// (giocatore-ui.js) — qui resta solo l'animazione visiva.

const FACCE_DADO = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

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
        }, 900);
      }
    }, 180);
  });
}