// index-ui.js
// La porta d'ingresso del sito: un pulsante "Gioca" che porta alla scelta
// tra tabellone e giocatore.

document.getElementById('btn-gioca').addEventListener('click', () => {
  document.getElementById('vista-iniziale').classList.add('nascosta');
  document.getElementById('vista-scelta').classList.remove('nascosta');
});

document.getElementById('btn-indietro').addEventListener('click', () => {
  document.getElementById('vista-scelta').classList.add('nascosta');
  document.getElementById('vista-iniziale').classList.remove('nascosta');
});