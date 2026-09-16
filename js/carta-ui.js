// carta-ui.js
// Mostra la carta pescata (Conoscenza, Imprevisto, Prova) con l'animazione
// di rotazione.
//
// Due modi d'uso:
// - mostraCartaEAspettaScelta: per Imprevisto e Prova, ha dei bottoni e si
//   chiude da sola quando se ne preme uno.
// - mostraCarta + nascondiCarta: per la Conoscenza, resta visibile finché
//   non viene nascosta esplicitamente da chi la usa — così tutti possono
//   continuare a leggere la domanda mentre il giocatore scrive la risposta.

import { riproduciEffetto } from './audio-ui.js';

const EFFETTO_PER_TIPO = {
  CONOSCENZA: 'conoscenza',
  IMPREVISTO: 'imprevisto',
  SALTO: 'salto',
  FERMO: 'fermo',
  PROVA: 'conoscenza'
};

function popolaContenuto(tipoCarta, carta) {
  const elTipo = document.getElementById('carta-tipo');
  const elTesto = document.getElementById('carta-testo');
  const elRiferimento = document.getElementById('carta-riferimento');

  elTipo.textContent = tipoCarta;
  elRiferimento.textContent = '';

  if (EFFETTO_PER_TIPO[tipoCarta]) riproduciEffetto(EFFETTO_PER_TIPO[tipoCarta]);

  if (tipoCarta === 'CONOSCENZA') {
    elTesto.textContent = carta.domanda;
    if (carta.tipo === 'elenco') {
      elRiferimento.textContent = `(cita almeno ${carta.minimoRichiesto})`;
    } else if (carta.tipo === 'scelta') {
      elRiferimento.textContent = '(scelta multipla — guarda le opzioni sul telefono)';
    }
  } else {
    elTesto.textContent = carta.testo;
    if (tipoCarta === 'IMPREVISTO' || tipoCarta === 'FERMO') {
      elRiferimento.textContent = carta.riferimento || '';
    }
  }

  // testo lungo: dimensione più contenuta, per essere sicuri che entri nella carta
  elTesto.classList.toggle('carta-testo-lungo', elTesto.textContent.length > 190);
}

// Il terzo parametro è facoltativo: se lo passi, sotto la carta compare
// un pulsante "Cambia domanda" — il paracadute per il raro caso in cui
// esca comunque una domanda già fatta di recente. Disponibile solo
// mentre la carta si rivela, non dopo: se nessuno lo preme in tempo, la
// promessa si risolve normalmente come sempre.
export function mostraCarta(tipoCarta, carta, onCambiaDomanda) {
  return new Promise(risolvi => {
    const overlay = document.getElementById('carta-overlay');
    const elCarta = document.getElementById('carta');
    const elBottoni = document.getElementById('carta-bottoni');
    elBottoni.innerHTML = '';

    popolaContenuto(tipoCarta, carta);

    if (onCambiaDomanda) {
      const bottoneCambia = document.createElement('button');
      bottoneCambia.type = 'button';
      bottoneCambia.className = 'carta-btn-cambia';
      bottoneCambia.textContent = '🔄 Cambia domanda';
      bottoneCambia.addEventListener('click', () => {
        elBottoni.innerHTML = '';
        onCambiaDomanda();
      });
      elBottoni.appendChild(bottoneCambia);
    }

    elCarta.classList.remove('girata');
    overlay.classList.remove('nascosta');
    setTimeout(() => {
      elCarta.classList.add('girata');
      setTimeout(risolvi, 600);
    }, 400);
  });
}

export function nascondiCarta() {
  document.getElementById('carta-overlay').classList.add('nascosta');
}

const DURATA_COUNTDOWN_SCELTA_S = 30;

// Il quarto parametro è facoltativo: se true, aggiunge un countdown di
// 30 secondi — se nessuno tocca nulla sul tabellone (bloccato, TV che si
// impianta, distrazione), si procede da soli con la PRIMA opzione
// dell'elenco. Per questo l'ordine delle opzioni conta: la prima deve
// sempre essere quella "sicura" da usare come default.
export function mostraCartaEAspettaScelta(tipoCarta, carta, opzioni, conCountdown) {
  return new Promise(risolvi => {
    const overlay = document.getElementById('carta-overlay');
    const elCarta = document.getElementById('carta');
    const elBottoni = document.getElementById('carta-bottoni');

    popolaContenuto(tipoCarta, carta);

    let concluso = false;
    let timer = null;
    const concludi = valore => {
      if (concluso) return;
      concluso = true;
      if (timer) clearInterval(timer);
      overlay.classList.add('nascosta');
      risolvi(valore);
    };

    elBottoni.innerHTML = '';
    opzioni.forEach(opz => {
      const bottone = document.createElement('button');
      bottone.textContent = opz.etichetta;
      bottone.addEventListener('click', () => concludi(opz.valore));
      elBottoni.appendChild(bottone);
    });

    if (conCountdown) {
      let secondiRimasti = DURATA_COUNTDOWN_SCELTA_S;
      const elConto = document.createElement('p');
      elConto.className = 'prova-vincolo-countdown';
      elConto.textContent = `Se nessuno interviene entro ${secondiRimasti}s, si procede da soli`;
      elBottoni.insertBefore(elConto, elBottoni.firstChild);

      timer = setInterval(() => {
        secondiRimasti--;
        elConto.textContent = `Se nessuno interviene entro ${secondiRimasti}s, si procede da soli`;
        if (secondiRimasti <= 0) concludi(opzioni[0].valore);
      }, 1000);
    }

    elCarta.classList.remove('girata');
    overlay.classList.remove('nascosta');
    setTimeout(() => elCarta.classList.add('girata'), 400);
  });
}


const DURATA_COUNTDOWN_PROVA_S = 30;

// Chiede se una prova "vincolo" è stata superata, quando torna il turno
// di chi la stava affrontando. Un conto alla rovescia di 30 secondi: se
// scade senza risposta, si considera superata di default.
export function chiediEsitoProvaVincolo(nomeGiocatore, prova) {
  return new Promise(risolvi => {
    const overlay = document.getElementById('carta-overlay');
    const elCarta = document.getElementById('carta');
    const elTipo = document.getElementById('carta-tipo');
    const elTesto = document.getElementById('carta-testo');
    const elRiferimento = document.getElementById('carta-riferimento');
    const elBottoni = document.getElementById('carta-bottoni');

    elTipo.textContent = 'PROVA';
    elTesto.textContent = prova.testo;
    elRiferimento.textContent = prova.riferimento || '';

    let secondiRimasti = DURATA_COUNTDOWN_PROVA_S;

    elBottoni.innerHTML = `
      <p class="prova-vincolo-titolo">${nomeGiocatore}, hai superato la prova?</p>
      <p class="prova-vincolo-countdown">Se nessuno risponde entro <span id="prova-vincolo-conto">${secondiRimasti}</span>s, si considera superata</p>
      <button id="prova-vincolo-si">✅ Sì, superata</button>
      <button id="prova-vincolo-no">❌ No, fallita</button>
    `;

    let concluso = false;
    const concludi = risultato => {
      if (concluso) return;
      concluso = true;
      clearInterval(timer);
      overlay.classList.add('nascosta');
      risolvi(risultato);
    };

    const timer = setInterval(() => {
      secondiRimasti--;
      const conto = document.getElementById('prova-vincolo-conto');
      if (conto) conto.textContent = secondiRimasti;
      if (secondiRimasti <= 0) concludi(true);
    }, 1000);

    document.getElementById('prova-vincolo-si').addEventListener('click', () => concludi(true));
    document.getElementById('prova-vincolo-no').addEventListener('click', () => concludi(false));

    elCarta.classList.remove('girata');
    overlay.classList.remove('nascosta');
    setTimeout(() => elCarta.classList.add('girata'), 400);
  });
}


const DURATA_COUNTDOWN_JUNIOR_S = 30;

// Chiede conferma al gruppo quando qualcuno spunta "modalità junior" in
// fase di registrazione — stessa struttura del countdown della prova
// vincolo, riusa lo stesso overlay della carta.
export function chiediConfermaJunior(nomeGiocatore) {
  return new Promise(risolvi => {
    const overlay = document.getElementById('carta-overlay');
    const elCarta = document.getElementById('carta');
    const elTipo = document.getElementById('carta-tipo');
    const elTesto = document.getElementById('carta-testo');
    const elRiferimento = document.getElementById('carta-riferimento');
    const elBottoni = document.getElementById('carta-bottoni');

    elTipo.textContent = 'MODALITÀ JUNIOR';
    elTesto.textContent = `${nomeGiocatore} ha chiesto la modalità junior (domande più semplici, a scelta multipla). Va bene per il gruppo?`;
    elRiferimento.textContent = '';

    let secondiRimasti = DURATA_COUNTDOWN_JUNIOR_S;

    elBottoni.innerHTML = `
      <p class="prova-vincolo-countdown">Se nessuno risponde entro <span id="junior-conto">${secondiRimasti}</span>s, si accetta</p>
      <button id="junior-si">✅ Va bene</button>
      <button id="junior-no">❌ No, gioca normale</button>
    `;

    let concluso = false;
    const concludi = risultato => {
      if (concluso) return;
      concluso = true;
      clearInterval(timer);
      overlay.classList.add('nascosta');
      risolvi(risultato);
    };

    const timer = setInterval(() => {
      secondiRimasti--;
      const conto = document.getElementById('junior-conto');
      if (conto) conto.textContent = secondiRimasti;
      if (secondiRimasti <= 0) concludi(true);
    }, 1000);

    document.getElementById('junior-si').addEventListener('click', () => concludi(true));
    document.getElementById('junior-no').addEventListener('click', () => concludi(false));

    elCarta.classList.remove('girata');
    overlay.classList.remove('nascosta');
    setTimeout(() => elCarta.classList.add('girata'), 400);
  });
}