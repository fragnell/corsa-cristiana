// admin-prova.js
// Sezione Prova del pannello impostazioni: elenco, aggiunta, modifica,
// cancellazione. È la più semplice delle tre: un solo campo di testo.

import { ascoltaMazzo, salvaCarta, eliminaCarta, nuovaChiaveMazzo } from './sincronizzazione.js';

const NOME_MAZZO = 'prova';

export function avviaSezioneProva() {
  ascoltaMazzo(NOME_MAZZO, disegnaLista);
  document.getElementById('prova-btn-nuova').addEventListener('click', () => mostraForm(null));
  document.getElementById('prova-btn-annulla').addEventListener('click', nascondiForm);
}

function disegnaLista(carte) {
  const contenitore = document.getElementById('prova-lista');
  contenitore.innerHTML = '';

  carte.forEach(carta => {
    const riga = document.createElement('div');
    riga.className = 'admin-riga-carta';
    riga.innerHTML = `
      <span class="admin-riga-testo">${carta.testo}</span>
      <button type="button" class="admin-btn-modifica">✏️</button>
      <button type="button" class="admin-btn-elimina">🗑️</button>
    `;
    riga.querySelector('.admin-btn-modifica').addEventListener('click', () => mostraForm(carta));
    riga.querySelector('.admin-btn-elimina').addEventListener('click', () => confermaEdElimina(carta));
    contenitore.appendChild(riga);
  });

  document.getElementById('prova-conteggio').textContent = carte.length;
}

function mostraForm(carta) {
  document.getElementById('prova-form').classList.remove('nascosta');
  document.getElementById('prova-form-titolo').textContent = carta ? 'Modifica prova' : 'Nuova prova';
  document.getElementById('prova-input-testo').value = carta ? carta.testo : '';

  document.getElementById('prova-btn-salva').onclick = async () => {
    const testo = document.getElementById('prova-input-testo').value.trim();
    if (!testo) { alert('Scrivi il testo della prova.'); return; }

    const chiave = carta ? carta._chiave : nuovaChiaveMazzo(NOME_MAZZO);
    await salvaCarta(NOME_MAZZO, chiave, { testo });
    nascondiForm();
  };
}

function nascondiForm() {
  document.getElementById('prova-form').classList.add('nascosta');
}

async function confermaEdElimina(carta) {
  if (confirm(`Eliminare questa prova?\n\n"${carta.testo}"`)) {
    await eliminaCarta(NOME_MAZZO, carta._chiave);
  }
}