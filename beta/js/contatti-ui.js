// contatti-ui.js
// La pagina dei contatti: due bottoni aprono direttamente la posta
// (contatta, segnala un problema), il terzo mostra il testo su come
// sostenere lo sviluppo.

document.getElementById('btn-supporta').addEventListener('click', () => {
  document.getElementById('vista-menu').classList.add('nascosta');
  document.getElementById('vista-supporto').classList.remove('nascosta');
});

document.getElementById('btn-indietro-supporto').addEventListener('click', () => {
  document.getElementById('vista-supporto').classList.add('nascosta');
  document.getElementById('vista-menu').classList.remove('nascosta');
});