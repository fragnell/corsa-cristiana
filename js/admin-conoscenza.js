// admin-conoscenza.js
// Sezione Conoscenza del pannello impostazioni: elenco, aggiunta,
// modifica, cancellazione. La più complessa delle tre perché una domanda
// può essere "diretta" (una risposta sola), "elenco" (più risposte
// possibili, con un minimo richiesto) o "scelta" (si sceglie tra alcune
// opzioni proposte, una delle quali è quella giusta).

import { ascoltaMazzo, salvaCarta, eliminaCarta, nuovaChiaveMazzo } from './sincronizzazione.js';

const NOME_MAZZO = 'conoscenza';
let listaRispostePossibili = []; // usata solo mentre il form "elenco" è aperto
let listaOpzioni = [];           // usata solo mentre il form "scelta" è aperto
let opzioneCorrettaIndice = null;

export function avviaSezioneConoscenza() {
  ascoltaMazzo(NOME_MAZZO, disegnaLista);

  document.getElementById('conoscenza-btn-nuova').addEventListener('click', () => mostraForm(null));
  document.getElementById('conoscenza-btn-annulla').addEventListener('click', nascondiForm);
  document.getElementById('conoscenza-tipo').addEventListener('change', aggiornaCampiVisibili);

  document.getElementById('conoscenza-btn-aggiungi-risposta').addEventListener('click', aggiungiRispostaPossibile);
  document.getElementById('conoscenza-input-nuova-risposta').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); aggiungiRispostaPossibile(); }
  });

  document.getElementById('conoscenza-btn-aggiungi-opzione').addEventListener('click', aggiungiOpzione);
  document.getElementById('conoscenza-input-nuova-opzione').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); aggiungiOpzione(); }
  });
}

function disegnaLista(carte) {
  const contenitore = document.getElementById('conoscenza-lista');
  contenitore.innerHTML = '';

  carte.forEach(carta => {
    const riga = document.createElement('div');
    riga.className = 'admin-riga-carta';
    const etichetteTipo = { elenco: '📋', scelta: '🔘', diretta: '💬' };
    const etichettaTipo = etichetteTipo[carta.tipo] || '💬';
    riga.innerHTML = `
      <span class="admin-riga-testo">${etichettaTipo} ${carta.domanda}</span>
      <button type="button" class="admin-btn-modifica">✏️</button>
      <button type="button" class="admin-btn-elimina">🗑️</button>
    `;
    riga.querySelector('.admin-btn-modifica').addEventListener('click', () => mostraForm(carta));
    riga.querySelector('.admin-btn-elimina').addEventListener('click', () => confermaEdElimina(carta));
    contenitore.appendChild(riga);
  });

  document.getElementById('conoscenza-conteggio').textContent = carte.length;
}

function mostraForm(carta) {
  document.getElementById('conoscenza-form').classList.remove('nascosta');
  document.getElementById('conoscenza-form-titolo').textContent = carta ? 'Modifica domanda' : 'Nuova domanda';

  document.getElementById('conoscenza-input-domanda').value = carta ? carta.domanda : '';
  document.getElementById('conoscenza-tipo').value = carta ? carta.tipo : 'diretta';
  document.getElementById('conoscenza-input-risposta').value = (carta && carta.tipo === 'diretta') ? carta.risposta : '';
  document.getElementById('conoscenza-input-minimo').value = (carta && carta.tipo === 'elenco') ? carta.minimoRichiesto : 3;

  listaRispostePossibili = (carta && carta.tipo === 'elenco') ? [...carta.rispostePossibili] : [];
  disegnaListaRispostePossibili();

  listaOpzioni = (carta && carta.tipo === 'scelta') ? [...carta.opzioni] : [];
  opzioneCorrettaIndice = (carta && carta.tipo === 'scelta') ? carta.opzioni.indexOf(carta.rispostaCorretta) : null;
  disegnaListaOpzioni();

  aggiornaCampiVisibili();

  document.getElementById('conoscenza-btn-salva').onclick = async () => {
    const domanda = document.getElementById('conoscenza-input-domanda').value.trim();
    const tipo = document.getElementById('conoscenza-tipo').value;
    if (!domanda) { alert('Scrivi la domanda.'); return; }

    let nuovaCarta;
    if (tipo === 'diretta') {
      const risposta = document.getElementById('conoscenza-input-risposta').value.trim();
      if (!risposta) { alert('Scrivi la risposta.'); return; }
      nuovaCarta = { domanda, tipo: 'diretta', risposta };

    } else if (tipo === 'elenco') {
      const minimoRichiesto = parseInt(document.getElementById('conoscenza-input-minimo').value, 10) || 1;
      if (listaRispostePossibili.length === 0) { alert('Aggiungi almeno una risposta possibile.'); return; }
      nuovaCarta = { domanda, tipo: 'elenco', minimoRichiesto, rispostePossibili: [...listaRispostePossibili] };

    } else { // scelta
      if (listaOpzioni.length < 2) { alert('Aggiungi almeno due opzioni.'); return; }
      if (opzioneCorrettaIndice === null) { alert('Seleziona quale opzione è quella corretta.'); return; }
      nuovaCarta = { domanda, tipo: 'scelta', opzioni: [...listaOpzioni], rispostaCorretta: listaOpzioni[opzioneCorrettaIndice] };
    }

    const chiave = carta ? carta._chiave : nuovaChiaveMazzo(NOME_MAZZO);
    await salvaCarta(NOME_MAZZO, chiave, nuovaCarta);
    nascondiForm();
  };
}

function aggiornaCampiVisibili() {
  const tipo = document.getElementById('conoscenza-tipo').value;
  document.getElementById('conoscenza-campi-diretta').classList.toggle('nascosta', tipo !== 'diretta');
  document.getElementById('conoscenza-campi-elenco').classList.toggle('nascosta', tipo !== 'elenco');
  document.getElementById('conoscenza-campi-scelta').classList.toggle('nascosta', tipo !== 'scelta');
}

// --- risposte possibili (tipo "elenco") ---

function aggiungiRispostaPossibile() {
  const input = document.getElementById('conoscenza-input-nuova-risposta');
  const valore = input.value.trim();
  if (!valore) return;
  listaRispostePossibili.push(valore);
  input.value = '';
  disegnaListaRispostePossibili();
  input.focus();
}

function disegnaListaRispostePossibili() {
  const contenitore = document.getElementById('conoscenza-lista-risposte');
  contenitore.innerHTML = listaRispostePossibili.map((r, indice) =>
    `<div>${r} <button type="button" data-indice="${indice}" class="admin-btn-rimuovi-risposta">✕</button></div>`
  ).join('');

  contenitore.querySelectorAll('.admin-btn-rimuovi-risposta').forEach(bottone => {
    bottone.addEventListener('click', () => {
      const indice = parseInt(bottone.dataset.indice, 10);
      listaRispostePossibili.splice(indice, 1);
      disegnaListaRispostePossibili();
    });
  });
}

// --- opzioni (tipo "scelta") ---

function aggiungiOpzione() {
  const input = document.getElementById('conoscenza-input-nuova-opzione');
  const valore = input.value.trim();
  if (!valore) return;
  listaOpzioni.push(valore);
  input.value = '';
  disegnaListaOpzioni();
  input.focus();
}

function disegnaListaOpzioni() {
  const contenitore = document.getElementById('conoscenza-lista-opzioni');
  contenitore.innerHTML = listaOpzioni.map((opzione, indice) => `
    <div class="admin-riga-opzione">
      <input type="radio" name="conoscenza-opzione-corretta" ${indice === opzioneCorrettaIndice ? 'checked' : ''} data-indice="${indice}">
      <span>${opzione}</span>
      <button type="button" data-indice="${indice}" class="admin-btn-rimuovi-opzione">✕</button>
    </div>
  `).join('');

  contenitore.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      opzioneCorrettaIndice = parseInt(radio.dataset.indice, 10);
    });
  });

  contenitore.querySelectorAll('.admin-btn-rimuovi-opzione').forEach(bottone => {
    bottone.addEventListener('click', () => {
      const indice = parseInt(bottone.dataset.indice, 10);
      listaOpzioni.splice(indice, 1);
      if (opzioneCorrettaIndice === indice) opzioneCorrettaIndice = null;
      else if (opzioneCorrettaIndice !== null && opzioneCorrettaIndice > indice) opzioneCorrettaIndice--;
      disegnaListaOpzioni();
    });
  });
}

function nascondiForm() {
  document.getElementById('conoscenza-form').classList.add('nascosta');
}

async function confermaEdElimina(carta) {
  if (confirm(`Eliminare questa domanda?\n\n"${carta.domanda}"`)) {
    await eliminaCarta(NOME_MAZZO, carta._chiave);
  }
}