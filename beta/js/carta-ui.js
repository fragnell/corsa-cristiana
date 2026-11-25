// carta-ui.js
// Mostra la carta pescata (Conoscenza, Imprevisto, Prova, Salto, Fermo) con l'animazione di rotazione.
//
// La carta e' grande (in proporzione allo schermo, come il tabellone) e il testo si adatta da solo:
// parte grande, perche' la TV di solito e' lontana, e si rimpicciolisce solo quanto serve perche'
// entri tutto, senza tagli e senza barre di scorrimento (vedi trovaDimensione in carta-logica.js).
// Il pulsante A− / A+ del tabellone (dimensione-testo.js) fa partire tutto piu' grande o piu' piccolo.
//
// In alto la carta dice di chi e' (impostaProtagonista) e, per le domande, quanto tempo resta per
// rispondere (avviaTempoRisposta). L'esito della domanda compare sulla carta stessa
// (mostraEsitoSullaCarta, usata da risposta-ui.js): la domanda resta visibile, sopra una fascia
// verde o rossa, e nelle scelte multiple si colora l'opzione giusta.
//
// Modi d'uso:
// - mostraCartaEAspettaScelta: per Imprevisto, Prova, Salto e Fermo, ha dei bottoni e si chiude da
//   sola quando se ne preme uno.
// - mostraCarta + nascondiCarta: per la Conoscenza, resta visibile finche' non viene nascosta da chi
//   la usa, cosi' tutti possono continuare a leggere la domanda mentre il giocatore risponde.
//
// Ogni carta riparte "pulita" (prepara): niente opzioni, esiti o bottoni rimasti da quella prima.

import { riproduciEffetto } from './audio-ui.js';
import { oraServer } from './sincronizzazione.js';
import { trovaDimensione } from './carta-logica.js';

const EFFETTO_PER_TIPO = {
  CONOSCENZA: 'conoscenza',
  IMPREVISTO: 'imprevisto',
  SALTO: 'salto',
  FERMO: 'fermo',
  PROVA: 'conoscenza'
};

const NOMI_TIPO = {
  CONOSCENZA: '📖 Conoscenza',
  IMPREVISTO: '⚠️ Imprevisto',
  PROVA: '💪 Prova',
  SALTO: '🚀 Salto',
  FERMO: '😔 Scoraggiamento',
  JUNIOR: '🧒 Modalità Junior'
};

// Quanto resta visibile il retro della carta (sfondo + icona) prima di girarsi e mostrare il fronte.
const RITARDO_GIRATA_MS = 1350;

// Dimensione del testo della carta, in "unita' di scena" (1 = 1% della larghezza della scena):
// parte da MASSIMA e scende fino a MINIMA se il testo e' tanto. Il livello A−/A+ le moltiplica.
const TESTO_MASSIMO_SU = 4.0;
const TESTO_MINIMO_SU = 1.35;

// ---------- i pezzi della carta ----------

const el = id => document.getElementById(id);

let protagonista = null;      // { nome, colore } di chi gioca adesso (o null)
let timerTempo = null;        // il conto alla rovescia della risposta, in alto

function crea(tag, classe, testo) {
  const nodo = document.createElement(tag);
  if (classe) nodo.className = classe;
  if (testo !== undefined && testo !== null) nodo.textContent = String(testo);
  return nodo;
}

function fermaTempo() {
  if (timerTempo) clearInterval(timerTempo);
  timerTempo = null;
  const tempo = el('carta-tempo');
  if (tempo) { tempo.textContent = ''; tempo.classList.remove('carta-tempo-urgente'); }
}

// Di chi e' la carta che sta per uscire: compare in alto ("Carta di Bruno"). null = nessuno.
export function impostaProtagonista(giocatore) {
  protagonista = giocatore && giocatore.nome ? { nome: String(giocatore.nome), colore: giocatore.colore || '' } : null;
}

function scriviProtagonista(prefisso) {
  const chi = el('carta-chi');
  if (!chi) return;
  chi.textContent = '';
  if (!protagonista) return;
  const pallino = crea('span', 'carta-chi-pallino');
  pallino.style.background = protagonista.colore || '#888';
  chi.append(pallino, `${prefisso} `);
  chi.appendChild(crea('strong', '', protagonista.nome));
}

// Rimette la carta a zero, pronta per il tipo indicato: niente resti della carta precedente.
function prepara(tipoCarta, { prefissoChi = 'Carta di', conProtagonista = true } = {}) {
  fermaTempo();
  el('carta-retro').className = `carta-retro carta-retro-${tipoCarta}`;
  el('carta-fronte').className = `carta-fronte carta-fronte-${tipoCarta}`;
  el('carta-tipo').textContent = NOMI_TIPO[tipoCarta] || tipoCarta;
  if (conProtagonista) scriviProtagonista(prefissoChi);
  else el('carta-chi').textContent = '';
  const esito = el('carta-esito');
  esito.textContent = '';
  esito.className = 'carta-esito nascosta';
  el('carta-testo').textContent = '';
  el('carta-riferimento').textContent = '';
  el('carta-opzioni').textContent = '';
  el('carta-risposte').textContent = '';
  el('carta-bottoni').textContent = '';
}

function popolaContenuto(tipoCarta, carta) {
  prepara(tipoCarta, { prefissoChi: tipoCarta === 'CONOSCENZA' ? 'Risponde' : 'Carta di' });
  if (EFFETTO_PER_TIPO[tipoCarta]) riproduciEffetto(EFFETTO_PER_TIPO[tipoCarta]);

  const elTesto = el('carta-testo');
  const elRiferimento = el('carta-riferimento');

  if (tipoCarta === 'CONOSCENZA') {
    elTesto.textContent = carta.domanda;
    if (carta.tipo === 'elenco') {
      elRiferimento.textContent = `(cita almeno ${carta.minimoRichiesto})`;
    } else if (carta.tipo === 'scelta' && Array.isArray(carta.opzioni)) {
      const elenco = crea('ol', 'carta-opzioni-lista');
      if (carta.opzioni.length > 4) elenco.classList.add('carta-opzioni-tante');
      carta.opzioni.forEach(opzione => {
        const voce = crea('li', 'carta-opzione');
        voce.appendChild(crea('span', 'carta-opzione-testo', opzione));
        elenco.appendChild(voce);
      });
      el('carta-opzioni').appendChild(elenco);
    }
  } else {
    elTesto.textContent = carta.testo;
    if (tipoCarta === 'IMPREVISTO' || tipoCarta === 'FERMO' || tipoCarta === 'PROVA') {
      elRiferimento.textContent = carta.riferimento || '';
    }
  }
}

// ---------- il testo che si adatta ----------

function unitaScena() {
  const larghezza = Math.min(window.innerWidth, window.innerHeight * 16 / 9);
  return larghezza / 100;
}

function livelloTesto() {
  const n = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scala-testo'));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// Sceglie la dimensione del testo piu' grande per cui tutto il contenuto della carta ci sta.
// Va chiamata quando la carta e' visibile (sull'overlay nascosto non si puo' misurare).
export function adattaCarta() {
  const overlay = el('carta-overlay');
  const fronte = el('carta-fronte');
  const corpo = el('carta-corpo');
  if (!overlay || !fronte || !corpo || overlay.classList.contains('nascosta')) return;
  const su = unitaScena() * livelloTesto();
  const imposta = px => fronte.style.setProperty('--carta-testo', `${px.toFixed(1)}px`);
  const risultato = trovaDimensione(px => {
    imposta(px);
    return corpo.scrollHeight <= corpo.clientHeight + 1 && corpo.scrollWidth <= corpo.clientWidth + 1;
  }, { massima: TESTO_MASSIMO_SU * su, minima: TESTO_MINIMO_SU * su });
  imposta(risultato.dimensione);
  corpo.classList.toggle('carta-corpo-scorre', !risultato.entra);
}

window.addEventListener('resize', () => adattaCarta());

function mostraOverlay() {
  const overlay = el('carta-overlay');
  const carta = el('carta');
  carta.classList.remove('girata');
  overlay.classList.remove('nascosta');
  adattaCarta();
  return setTimeout(() => { carta.classList.add('girata'); adattaCarta(); }, RITARDO_GIRATA_MS);
}

// ---------- il tempo per rispondere, in alto a destra ----------

// scadenza: istante (ora del server) in cui finisce il tempo per rispondere.
export function avviaTempoRisposta(scadenza) {
  fermaTempo();
  const tempo = el('carta-tempo');
  if (!tempo || !Number.isFinite(Number(scadenza))) return;
  const aggiorna = () => {
    const secondi = Math.max(0, Math.ceil((Number(scadenza) - oraServer()) / 1000));
    tempo.textContent = `⏱️ ${secondi}s`;
    tempo.classList.toggle('carta-tempo-urgente', secondi <= 10);
  };
  aggiorna();
  timerTempo = setInterval(aggiorna, 250);
}

// ---------- Conoscenza: la domanda resta visibile ----------

// Il terzo parametro è facoltativo: se lo passi, sotto la carta compare un pulsante "Cambia domanda"
// — per il caso in cui esca comunque una domanda già fatta di recente o non adatta al momento. Resta
// attivo per DURATA_FINESTRA_CAMBIA_S secondi dopo che la carta si è rivelata: se nessuno lo preme in
// tempo, la promessa si risolve da sola come sempre.
export const DURATA_FINESTRA_CAMBIA_S = 10;

export function mostraCarta(tipoCarta, carta, onCambiaDomanda, scadenzaCambio) {
  return new Promise(risolvi => {
    popolaContenuto(tipoCarta, carta);
    const elBottoni = el('carta-bottoni');

    let timerCambia = null;
    let timerGirata = null;
    let timerChiusura = null;

    function pulisciTimer() {
      if (timerCambia) clearInterval(timerCambia);
      if (timerGirata) clearTimeout(timerGirata);
      if (timerChiusura) clearTimeout(timerChiusura);
      timerCambia = null;
      timerGirata = null;
      timerChiusura = null;
    }

    if (onCambiaDomanda) {
      const bottoneCambia = crea('button', 'carta-btn-cambia', '🔄 Cambia domanda');
      bottoneCambia.type = 'button';
      const elCountdown = crea('span', 'carta-cambia-countdown');
      const wrapper = crea('div', 'carta-cambia-wrapper');
      wrapper.append(bottoneCambia, elCountdown);

      bottoneCambia.addEventListener('click', () => {
        pulisciTimer();
        elBottoni.textContent = '';
        onCambiaDomanda();
        risolvi();
      });

      elBottoni.appendChild(wrapper);

      if (scadenzaCambio) {
        const aggiornaCountdown = () => {
          const restanti = Math.max(0, Math.round((scadenzaCambio - oraServer()) / 1000));
          elCountdown.textContent = `(${restanti}s)`;
        };
        aggiornaCountdown();
        timerCambia = setInterval(aggiornaCountdown, 1000);
      }
    }

    const overlay = el('carta-overlay');
    const elCarta = el('carta');
    elCarta.classList.remove('girata');
    overlay.classList.remove('nascosta');
    adattaCarta();
    timerGirata = setTimeout(() => {
      elCarta.classList.add('girata');
      adattaCarta();
      const attesa = scadenzaCambio ? Math.max(0, scadenzaCambio - oraServer()) : 600;
      timerChiusura = setTimeout(() => {
        pulisciTimer();
        elBottoni.textContent = '';
        adattaCarta();
        risolvi();
      }, attesa);
    }, RITARDO_GIRATA_MS);
  });
}

export function nascondiCarta() {
  fermaTempo();
  el('carta-overlay').classList.add('nascosta');
}

// ---------- l'esito della domanda, sulla carta ----------

// Mostra sulla carta (ancora aperta) l'esito: fascia verde o rossa in alto, la risposta data e,
// se e' sbagliata, quella giusta; nelle scelte multiple colora l'opzione giusta (e quella scelta,
// se era sbagliata). Restituisce il contenitore dei bottoni, che riempie chi lo usa (risposta-ui.js).
export function mostraEsitoSullaCarta({ carta, corretta, risposteDate, rispostaGiusta }) {
  fermaTempo();
  const esito = el('carta-esito');
  esito.className = `carta-esito ${corretta ? 'carta-esito-giusto' : 'carta-esito-sbagliato'}`;
  esito.textContent = corretta ? '✅ Corretto!' : '❌ Sbagliato';
  el('carta-fronte').classList.add(corretta ? 'carta-fronte-giusta' : 'carta-fronte-sbagliata');

  const date = Array.isArray(risposteDate) ? risposteDate.filter(r => r !== undefined && r !== null && String(r).trim()) : [];
  const elRisposte = el('carta-risposte');
  elRisposte.textContent = '';

  if (carta && carta.tipo === 'scelta') {
    const scelta = date[0];
    el('carta-opzioni').querySelectorAll('.carta-opzione').forEach((voce, i) => {
      const testo = carta.opzioni[i];
      voce.classList.toggle('carta-opzione-giusta', testo === carta.rispostaCorretta);
      voce.classList.toggle('carta-opzione-sbagliata', !corretta && testo === scelta);
    });
    if (!scelta) elRisposte.appendChild(crea('div', 'carta-risposta-data', 'Nessuna risposta'));
  } else {
    const riga = crea('div', 'carta-risposta-data');
    riga.append('Risposta data: ');
    riga.appendChild(crea('strong', '', date.length ? date.join(', ') : '(nessuna)'));
    elRisposte.appendChild(riga);
    if (!corretta && rispostaGiusta) {
      const giusta = crea('div', 'carta-risposta-giusta');
      giusta.append('Risposta giusta: ');
      giusta.appendChild(crea('strong', '', rispostaGiusta));
      elRisposte.appendChild(giusta);
    }
  }
  const bottoni = el('carta-bottoni');
  bottoni.textContent = '';
  adattaCarta();
  return bottoni;
}

// ---------- carte con dei bottoni (Imprevisto, Prova, Salto, Fermo) ----------

const DURATA_COUNTDOWN_SCELTA_S = 30;

// Il quarto parametro è facoltativo: se true, aggiunge un countdown di 30 secondi — se nessuno tocca
// nulla sul tabellone (bloccato, TV che si impianta, distrazione), si procede da soli con la PRIMA
// opzione dell'elenco. Per questo l'ordine delle opzioni conta: la prima deve sempre essere quella
// "sicura" da usare come default.
export function mostraCartaEAspettaScelta(tipoCarta, carta, opzioni, conCountdown) {
  return new Promise(risolvi => {
    popolaContenuto(tipoCarta, carta);
    const overlay = el('carta-overlay');
    const elBottoni = el('carta-bottoni');

    let concluso = false;
    let timer = null;
    const concludi = valore => {
      if (concluso) return;
      concluso = true;
      if (timer) clearInterval(timer);
      overlay.classList.add('nascosta');
      risolvi(valore);
    };

    const riga = crea('div', 'carta-bottoni-riga');
    opzioni.forEach(opz => {
      const bottone = crea('button', 'carta-bottone', opz.etichetta);
      bottone.type = 'button';
      bottone.addEventListener('click', () => concludi(opz.valore));
      riga.appendChild(bottone);
    });
    elBottoni.appendChild(riga);

    if (conCountdown) {
      let secondiRimasti = DURATA_COUNTDOWN_SCELTA_S;
      const elConto = crea('p', 'carta-nota');
      const scrivi = () => { elConto.textContent = `Se nessuno interviene entro ${secondiRimasti}s, si procede da soli`; };
      scrivi();
      elBottoni.appendChild(elConto);

      timer = setInterval(() => {
        secondiRimasti--;
        scrivi();
        if (secondiRimasti <= 0) concludi(opzioni[0].valore);
      }, 1000);
    }

    mostraOverlay();
  });
}

// ---------- prova in sospeso: e' stata superata? ----------

const DURATA_COUNTDOWN_PROVA_S = 30;

// Chiede se una prova "vincolo" è stata superata, quando torna il turno di chi la stava affrontando.
// Un conto alla rovescia di 30 secondi: se scade senza risposta, si considera superata di default.
export function chiediEsitoProvaVincolo(nomeGiocatore, prova) {
  return new Promise(risolvi => {
    prepara('PROVA', { prefissoChi: 'Prova in sospeso di' });
    const overlay = el('carta-overlay');
    const elBottoni = el('carta-bottoni');
    el('carta-testo').textContent = prova.testo;
    el('carta-riferimento').textContent = prova.riferimento || '';

    let secondiRimasti = DURATA_COUNTDOWN_PROVA_S;
    const domanda = crea('p', 'carta-domanda-gruppo');
    domanda.appendChild(crea('strong', '', nomeGiocatore));
    domanda.append(', hai superato la prova?');
    const riga = crea('div', 'carta-bottoni-riga');
    const si = crea('button', 'carta-bottone', '✅ Sì, superata');
    const no = crea('button', 'carta-bottone', '❌ No, fallita');
    si.type = 'button'; no.type = 'button';
    riga.append(si, no);
    const conto = crea('p', 'carta-nota');
    const scrivi = () => { conto.textContent = `Se nessuno risponde entro ${secondiRimasti}s, si considera superata`; };
    scrivi();
    elBottoni.append(domanda, riga, conto);

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
      scrivi();
      if (secondiRimasti <= 0) concludi(true);
    }, 1000);

    si.addEventListener('click', () => concludi(true));
    no.addEventListener('click', () => concludi(false));

    mostraOverlay();
  });
}

// ---------- modalita' junior: va bene per il gruppo? ----------

const DURATA_COUNTDOWN_JUNIOR_S = 30;

// Chiede conferma al gruppo quando qualcuno spunta "modalità junior" in fase di registrazione: stessa
// struttura del countdown della prova vincolo, riusa lo stesso overlay della carta.
export function chiediConfermaJunior(nomeGiocatore) {
  return new Promise(risolvi => {
    prepara('JUNIOR', { conProtagonista: false });
    el('carta-retro').className = 'carta-retro carta-retro-CONOSCENZA';
    const overlay = el('carta-overlay');
    const elBottoni = el('carta-bottoni');
    el('carta-testo').textContent = `${nomeGiocatore} ha chiesto la modalità junior (domande più semplici, a scelta multipla). Va bene per il gruppo?`;

    let secondiRimasti = DURATA_COUNTDOWN_JUNIOR_S;
    const riga = crea('div', 'carta-bottoni-riga');
    const si = crea('button', 'carta-bottone', '✅ Va bene');
    const no = crea('button', 'carta-bottone', '❌ No, gioca normale');
    si.type = 'button'; no.type = 'button';
    riga.append(si, no);
    const conto = crea('p', 'carta-nota');
    const scrivi = () => { conto.textContent = `Se nessuno risponde entro ${secondiRimasti}s, si accetta`; };
    scrivi();
    elBottoni.append(riga, conto);

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
      scrivi();
      if (secondiRimasti <= 0) concludi(true);
    }, 1000);

    si.addEventListener('click', () => concludi(true));
    no.addEventListener('click', () => concludi(false));

    mostraOverlay();
  });
}
