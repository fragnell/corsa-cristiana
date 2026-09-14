// admin-imprevisto.js
// Sezione Imprevisto del pannello impostazioni: elenco, aggiunta,
// modifica, cancellazione. Come Prova ma con un campo in più, facoltativo,
// per il riferimento scritturale.

import { ascoltaMazzo, salvaCarta, eliminaCarta, nuovaChiaveMazzo } from './sincronizzazione.js';

const NOME_MAZZO = 'imprevisto';

export function avviaSezioneImprevisto() {
  ascoltaMazzo(NOME_MAZZO, disegnaLista);
  document.getElementById('imprevisto-btn-nuova').addEventListener('click', () => mostraForm(null));
  document.getElementById('imprevisto-btn-annulla').addEventListener('click', nascondiForm);
}

function disegnaLista(carte) {
  const contenitore = document.getElementById('imprevisto-lista');
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

  document.getElementById('imprevisto-conteggio').textContent = carte.length;
}

function mostraForm(carta) {
  document.getElementById('imprevisto-form').classList.remove('nascosta');
  document.getElementById('imprevisto-form-titolo').textContent = carta ? 'Modifica imprevisto' : 'Nuovo imprevisto';
  document.getElementById('imprevisto-input-testo').value = carta ? carta.testo : '';
  document.getElementById('imprevisto-input-riferimento').value = (carta && carta.riferimento) ? carta.riferimento : '';

  document.getElementById('imprevisto-btn-salva').onclick = async () => {
    const testo = document.getElementById('imprevisto-input-testo').value.trim();
    const riferimento = document.getElementById('imprevisto-input-riferimento').value.trim();
    if (!testo) { alert("Scrivi il testo dell'imprevisto."); return; }

    const nuovaCarta = { testo };
    if (riferimento) nuovaCarta.riferimento = riferimento;

    const chiave = carta ? carta._chiave : nuovaChiaveMazzo(NOME_MAZZO);
    await salvaCarta(NOME_MAZZO, chiave, nuovaCarta);
    nascondiForm();
  };
}

function nascondiForm() {
  document.getElementById('imprevisto-form').classList.add('nascosta');
}

async function confermaEdElimina(carta) {
  if (confirm(`Eliminare questo imprevisto?\n\n"${carta.testo}"`)) {
    await eliminaCarta(NOME_MAZZO, carta._chiave);
  }
}