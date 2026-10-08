// verdetto-telefono-ui.js
// Il pannello che compare sul telefono subito dopo aver risposto a una
// domanda Conoscenza: dice se la risposta era corretta o sbagliata e si
// chiude da solo dopo 10 secondi (oppure con OK).
//
// Se la domanda ha un link "Approfondisci", nel pannello compare anche il
// pulsante per aprirlo. Il link arriva dal tabellone dentro il verdetto
// (quindi solo dopo che il giocatore ha risposto) e qui viene ricontrollato
// con le stesse regole strette di link-approfondimento.js: se non è un
// indirizzo buono di JW.org, il pulsante non compare affatto.
//
// Toccare "Approfondisci" non apre subito la pagina: prima compare un avviso
// fisso (il link porta a un contenuto di JW.org, il gioco è un progetto
// indipendente), poi "Apri la pagina" la apre in una nuova scheda. Mentre
// l'avviso è aperto il conto alla rovescia è fermo; "Annulla" torna al
// verdetto e il conto riparte da capo.

import { linkDaUsare } from './link-approfondimento.js';

const DURATA_PANNELLO_S = 10;

let timer = null;
let linkCorrente = null;
let collegato = false;

function el(id) {
  return document.getElementById(id);
}

function fermaConto() {
  if (timer) clearInterval(timer);
  timer = null;
}

function avviaConto() {
  fermaConto();
  let secondiRimasti = DURATA_PANNELLO_S;
  el('verdetto-overlay-countdown').textContent = `Si chiude tra ${secondiRimasti}s`;
  timer = setInterval(() => {
    secondiRimasti--;
    el('verdetto-overlay-countdown').textContent = `Si chiude tra ${secondiRimasti}s`;
    if (secondiRimasti <= 0) chiudiVerdettoSulTelefono();
  }, 1000);
}

function mostraVistaEsito() {
  el('verdetto-vista-avviso').classList.add('nascosta');
  el('verdetto-vista-esito').classList.remove('nascosta');
  avviaConto();
}

function mostraVistaAvviso() {
  // Senza un link buono non si arriva all'avviso: il pulsante nemmeno c'è.
  if (!linkCorrente) return;
  fermaConto();
  el('avviso-apri').setAttribute('href', linkCorrente);
  el('verdetto-vista-esito').classList.add('nascosta');
  el('verdetto-vista-avviso').classList.remove('nascosta');
}

// Chiude tutto il pannello e lo rimette com'era all'inizio (vista del
// verdetto, nessun link in memoria), pronto per il prossimo.
export function chiudiVerdettoSulTelefono() {
  fermaConto();
  linkCorrente = null;
  el('avviso-apri').removeAttribute('href');
  el('verdetto-vista-avviso').classList.add('nascosta');
  el('verdetto-vista-esito').classList.remove('nascosta');
  el('verdetto-overlay').classList.add('nascosta');
}

// Il telefono ha bisogno del giocatore (arriva una domanda per lui, oppure
// tocca a lui tirare il dado): se l'avviso di Approfondisci è ancora aperto
// lo chiude, così non resta davanti a cose più urgenti. Il verdetto normale
// non si tocca: si chiude da solo come sempre.
export function chiudiAvvisoSeAperto() {
  if (!el('verdetto-vista-avviso').classList.contains('nascosta')) {
    chiudiVerdettoSulTelefono();
  }
}

function collegaUnaVolta() {
  if (collegato) return;
  collegato = true;

  el('verdetto-overlay-ok').addEventListener('click', chiudiVerdettoSulTelefono);
  el('verdetto-overlay-approfondisci').addEventListener('click', mostraVistaAvviso);
  el('avviso-annulla').addEventListener('click', mostraVistaEsito);

  // "Apri la pagina" è un vero collegamento: la nuova scheda la apre il
  // browser da solo. Qui si chiude il pannello subito dopo (con un attimo di
  // ritardo, a scheda già aperta), così al ritorno nel gioco non resta lì.
  el('avviso-apri').addEventListener('click', () => {
    setTimeout(chiudiVerdettoSulTelefono, 0);
  });
}

// "linkRicevuto" è il campo linkApprofondimento del verdetto: può mancare.
export function mostraVerdettoSulTelefono(corretta, linkRicevuto) {
  collegaUnaVolta();

  const testo = el('verdetto-overlay-testo');
  testo.textContent = corretta ? '✅ Risposta corretta!' : '❌ Risposta errata';
  testo.style.color = corretta ? '#2e7d32' : '#c62828';

  // Il pulsante compare solo con un link buono, ricontrollato qui anche se il
  // tabellone l'ha già controllato prima di mandarlo.
  linkCorrente = linkDaUsare(linkRicevuto);
  el('verdetto-overlay-approfondisci').classList.toggle('nascosta', linkCorrente === null);

  el('verdetto-overlay').classList.remove('nascosta');
  mostraVistaEsito();
}
