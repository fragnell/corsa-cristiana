// comodita-telefono.js
// Due piccole comodita' del telefono mentre si gioca:
//
//  1) LO SCHERMO RESTA ACCESO per tutta la partita. Un telefono lasciato sul tavolo si spegne dopo una
//     trentina di secondi, e un telefono con lo schermo spento esce dalla partita: toccava ripremere,
//     rientrare, rischiare di perdere il proprio turno. Adesso non succede piu' (se il telefono lo permette).
//
//  2) UN AVVISO quando tocca a te (hai il dado da tirare) o quando devi rispondere a una domanda:
//     il telefono vibra (Android), il riquadro giusto (lo stato, o la domanda) lampeggia per qualche
//     secondo (funziona anche su iPhone, che non sa vibrare) e si sente un suono breve
//     (lo produce js/suono-avviso.js; la persona puo' spegnerlo con l'interruttore «Suono»).
//
// Niente di tutto questo e' indispensabile: se il telefono non conosce queste funzioni, o le rifiuta
// (per esempio con il risparmio energetico acceso), la partita funziona come sempre.
// Non lancia MAI errori verso chi la usa. "ambiente" serve solo ai collaudi (navigator, document,
// "alAvviso" e "suono" finti) e a passare il suono dell'avviso (ambiente.suono: vedi giocatore-ui.js).

import { creaSchermoAcceso } from './salmo/schermo-acceso.js';

// Il disegno della vibrazione: millisecondi di vibrazione e di pausa, alternati.
export const VIBRAZIONE_TOCCA_A_TE = [200, 100, 200];
export const VIBRAZIONE_DOMANDA = [350];
// Per quanto tempo lampeggia il riquadro.
export const DURATA_LAMPEGGIO_MS = 3000;
// I riquadri della pagina del telefono che lampeggiano, e la classe che li fa lampeggiare (vedi css/giocatore.css):
// "Tocca a te!" sta nel riquadro dello stato; la domanda sta nel riquadro giallo della domanda (lo stato, in quel
// momento, e' vuoto).
const ID_RIQUADRO = { dado: 'stato-turno', domanda: 'area-domanda-conoscenza' };
const CLASSE_LAMPEGGIO = 'avviso-turno';

// Che cosa sta chiedendo la partita a QUESTO giocatore, in questo momento:
//   'domanda:<id>'  deve rispondere a una domanda Conoscenza
//   'dado'          e' il suo turno e il dado e' pronto
//   null            niente (tocca a un altro, c'e' una prova in sospeso, la partita e' finita...)
// E' la stessa regola che decide quando la pagina mostra "Tocca a te!" o la domanda.
export function cosaMiChiede(stato, mioId) {
  try {
    if (!stato || typeof stato !== 'object' || !stato.giocatori) return null;
    if (stato.vincitore !== null && stato.vincitore !== undefined) return null;
    // Durante COLLABORIAMO! la sua schermata copre tutto il telefono: niente avvisi sotto quella schermata
    // (quando la prova finisce, se tocca a me, l'avviso parte allora).
    if (stato.salmoInCorso) return null;
    const io = stato.giocatori[mioId];
    if (!io) return null;

    const richiesta = stato.richiestaConoscenza;
    if (richiesta && richiesta.giocatoreId === mioId) return 'domanda:' + String(richiesta.id);

    if (stato.turnoDi === mioId && !stato.turnoInCorso && !io.provaInSospeso) return 'dado';
    return null;
  } catch (errore) {
    return null;
  }
}

export function creaComoditaTelefono(ambiente = {}) {
  const nav = ambiente.navigator !== undefined
    ? ambiente.navigator
    : (typeof navigator !== 'undefined' ? navigator : null);
  const doc = ambiente.document !== undefined
    ? ambiente.document
    : (typeof document !== 'undefined' ? document : null);

  const schermo = creaSchermoAcceso(ambiente);
  // Il suono dell'avviso: se manca (o non e' fatto come ci aspettiamo) l'avviso resta senza suono.
  const suono = ambiente.suono && typeof ambiente.suono.suona === 'function' ? ambiente.suono : null;
  let ultimaRichiesta = null;     // cosa mi chiedeva la partita l'ultima volta (per avvisare solo quando CAMBIA)
  let timerLampeggio = null;
  let riquadroAcceso = null;      // il riquadro che sta lampeggiando adesso (uno solo alla volta)

  // Vibra, se il telefono lo sa fare. Chrome rifiuta (e scrive un avviso in console) finche' la persona
  // non ha toccato la pagina almeno una volta: in quel caso non ci si prova nemmeno.
  function vibra(disegno) {
    try {
      if (!nav || typeof nav.vibrate !== 'function') return false;
      if (nav.userActivation && nav.userActivation.hasBeenActive === false) return false;
      return nav.vibrate(disegno) === true;
    } catch (errore) {
      return false;
    }
  }

  // Fa sentire il suono dell'avviso. Se la persona l'ha spento, o il telefono non riesce a suonare, non succede niente.
  function suona(tipo) {
    try {
      if (suono) suono.suona(tipo);
    } catch (errore) { /* pazienza */ }
  }

  function smettiDiLampeggiare() {
    try {
      if (timerLampeggio) { clearTimeout(timerLampeggio); timerLampeggio = null; }
    } catch (errore) { /* pazienza */ }
    try {
      if (riquadroAcceso) riquadroAcceso.classList.remove(CLASSE_LAMPEGGIO);
    } catch (errore) { /* pazienza */ }
    riquadroAcceso = null;
  }

  // Il riquadro giusto (quello dello stato per il dado, quello della domanda per la domanda) lampeggia per
  // qualche secondo; chi ha il movimento ridotto vede solo un contorno colorato: lo decide il CSS.
  function lampeggia(tipo) {
    try {
      if (typeof ambiente.alAvviso === 'function') { ambiente.alAvviso(tipo); return; }
      const riquadro = doc && doc.getElementById ? doc.getElementById(ID_RIQUADRO[tipo]) : null;
      if (!riquadro) return;
      smettiDiLampeggiare();                      // un solo riquadro acceso alla volta
      riquadro.classList.remove(CLASSE_LAMPEGGIO);
      void riquadro.offsetWidth;                  // fa ripartire l'animazione anche se era gia' in corso
      riquadro.classList.add(CLASSE_LAMPEGGIO);
      riquadroAcceso = riquadro;
      timerLampeggio = setTimeout(() => {
        timerLampeggio = null;
        smettiDiLampeggiare();
      }, DURATA_LAMPEGGIO_MS);
    } catch (errore) { /* pazienza */ }
  }

  return {
    // Il giocatore e' dentro la partita (anche solo in sala d'attesa): lo schermo resta acceso.
    entraInPartita() {
      try { schermo.accendi(); } catch (errore) { /* pazienza */ }
    },

    // Un tocco della persona: alcuni telefoni accettano di tenere lo schermo acceso solo cosi'.
    riprova() {
      try { schermo.riprova(); } catch (errore) { /* pazienza */ }
    },

    // Ha abbandonato, o la partita e' finita: lo schermo torna a spegnersi come al solito.
    esciDallaPartita() {
      try { schermo.spegni(); } catch (errore) { /* pazienza */ }
      ultimaRichiesta = null;
      smettiDiLampeggiare();
    },

    // Da chiamare a ogni nuovo stato della partita. Avvisa UNA volta sola ogni volta che la partita
    // comincia a chiedere qualcosa a questo giocatore. Restituisce che cosa ha fatto (per i collaudi).
    aggiorna(stato, mioId) {
      const richiesta = cosaMiChiede(stato, mioId);
      if (richiesta === ultimaRichiesta) return { avviso: null };
      ultimaRichiesta = richiesta;
      if (richiesta === null) {
        smettiDiLampeggiare();
        return { avviso: null };
      }
      const tipo = richiesta === 'dado' ? 'dado' : 'domanda';
      const vibrato = vibra(tipo === 'dado' ? VIBRAZIONE_TOCCA_A_TE : VIBRAZIONE_DOMANDA);
      lampeggia(tipo);
      suona(tipo);                  // per ultimo: il lampeggio e la vibrazione partono comunque senza aspettare l'audio
      return { avviso: tipo, vibrato };
    },

    // Solo per i collaudi.
    stato() {
      return { schermo: schermo.stato(), ultimaRichiesta };
    }
  };
}
