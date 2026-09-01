// tabellone-ui.js
// Disegna il tabellone a spirale, mostra le pedine, gestisce il clic su
// "tira il dado". Interfaccia volutamente semplice: prima far funzionare
// tutto, poi arrivano le animazioni.

import { creaStatoIniziale, giocatoreDiTurno, partitaFinita } from './stato.js';
import { tiraDado, muoviGiocatore, applicaRispostaConoscenza, applicaEsitoProva, passaTurno } from './regole.js';

const PALETTE = {
  rosso: '#e74c3c',
  blu: '#3498db',
  verde: '#2ecc71',
  giallo: '#f1c40f',
  viola: '#9b59b6',
  arancione: '#e67e22'
};

// Genera le coordinate di una spirale quadrata n×n, partendo dall'angolo
// in basso a sinistra e girando in senso antiorario verso il centro —
// la stessa forma del tabellone fisico.
function generaSpirale(n) {
  const coordinate = [];
  const strati = Math.ceil(n / 2);

  for (let strato = 0; strato < strati; strato++) {
    const min = strato;
    const max = n - 1 - strato;
    if (min > max) break;

    if (min === max) {
      coordinate.push({ riga: min, colonna: min });
      continue;
    }
    for (let c = min; c <= max; c++) coordinate.push({ riga: max, colonna: c });
    for (let r = max - 1; r >= min; r--) coordinate.push({ riga: r, colonna: max });
    for (let c = max - 1; c >= min; c--) coordinate.push({ riga: min, colonna: c });
    for (let r = min + 1; r <= max - 1; r++) coordinate.push({ riga: r, colonna: min });
  }
  return coordinate;
}

async function caricaJSON(url) {
  const risposta = await fetch(url);
  if (!risposta.ok) throw new Error(`Impossibile caricare ${url} (${risposta.status})`);
  return risposta.json();
}

function disegnaTabellone(percorso, coordinate) {
  const contenitore = document.getElementById('tabellone');
  contenitore.innerHTML = '';

  percorso.forEach((cella, indice) => {
    const { riga, colonna } = coordinate[indice];
    const el = document.createElement('div');
    el.className = `casella casella-${cella.tipo}`;
    el.style.gridRow = riga + 1;
    el.style.gridColumn = colonna + 1;
    el.innerHTML = `<span class="numero">${cella.numero}</span><div class="pedine" id="pedine-${cella.numero}"></div>`;
    contenitore.appendChild(el);
  });
}

function disegnaPedine(stato) {
  document.querySelectorAll('.pedine').forEach(el => (el.innerHTML = ''));
  stato.giocatori.forEach(g => {
    const posto = document.getElementById(`pedine-${g.posizione}`);
    if (!posto) return;
    const pedina = document.createElement('div');
    pedina.className = 'pedina';
    pedina.style.backgroundColor = PALETTE[g.colore] || g.colore;
    pedina.title = g.nome;
    pedina.textContent = g.nome[0];
    posto.appendChild(pedina);
  });
}

async function avvia() {
  const infoTurno = document.getElementById('turno-info');
  const bottone = document.getElementById('btn-tira');

  const percorso = (await caricaJSON('dati/percorso.json')).celle;
  const coordinate = generaSpirale(8);

  disegnaTabellone(percorso, coordinate);

  let stato = creaStatoIniziale([
    { nome: 'Marco', colore: 'rosso' },
    { nome: 'Giulia', colore: 'blu' },
    { nome: 'Luca', colore: 'verde' },
    { nome: 'Sara', colore: 'giallo' }
  ]);

  disegnaPedine(stato);
  infoTurno.textContent = `Tocca a ${giocatoreDiTurno(stato).nome}`;

  bottone.addEventListener('click', () => {
    const dado = tiraDado();
    let r = muoviGiocatore(stato, percorso, dado);
    stato = r.stato;

    // Placeholder: finché non abbiamo l'interfaccia vera del giudice,
    // chiediamo l'esito con una finestra di conferma del browser.
    if (r.evento.tipo === 'IN_ATTESA' && r.evento.casella === 'CONOSCENZA') {
      const corretta = confirm('Casella CONOSCENZA — la risposta era corretta?');
      r = applicaRispostaConoscenza(stato, percorso, corretta);
      stato = r.stato;
    } else if (r.evento.tipo === 'IN_ATTESA' && r.evento.casella === 'PROVA') {
      const superata = confirm('Casella PROVA — è stata superata?');
      r = applicaEsitoProva(stato, percorso, superata);
      stato = r.stato;
    }

    disegnaPedine(stato);

    if (partitaFinita(stato)) {
      const vincitore = stato.giocatori[stato.vincitore];
      infoTurno.textContent = `🏆 Ha vinto ${vincitore.nome}!`;
      bottone.disabled = true;
    } else {
      stato = passaTurno(stato);
      infoTurno.textContent = `Ultimo tiro: ${dado} — tocca a ${giocatoreDiTurno(stato).nome}`;
    }
  });
}

avvia();