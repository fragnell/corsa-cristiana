// regolamento-ui.js
// Passa tra le tre viste della pagina: il menu iniziale, il regolamento
// vero e proprio, e il segnaposto del video tutorial.

function mostra(idVista) {
  ['vista-menu', 'vista-regolamento', 'vista-video'].forEach(id => {
    document.getElementById(id).classList.toggle('nascosta', id !== idVista);
  });
  window.scrollTo(0, 0);
}

document.getElementById('btn-regolamento').addEventListener('click', () => mostra('vista-regolamento'));
document.getElementById('btn-video').addEventListener('click', () => mostra('vista-video'));

document.getElementById('btn-indietro-regolamento').addEventListener('click', (e) => {
  e.preventDefault();
  mostra('vista-menu');
});
document.getElementById('btn-indietro-regolamento-fondo').addEventListener('click', (e) => {
  e.preventDefault();
  mostra('vista-menu');
});
document.getElementById('btn-indietro-video').addEventListener('click', (e) => {
  e.preventDefault();
  mostra('vista-menu');
});