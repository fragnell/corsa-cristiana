// tabellone-ui.js
// Disegna il tabellone a spirale e manda avanti la partita in un ciclo
// continuo. Il dado non parte più da un pulsante su questa pagina: il
// tabellone aspetta che arrivi l'intenzione "tira il dado" da Firebase,
// mandata dal telefono del giocatore di turno. Dopo ogni turno, lo stato
// aggiornato viene pubblicato, così i telefoni lo vedono.

import { creaStatoIniziale, giocatoreDiTurno, partitaFinita } from './stato.js';
import { tiraDado, muoviGiocatore, applicaRispostaConoscenza, applicaEsitoProva, passaTurno } from './regole.js';
import { creaMazzo, pesca } from './mazzi.js';
import { mostraCarta, nascondiCarta, mostraCartaEAspettaScelta } from './carta-ui.js';
import { raccogliRisposta, valutaRisposta, mostraVerdetto } from './risposta-ui.js';
import { animaDado } from './dado-ui.js';
import { generaCodicePartita, pubblicaStato, aspettaIntenzioneDado } from './sincronizzazione.js';

const PALETTE = {
  rosso: '#e74c3c',
  blu: '#3498db',
  verde: '#2ecc71',
  giallo: '#f1c40f',
  viola: '#9b59b6',
  arancione: '#e67e22'
};

const DURATA_SALTO_MS = 300;

let percorso = [];
let stato = null;
let mazzoConoscenza, mazzoImprevisto, mazzoProva;
let codicePartita = '';
const pedineDom = new Map();

function pausa(ms) {
  return new Promise(risolvi => setTimeout(risolvi, ms));
}

function generaSpirale(n) {
  const coordinate = [];
  const strati = Math.ceil(n / 2);
  for (let strato = 0; strato < strati; strato++) {
    const min = strato;
    const max = n - 1 - strato;
    if (min > max) break;
    if (min === max) { coordinate.push({ riga: min, colonna: min }); continue; }
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

function disegnaTabellone(coordinate) {
  const contenitore = document.getElementById('tabellone');
  contenitore.innerHTML = '';
  percorso.forEach((cella, indice) => {
    const { riga, colonna } = coordinate[indice];
    const el = document.createElement('div');
    el.className = `casella casella-${cella.tipo}`;
    el.dataset.numero = cella.numero;
    el.style.gridRow = riga + 1;
    el.style.gridColumn = colonna + 1;
    el.innerHTML = `<span class="numero">${cella.numero}</span><div class="pedine" id="pedine-${cella.numero}"></div>`;
    contenitore.appendChild(el);
  });
}

function creaPedine() {
  stato.giocatori.forEach(g => {
    const pedina = document.createElement('div');
    pedina.className = 'pedina';
    pedina.style.backgroundColor = PALETTE[g.colore] || g.colore;
    pedina.title = g.nome;
    pedina.textContent = g.nome[0];
    pedineDom.set(g.id, pedina);
    spostaPedinaSuCasella(g.id, g.posizione);
  });
}

function spostaPedinaSuCasella(giocatoreId, numeroCasella) {
  const pedina = pedineDom.get(giocatoreId);
  const contenitore = document.getElementById(`pedine-${numeroCasella}`);
  if (pedina && contenitore) contenitore.appendChild(pedina);
}

function facciaBalzare(giocatoreId) {
  const pedina = pedineDom.get(giocatoreId);
  if (!pedina) return;
  pedina.classList.remove('salta');
  void pedina.offsetWidth;
  pedina.classList.add('salta');
}

function evidenziaCasella(numeroCasella) {
  const cella = document.querySelector(`.casella[data-numero="${numeroCasella}"]`);
  if (!cella) return;
  cella.classList.remove('evidenziata');
  void cella.offsetWidth;
  cella.classList.add('evidenziata');
}

async function animaSpostamento(giocatoreId, posizioneIniziale, posizioneFinale) {
  const passo = posizioneFinale > posizioneIniziale ? 1 : -1;
  let pos = posizioneIniziale;
  while (pos !== posizioneFinale) {
    pos += passo;
    spostaPedinaSuCasella(giocatoreId, pos);
    facciaBalzare(giocatoreId);
    await pausa(DURATA_SALTO_MS);
  }
  evidenziaCasella(posizioneFinale);
}

async function giocaTurno() {
  const infoTurno = document.getElementById('turno-info');
  const giocatore = giocatoreDiTurno(stato);

  infoTurno.textContent = `In attesa che ${giocatore.nome} tiri il dado dal telefono...`;
  await aspettaIntenzioneDado(codicePartita, giocatore.id);

  const posizionePrima = giocatore.posizione;
  const dado = tiraDado();
  await animaDado(dado);

  const posizioneAtterrata = Math.min(posizionePrima + dado, percorso.length);
  await animaSpostamento(giocatore.id, posizionePrima, posizioneAtterrata);

  let r = muoviGiocatore(stato, percorso, dado);
  stato = r.stato;

  const posizioneDopoEffetto = stato.giocatori[giocatore.id].posizione;
  if (posizioneDopoEffetto !== posizioneAtterrata && r.evento.tipo !== 'IN_ATTESA') {
    await pausa(200);
    await animaSpostamento(giocatore.id, posizioneAtterrata, posizioneDopoEffetto);
  }

  if (r.evento.tipo === 'IMPREVISTO') {
    const pescata = pesca(mazzoImprevisto);
    mazzoImprevisto = pescata.mazzo;
    await mostraCartaEAspettaScelta('IMPREVISTO', pescata.carta, [{ etichetta: 'Continua', valore: null }]);

    stato.ultimoEvento = { tipo: 'IMPREVISTO', giocatoreId: giocatore.id, id: Date.now() };
  }

  if (r.evento.tipo === 'IN_ATTESA') {
    const posizionePrimaEsito = stato.giocatori[giocatore.id].posizione;

    if (r.evento.casella === 'CONOSCENZA') {
      const pescata = pesca(mazzoConoscenza);
      mazzoConoscenza = pescata.mazzo;
      const carta = pescata.carta;

      let corretta;
      while (true) {
        await mostraCarta('CONOSCENZA', carta);
        const risposteDate = await raccogliRisposta(carta);
        nascondiCarta();

        corretta = valutaRisposta(carta, risposteDate);
        const accettata = await mostraVerdetto(carta, corretta, risposteDate);
        if (accettata) break;
      }
      r = applicaRispostaConoscenza(stato, percorso, corretta);
    } else {
      const pescata = pesca(mazzoProva);
      mazzoProva = pescata.mazzo;
      const superata = await mostraCartaEAspettaScelta('PROVA', pescata.carta, [
        { etichetta: '✅ Prova superata', valore: true },
        { etichetta: '❌ Prova fallita', valore: false }
      ]);
      r = applicaEsitoProva(stato, percorso, superata);
    }
    stato = r.stato;

    const posizioneDopoEsito = stato.giocatori[giocatore.id].posizione;
    if (posizioneDopoEsito !== posizionePrimaEsito) {
      await pausa(200);
      await animaSpostamento(giocatore.id, posizionePrimaEsito, posizioneDopoEsito);
    }
  }

  if (!partitaFinita(stato)) {
    stato = passaTurno(stato);
  }

  await pubblicaStato(codicePartita, stato);
}

async function cicloDiGioco() {
  while (!partitaFinita(stato)) {
    await giocaTurno();
  }
  const vincitore = stato.giocatori[stato.vincitore];
  document.getElementById('turno-info').textContent = `🏆 Ha vinto ${vincitore.nome}!`;
}

async function avvia() {
  percorso = (await caricaJSON('dati/percorso.json')).celle;
  const carteConoscenza = (await caricaJSON('dati/carte-conoscenza.json')).carte;
  const carteImprevisto = (await caricaJSON('dati/carte-imprevisto.json')).carte;
  const carteProva = (await caricaJSON('dati/carte-prova.json')).carte;

  mazzoConoscenza = creaMazzo(carteConoscenza);
  mazzoImprevisto = creaMazzo(carteImprevisto);
  mazzoProva = creaMazzo(carteProva);

  const coordinate = generaSpirale(8);
  disegnaTabellone(coordinate);

  stato = creaStatoIniziale([
    { nome: 'Marco', colore: 'rosso' },
    { nome: 'Giulia', colore: 'blu' },
    { nome: 'Luca', colore: 'verde' },
    { nome: 'Sara', colore: 'giallo' }
  ]);

  creaPedine();

  codicePartita = generaCodicePartita();
  document.getElementById('codice-partita').textContent = codicePartita;
  await pubblicaStato(codicePartita, stato);

  cicloDiGioco();
}

avvia();