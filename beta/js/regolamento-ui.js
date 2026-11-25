// regolamento-ui.js
// Passa tra le tre viste della pagina: il menu iniziale, il regolamento
// vero e proprio, e il video tutorial (la presentazione animata di js/introduzione.js). Aprire il
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
  document.getElementById('vista-video').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
// La presentazione animata (la stessa del tabellone a inizio partita), con le regole di base.
const bottonePresentazione = document.getElementById('btn-avvia-presentazione');
if (bottonePresentazione) {
  bottonePresentazione.addEventListener('click', async () => {
    bottonePresentazione.disabled = true;
    try {
      const [{ mostraIntroduzione }, { CONFIG }] = await Promise.all([import('./introduzione.js'), import('./config.js')]);
      await mostraIntroduzione({ config: CONFIG, conDomanda: false, etichettaSalta: 'Chiudi ✕' });
    } catch (errore) {
      console.warn('Presentazione non disponibile', errore);
      alert('Non riesco ad aprire la presentazione in questo momento. Riprova tra poco.');
    }
    bottonePresentazione.disabled = false;
  });
}
