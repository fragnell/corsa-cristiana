// regolamento-ui.js
// Passa tra le tre viste della pagina: il menu iniziale, il regolamento
// vero e proprio, e il segnaposto del video tutorial. Aprire il
// regolamento scorre fino a farlo vedere subito, così è chiaro che è
// successo qualcosa — un salto istantaneo in cima alla pagina non è
// sempre abbastanza evidente perché ci si accorga del cambiamento.

function mostra(idVista) {
  ['vista-menu', 'vista-regolamento', 'vista-video'].forEach(id => {
    document.getElementById(id).classList.toggle('nascosta', id !== idVista);
  });
}

document.getElementById('btn-regolamento').addEventListener('click', () => {
  mostra('vista-regolamento');
  document.getElementById('vista-regolamento').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('btn-video').addEventListener('click', () => {
  mostra('vista-video');
  window.scrollTo(0, 0);
});

document.getElementById('btn-indietro-regolamento').addEventListener('click', (e) => {
  e.preventDefault();
  mostra('vista-menu');
  window.scrollTo(0, 0);
});
document.getElementById('btn-indietro-regolamento-fondo').addEventListener('click', (e) => {
  e.preventDefault();
  mostra('vista-menu');
  window.scrollTo(0, 0);
});
document.getElementById('btn-indietro-video').addEventListener('click', (e) => {
  e.preventDefault();
  mostra('vista-menu');
  window.scrollTo(0, 0);
});