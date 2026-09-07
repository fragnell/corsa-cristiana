// giocatore-ui.js
// La pagina del telefono: entra in una partita con un codice, scegli chi
// sei, e da lì vedi solo quello che ti serve — se tocca a te tirare il
// dado, un avviso se ti è appena capitato un Imprevisto, e la domanda di
// Conoscenza quando tocca a te rispondere.

import { raccogliRisposta } from './risposta-ui.js';
import {
  leggiStatoUnaVolta,
  ascoltaStato,
  inviaIntenzioneDado,
  inviaIntenzioneRisposta
} from './sincronizzazione.js';

let codicePartita = null;
let mioId = null;
let ultimoEventoVisto = null;
let richiestaIdGestita = null;

document.getElementById('btn-cerca').addEventListener('click', cercaPartita);

async function cercaPartita() {
  const codice = document.getElementById('input-codice').value.trim().toUpperCase();
  const messaggio = document.getElementById('messaggio-ingresso');

  if (!codice) {
    messaggio.textContent = 'Scrivi prima il codice.';
    return;
  }

  messaggio.textContent = 'Cerco la partita...';
  const stato = await leggiStatoUnaVolta(codice);

  if (!stato) {
    messaggio.textContent = '❌ Nessuna partita trovata con questo codice.';
    return;
  }

  messaggio.textContent = '';
  codicePartita = codice;
  mostraSceltaGiocatore(stato);
}

function mostraSceltaGiocatore(stato) {
  document.getElementById('passo-codice').classList.add('nascosta');
  document.getElementById('passo-scelta').classList.remove('nascosta');

  const contenitore = document.getElementById('scelta-giocatore');
  contenitore.innerHTML = '';
  stato.giocatori.forEach(g => {
    const bottone = document.createElement('button');
    bottone.textContent = g.nome;
    bottone.addEventListener('click', () => entraComeGiocatore(g.id, g.nome));
    contenitore.appendChild(bottone);
  });
}

function entraComeGiocatore(id, nome) {
  mioId = id;
  document.getElementById('ingresso').classList.add('nascosta');
  document.getElementById('gioco').classList.remove('nascosta');
  document.getElementById('mio-nome').textContent = nome;

  ascoltaStato(codicePartita, aggiornaSchermo);
}

function aggiornaSchermo(stato) {
  if (!stato) return;

  const bottoneDado = document.getElementById('btn-tira-dado');
  const statoTurno = document.getElementById('stato-turno');
  const notifica = document.getElementById('notifica-evento');
  const giocatoreDiTurno = stato.giocatori[stato.turnoDi];

  if (stato.vincitore != null) {
    const vincitore = stato.giocatori[stato.vincitore];
    statoTurno.textContent = `🏆 Ha vinto ${vincitore.nome}!`;
    bottoneDado.classList.add('nascosta');
    return;
  }

  const richiesta = stato.richiestaConoscenza;
  const staRispondendoIo = richiesta && richiesta.giocatoreId === mioId;

  if (staRispondendoIo) {
    bottoneDado.classList.add('nascosta');
    statoTurno.textContent = '';
    gestisciRichiestaConoscenza(richiesta);
  } else if (stato.turnoDi === mioId) {
    statoTurno.textContent = '🎲 Tocca a te!';
    bottoneDado.classList.remove('nascosta');
  } else {
    statoTurno.textContent = `In attesa di ${giocatoreDiTurno.nome}...`;
    bottoneDado.classList.add('nascosta');
  }

  const evento = stato.ultimoEvento;
  if (evento && evento.giocatoreId === mioId && evento.id !== ultimoEventoVisto) {
    ultimoEventoVisto = evento.id;
    if (evento.tipo === 'IMPREVISTO') {
      notifica.textContent = '⚡ Hai pescato un Imprevisto!';
      setTimeout(() => { notifica.textContent = ''; }, 4000);
    }
  }
}

function gestisciRichiestaConoscenza(richiesta) {
  if (richiesta.id === richiestaIdGestita) return;
  richiestaIdGestita = richiesta.id;
  rispondiAConoscenza(richiesta);
}

async function rispondiAConoscenza(richiesta) {
  document.getElementById('domanda-conoscenza').textContent = richiesta.domanda;
  document.getElementById('area-domanda-conoscenza').classList.remove('nascosta');

  const cartaFinta = { tipo: richiesta.tipo, minimoRichiesto: richiesta.minimoRichiesto };
  const risposteDate = await raccogliRisposta(cartaFinta);

  document.getElementById('area-domanda-conoscenza').classList.add('nascosta');
  document.getElementById('stato-turno').textContent = 'Risposta inviata! In attesa del tabellone...';

  inviaIntenzioneRisposta(codicePartita, mioId, risposteDate);
}

document.getElementById('btn-tira-dado').addEventListener('click', () => {
  document.getElementById('btn-tira-dado').classList.add('nascosta');
  document.getElementById('stato-turno').textContent = 'Tirato! In attesa del tabellone...';
  inviaIntenzioneDado(codicePartita, mioId);
});