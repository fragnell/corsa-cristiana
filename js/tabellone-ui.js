// tabellone-ui.js
// Disegna il tabellone a spirale e manda avanti la partita in un ciclo
// continuo. Prima però mostra una lobby: aspetta che i giocatori si
// colleghino dai loro telefoni, e parte solo quando l'organizzatore
// preme "Inizia partita". Le prove "vincolo" restano in sospeso finché
// non torna il turno di chi le ha pescate.

import { CONFIG } from './config.js';
import { creaStatoIniziale, giocatoreDiTurno, partitaFinita } from './stato.js';
import { tiraDado, muoviGiocatore, applicaRispostaConoscenza, applicaEsitoProva, impostaProvaInSospeso, risolviProvaInSospeso, passaTurno } from './regole.js';
import { creaMazzo, pesca } from './mazzi.js';
import { mostraCarta, nascondiCarta, mostraCartaEAspettaScelta, chiediEsitoProvaVincolo } from './carta-ui.js';
import { valutaRisposta, mostraVerdetto } from './risposta-ui.js';
import { animaDado } from './dado-ui.js';
import { PALETTE } from './colori.js';
import {
  generaCodicePartita,
  iniziaLobby,
  ascoltaLobby,
  leggiLobbyUnaVolta,
  pubblicaStato,
  aspettaIntenzioneDado,
  aspettaIntenzioneRisposta,
  leggiMazzoDaFirebase,
  aggiungiRispostaACarta
} from './sincronizzazione.js';

const DURATA_SALTO_MS = 300;

const TIPI_LEGENDA = [
  { tipo: 'CONOSCENZA', etichetta: 'Conoscenza' },
  { tipo: 'IMPREVISTO', etichetta: 'Imprevisto' },
  { tipo: 'SALTO', etichetta: 'Salto' },
  { tipo: 'FERMO', etichetta: 'Fermo' },
  { tipo: 'PROVA', etichetta: 'Prova' }
];

function disegnaLegenda() {
  const contenitore = document.getElementById('legenda-lista');
  contenitore.innerHTML = TIPI_LEGENDA.map(t =>
    `<div class="legenda-riga"><span class="legenda-pallino casella-${t.tipo}"></span>${t.etichetta}</div>`
  ).join('');
}

let percorso = [];
let stato = null;
let mazzoConoscenza, mazzoImprevisto, mazzoProva;
let codicePartita = '';
const pedineDom = new Map();

function pausa(ms) {
  return new Promise(risolvi => setTimeout(risolvi, ms));
}

// Genera le coordinate di una spirale rettangolare (righe x colonne),
// partendo dal basso a sinistra e girando in senso antiorario verso
// l'interno — stessa direzione della vecchia spirale quadrata. Applicata
// a una griglia quadrata (righe === colonne) produce esattamente lo
// stesso percorso di quella originale: è una generalizzazione, non un
// algoritmo diverso.
function generaSpirale(righe, colonne) {
  const coordinate = [];
  let rigaMin = 0, rigaMax = righe - 1;
  let colMin = 0, colMax = colonne - 1;

  while (rigaMin <= rigaMax && colMin <= colMax) {
    for (let c = colMin; c <= colMax; c++) coordinate.push({ riga: rigaMax, colonna: c });
    for (let r = rigaMax - 1; r >= rigaMin; r--) coordinate.push({ riga: r, colonna: colMax });
    if (rigaMin < rigaMax) {
      for (let c = colMax - 1; c >= colMin; c--) coordinate.push({ riga: rigaMin, colonna: c });
    }
    if (colMin < colMax) {
      for (let r = rigaMin + 1; r <= rigaMax - 1; r++) coordinate.push({ riga: r, colonna: colMin });
    }
    rigaMin++; rigaMax--; colMin++; colMax--;
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

function aggiornaProveInSospeso() {
  const contenitore = document.getElementById('prove-in-sospeso');
  const inAttesa = stato.giocatori.filter(g => g.provaInSospeso);

  if (inAttesa.length === 0) {
    contenitore.innerHTML = '';
    return;
  }

    contenitore.innerHTML = inAttesa.map(g =>
    `<div class="prova-sospesa-riga">${g.nome}</div>`
  ).join('');
}

// Quando torna il turno di chi aveva una prova vincolo in sospeso, la
// risolve PRIMA di lasciarlo tirare il dado per il proprio turno vero.
async function risolviProvaVincoloDiTurno(giocatore) {
  const provaInSospeso = stato.giocatori[giocatore.id].provaInSospeso;
  const posizionePrima = stato.giocatori[giocatore.id].posizione;

  const superata = await chiediEsitoProvaVincolo(giocatore.nome, provaInSospeso);

  stato = risolviProvaInSospeso(stato, giocatore.id);
  const r = applicaEsitoProva(stato, percorso, superata);
  stato = r.stato;
  aggiornaProveInSospeso();

  const posizioneDopo = stato.giocatori[giocatore.id].posizione;
  if (posizioneDopo !== posizionePrima) {
    await pausa(200);
    await animaSpostamento(giocatore.id, posizionePrima, posizioneDopo);
  }

  await pubblicaStato(codicePartita, stato);
}

async function giocaTurno() {
  let giocatore = giocatoreDiTurno(stato);

  if (stato.giocatori[giocatore.id].provaInSospeso) {
    await risolviProvaVincoloDiTurno(giocatore);
    if (partitaFinita(stato)) return; // il +1 potrebbe aver fatto vincere proprio ora
    giocatore = giocatoreDiTurno(stato); // stesso giocatore, ma la posizione è cambiata
  }

  const infoTurno = document.getElementById('turno-info');

  infoTurno.textContent = `In attesa che ${giocatore.nome} tiri il dado dal telefono...`;
  await aspettaIntenzioneDado(codicePartita, giocatore.id);
  stato.turnoInCorso = true; // il dado di questo turno è già stato tirato: qualunque pubblicazione intermedia (Imprevisto, ecc.) non deve far ricomparire il pulsante sul telefono

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

    stato.ultimoEvento = { tipo: 'IMPREVISTO', giocatoreId: giocatore.id, id: Date.now() };
    await pubblicaStato(codicePartita, stato); // pubblica subito: il telefono deve saperlo mentre la carta è ancora sul tabellone, non dopo

    await mostraCartaEAspettaScelta('IMPREVISTO', pescata.carta, [{ etichetta: 'Continua', valore: null }]);
  }

  if (r.evento.tipo === 'FERMO') {
    const cartaFermo = { testo: `Ti sei scoraggiato! Fermo un turno.\n\n${r.evento.testo || ''}`, riferimento: r.evento.riferimento || '' };
    await mostraCartaEAspettaScelta('FERMO', cartaFermo, [{ etichetta: 'Continua', valore: null }]);
  }

  if (r.evento.tipo === 'SALTO') {
    const cartaSalto = { testo: `${r.evento.nomeEvento}! Una carica in più nella tua corsa cristiana: salti direttamente alla casella ${r.evento.destinazione}.` };
    await mostraCartaEAspettaScelta('SALTO', cartaSalto, [{ etichetta: 'Continua', valore: null }]);
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

        const richiesta = { id: Date.now(), giocatoreId: giocatore.id, domanda: carta.domanda, tipo: carta.tipo };
        if (carta.minimoRichiesto) richiesta.minimoRichiesto = carta.minimoRichiesto;
        if (carta.opzioni) richiesta.opzioni = carta.opzioni;
        stato.richiestaConoscenza = richiesta;
        await pubblicaStato(codicePartita, stato);

        const risposteDate = await aspettaIntenzioneRisposta(codicePartita, giocatore.id);

        stato.richiestaConoscenza = null;
        nascondiCarta();

        corretta = valutaRisposta(carta, risposteDate);

        stato.ultimoVerdetto = { giocatoreId: giocatore.id, corretta, id: Date.now() };
        await pubblicaStato(codicePartita, stato); // pubblica subito: il telefono deve saperlo nello stesso istante del tabellone

        const esito = await mostraVerdetto(carta, corretta, risposteDate);

        if (esito.nuovaRispostaDaAggiungere) {
          await aggiungiRispostaACarta(carta, esito.nuovaRispostaDaAggiungere);
        }
        corretta = esito.corretta;

        if (esito.accettata) break;
      }
      r = applicaRispostaConoscenza(stato, percorso, corretta);
    } else {
      const pescata = pesca(mazzoProva);
      mazzoProva = pescata.mazzo;
      const carta = pescata.carta;

      if (carta.vincolo) {
        // Vincolo: si mostra, ma non si giudica adesso — resta in sospeso
        // finché non torna il turno di chi l'ha pescata. Il turno di ORA
        // finisce qui, senza applicare nessun bonus.
        await mostraCartaEAspettaScelta('PROVA', carta, [{ etichetta: 'Continua', valore: null }]);
        stato = impostaProvaInSospeso(stato, giocatore.id, carta);
        aggiornaProveInSospeso();
        r = { stato, evento: { tipo: 'PROVA_VINCOLO' } };
      } else {
        const superata = await mostraCartaEAspettaScelta('PROVA', carta, [
          { etichetta: '✅ Prova superata', valore: true },
          { etichetta: '❌ Prova fallita', valore: false }
        ]);
        r = applicaEsitoProva(stato, percorso, superata);
      }
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
  stato.turnoInCorso = false; // si riparte da capo: il prossimo giocatore deve rivedere il pulsante del dado

  await pubblicaStato(codicePartita, stato);
}

async function cicloDiGioco() {
  while (!partitaFinita(stato)) {
    await giocaTurno();
  }
  const vincitore = stato.giocatori[stato.vincitore];
  document.getElementById('turno-info').textContent = `🏆 Ha vinto ${vincitore.nome}!`;
}

function avviaVistaLobby() {
  const listaEl = document.getElementById('lista-lobby');
  const bottoneInizia = document.getElementById('btn-inizia-partita');
  const conteggioEl = document.getElementById('conteggio-lobby');

  ascoltaLobby(codicePartita, (lobby) => {
    listaEl.innerHTML = lobby.map(g =>
      `<li><span class="pallino-lista" style="background:${PALETTE[g.colore] || g.colore}"></span>${g.nome}</li>`
    ).join('');
    conteggioEl.textContent = `${lobby.length} (minimo ${CONFIG.giocatori.minimo}, massimo ${CONFIG.giocatori.massimo})`;
    bottoneInizia.disabled = lobby.length < CONFIG.giocatori.minimo || lobby.length > CONFIG.giocatori.massimo;
  });

  bottoneInizia.addEventListener('click', async () => {
    bottoneInizia.disabled = true;
    const lobbyFinale = await leggiLobbyUnaVolta(codicePartita);
    iniziaPartitaVera(lobbyFinale);
  });
}

async function iniziaPartitaVera(giocatoriInfo) {
  document.getElementById('vista-lobby').classList.add('nascosta');
  document.getElementById('vista-gioco').classList.remove('nascosta');

  const coordinate = generaSpirale(6, 11);
  disegnaTabellone(coordinate);
  disegnaLegenda();

  stato = creaStatoIniziale(giocatoriInfo);
  creaPedine();

  await pubblicaStato(codicePartita, stato);
  cicloDiGioco();
}

async function avvia() {
  percorso = (await caricaJSON('dati/percorso.json')).celle;
  const carteConoscenza = await leggiMazzoDaFirebase('conoscenza');
  const carteImprevisto = await leggiMazzoDaFirebase('imprevisto');
  const carteProva = await leggiMazzoDaFirebase('prova');

  mazzoConoscenza = creaMazzo(carteConoscenza);
  mazzoImprevisto = creaMazzo(carteImprevisto);
  mazzoProva = creaMazzo(carteProva);

  codicePartita = generaCodicePartita();
  document.getElementById('codice-partita').textContent = codicePartita;
  await iniziaLobby(codicePartita);

  avviaVistaLobby();
}

avvia();