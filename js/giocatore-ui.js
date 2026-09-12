// giocatore-ui.js
// La pagina del telefono: entra in una partita con un codice. Se la
// partita non è ancora iniziata, scrivi il tuo nome, scegli un colore ed
// eventualmente la modalità junior. Se invece è già in corso (per
// esempio dopo un refresh accidentale della pagina), ti viene chiesto
// semplicemente chi sei tra i giocatori già dentro — nessuna nuova
// registrazione, rientri direttamente dove eri rimasto.

import { raccogliRisposta } from './risposta-ui.js';
import { PALETTE, NOMI_COLORI } from './colori.js';

import {
  verificaPartitaEsiste,
  leggiLobbyUnaVolta,
  leggiStatoUnaVolta,
  ascoltaLobby,
  unisciti,
  ascoltaStato,
  inviaIntenzioneDado,
  inviaIntenzioneRisposta,
  impostaPresenza,
  richiediAbbandono
} from './sincronizzazione.js';

let codicePartita = null;
let mioNome = null;
let mioId = null;
let ultimoEventoVisto = null;
let ultimoVerdettoVisto = null;
let richiestaIdGestita = null;
let richiestaIdCorrente = null;
let annullaRispostaCorrente = null;

document.getElementById('btn-cerca').addEventListener('click', cercaPartita);

async function cercaPartita() {
  const codice = document.getElementById('input-codice').value.trim().toUpperCase();
  const messaggio = document.getElementById('messaggio-ingresso');

  if (!codice) {
    messaggio.textContent = 'Scrivi prima il codice.';
    return;
  }

  messaggio.textContent = 'Cerco la partita...';
  const esiste = await verificaPartitaEsiste(codice);

  if (!esiste) {
    messaggio.textContent = '❌ Nessuna partita trovata con questo codice.';
    return;
  }

  const statoAttuale = await leggiStatoUnaVolta(codice);
  messaggio.textContent = '';
  codicePartita = codice;

  if (statoAttuale) {
    mostraSchermataRientro(statoAttuale);
  } else {
    const lobby = await leggiLobbyUnaVolta(codice);
    mostraModuloRegistrazione(lobby);
  }
}

function mostraSchermataRientro(statoAttuale) {
  document.getElementById('passo-codice').classList.add('nascosta');
  document.getElementById('passo-rientro').classList.remove('nascosta');

  const contenitore = document.getElementById('lista-rientro');
  contenitore.innerHTML = '';

  statoAttuale.giocatori.forEach(g => {
    const bottone = document.createElement('button');
    bottone.type = 'button';
    bottone.className = 'bottone-rientro';
    bottone.innerHTML = `<span class="pallino-lista" style="background:${PALETTE[g.colore] || g.colore}"></span>${g.nome}`;
    bottone.addEventListener('click', () => rientraComeGiocatore(g));
    contenitore.appendChild(bottone);
  });
}

function rientraComeGiocatore(giocatore) {
  mioNome = giocatore.nome;
  mioId = giocatore.id;

  document.getElementById('passo-rientro').classList.add('nascosta');
  document.getElementById('gioco').classList.remove('nascosta');
  document.getElementById('mio-nome').textContent = mioNome;
  impostaPresenza(codicePartita, mioId);

  ascoltaStato(codicePartita, aggiornaSchermo);
}

function mostraModuloRegistrazione(lobby) {
  document.getElementById('passo-codice').classList.add('nascosta');
  document.getElementById('passo-registrazione').classList.remove('nascosta');

  const coloriPresi = new Set(lobby.map(g => g.colore));
  const contenitore = document.getElementById('scelta-colore');
  contenitore.innerHTML = '';
  let coloreScelto = null;

  NOMI_COLORI.forEach(colore => {
    const bottone = document.createElement('button');
    bottone.type = 'button';
    bottone.className = 'pallino-colore';
    bottone.style.backgroundColor = PALETTE[colore];
    bottone.title = colore;
    if (coloriPresi.has(colore)) {
      bottone.disabled = true;
      bottone.classList.add('colore-preso');
    } else {
      bottone.addEventListener('click', () => {
        document.querySelectorAll('.pallino-colore').forEach(b => b.classList.remove('selezionato'));
        bottone.classList.add('selezionato');
        coloreScelto = colore;
      });
    }
    contenitore.appendChild(bottone);
  });

  document.getElementById('btn-conferma-registrazione').onclick = async () => {
    const nome = document.getElementById('input-nome').value.trim();
    const junior = document.getElementById('input-junior').checked;
    const messaggioReg = document.getElementById('messaggio-registrazione');

    if (!nome) { messaggioReg.textContent = 'Scrivi il tuo nome.'; return; }
    if (!coloreScelto) { messaggioReg.textContent = 'Scegli un colore.'; return; }

    messaggioReg.textContent = '';
    const risultato = await unisciti(codicePartita, nome, coloreScelto, junior);

    if (!risultato.ok) {
      if (risultato.motivo === 'nome-preso') {
        messaggioReg.textContent = '❌ Questo nome è già stato scelto da qualcun altro. Provane un altro.';
      } else if (risultato.motivo === 'colore-preso') {
        messaggioReg.textContent = '❌ Qualcuno ha scelto questo colore un attimo prima di te. Scegline un altro.';
        const lobbyAggiornata = await leggiLobbyUnaVolta(codicePartita);
        mostraModuloRegistrazione(lobbyAggiornata);
      } else {
        messaggioReg.textContent = '❌ Qualcosa è andato storto, riprova.';
      }
      return;
    }

    mioNome = nome;
    entraInAttesa();
  };
}

function entraInAttesa() {
  document.getElementById('passo-registrazione').classList.add('nascosta');
  document.getElementById('vista-attesa').classList.remove('nascosta');
  document.getElementById('nome-in-attesa').textContent = mioNome;

  ascoltaLobby(codicePartita, (lobby) => {
    document.getElementById('lista-attesa').innerHTML = lobby.map(g => `<li>${g.nome}</li>`).join('');
  });

  ascoltaStato(codicePartita, (stato) => {
    if (!stato) return;

    if (mioId === null) {
      const io = stato.giocatori.find(g => g.nome === mioNome);
      if (!io) return;
      mioId = io.id;
      document.getElementById('vista-attesa').classList.add('nascosta');
      document.getElementById('gioco').classList.remove('nascosta');
      document.getElementById('mio-nome').textContent = mioNome;
      impostaPresenza(codicePartita, mioId);
    }

    aggiornaSchermo(stato);
  });
}

function aggiornaSchermo(stato) {
  const bottoneDado = document.getElementById('btn-tira-dado');
  const statoTurno = document.getElementById('stato-turno');
  const notifica = document.getElementById('notifica-evento');
  const giocatoreDiTurno = stato.giocatori[stato.turnoDi];

  document.getElementById('mia-posizione').textContent = `Sei sulla casella ${stato.giocatori[mioId].posizione}`;

  const elProvaSospesa = document.getElementById('mia-prova-sospesa');
  const mioProvaSospesa = stato.giocatori[mioId].provaInSospeso;
  if (mioProvaSospesa) {
    elProvaSospesa.textContent = `⏳ Prova in corso: ${mioProvaSospesa.testo}`;
    elProvaSospesa.classList.remove('nascosta');
  } else {
    elProvaSospesa.classList.add('nascosta');
  }

  if (stato.vincitore != null) {
    const vincitore = stato.giocatori[stato.vincitore];
    statoTurno.textContent = `🏆 Ha vinto ${vincitore.nome}!`;
    bottoneDado.classList.add('nascosta');
    return;
  }

  const richiesta = stato.richiestaConoscenza;
  const staRispondendoIo = richiesta && richiesta.giocatoreId === mioId;

  if (richiestaIdCorrente !== null && (!richiesta || richiesta.id !== richiestaIdCorrente) && annullaRispostaCorrente) {
    annullaRispostaCorrente();
  }

  if (staRispondendoIo) {
    bottoneDado.classList.add('nascosta');
    statoTurno.textContent = '';
    gestisciRichiestaConoscenza(richiesta);
  } else if (stato.turnoDi === mioId && stato.giocatori[mioId].provaInSospeso) {
    statoTurno.textContent = '⏳ Hai una prova in sospeso — aspetta che venga risolta sul tabellone...';
    bottoneDado.classList.add('nascosta');
  } else if (stato.turnoDi === mioId && stato.turnoInCorso) {
    statoTurno.textContent = '';
    bottoneDado.classList.add('nascosta');
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

  const verdetto = stato.ultimoVerdetto;
  if (verdetto && verdetto.giocatoreId === mioId && verdetto.id !== ultimoVerdettoVisto) {
    ultimoVerdettoVisto = verdetto.id;
    mostraVerdettoOverlay(verdetto.corretta);
  }
}

function mostraVerdettoOverlay(corretta) {
  const overlay = document.getElementById('verdetto-overlay');
  const testo = document.getElementById('verdetto-overlay-testo');
  const conto = document.getElementById('verdetto-overlay-countdown');
  const bottoneOk = document.getElementById('verdetto-overlay-ok');

  testo.textContent = corretta ? '✅ Risposta corretta!' : '❌ Risposta errata';
  testo.style.color = corretta ? '#2e7d32' : '#c62828';

  let secondiRimasti = 10;
  conto.textContent = `Si chiude tra ${secondiRimasti}s`;

  let chiuso = false;
  const timer = setInterval(() => {
    secondiRimasti--;
    conto.textContent = `Si chiude tra ${secondiRimasti}s`;
    if (secondiRimasti <= 0) chiudi();
  }, 1000);

  function chiudi() {
    if (chiuso) return;
    chiuso = true;
    clearInterval(timer);
    overlay.classList.add('nascosta');
    bottoneOk.onclick = null;
  }

  bottoneOk.onclick = chiudi;
  overlay.classList.remove('nascosta');
}

function gestisciRichiestaConoscenza(richiesta) {
  if (richiesta.id === richiestaIdGestita) return;
  richiestaIdGestita = richiesta.id;
  rispondiAConoscenza(richiesta);
}

async function rispondiAConoscenza(richiesta) {
  richiestaIdCorrente = richiesta.id;

  document.getElementById('domanda-conoscenza').textContent = richiesta.domanda;
  document.getElementById('area-domanda-conoscenza').classList.remove('nascosta');

  const elConto = document.getElementById('conoscenza-countdown');
  let timerConto = null;

  if (richiesta.scadenza) {
    const aggiornaConto = () => {
      const restanti = Math.max(0, Math.round((richiesta.scadenza - Date.now()) / 1000));
      elConto.textContent = `⏱️ ${restanti}s per rispondere`;
      elConto.classList.toggle('conoscenza-countdown-urgente', restanti <= 15);
    };
    aggiornaConto();
    timerConto = setInterval(aggiornaConto, 1000);
  }

  const cartaFinta = { tipo: richiesta.tipo, minimoRichiesto: richiesta.minimoRichiesto, opzioni: richiesta.opzioni };

  const rispostaUtente = raccogliRisposta(cartaFinta);
  const scaduta = new Promise(risolvi => {
    annullaRispostaCorrente = () => risolvi('__SCADUTA__');
  });

  const risultato = await Promise.race([rispostaUtente, scaduta]);

  if (timerConto) clearInterval(timerConto);
  document.getElementById('area-domanda-conoscenza').classList.add('nascosta');
  document.getElementById('risposta-area').classList.add('nascosta');
  annullaRispostaCorrente = null;
  richiestaIdCorrente = null;

  if (risultato === '__SCADUTA__') {
    return;
  }

  document.getElementById('stato-turno').textContent = 'Risposta inviata! In attesa del tabellone...';
  inviaIntenzioneRisposta(codicePartita, mioId, risultato);
}

document.getElementById('btn-tira-dado').addEventListener('click', () => {
  document.getElementById('btn-tira-dado').classList.add('nascosta');
  document.getElementById('stato-turno').textContent = 'Tirato! In attesa del tabellone...';
  inviaIntenzioneDado(codicePartita, mioId);
});


document.getElementById('btn-abbandona').addEventListener('click', async () => {
  const conferma = confirm('Sei sicuro di voler abbandonare la partita? Non potrai più giocare in questa partita.');
  if (!conferma) return;

  await richiediAbbandono(codicePartita, mioId);

  document.getElementById('gioco').classList.add('nascosta');
  document.getElementById('messaggio-abbandonato').classList.remove('nascosta');
});