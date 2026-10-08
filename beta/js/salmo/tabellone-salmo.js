// tabellone-salmo.js
// Salmo 133:1 — il punto di contatto tra il tabellone e COLLABORIAMO!.
// E' l'UNICO file del Salmo che tabellone-ui.js conosce, e lo carica in un
// modo "a prova di guasto": se questo file (o uno dei suoi) non si carica,
// il gioco normale va avanti come se la prova non esistesse.
//
// Cosa fa:
//   - a ogni passaggio di turno aggiorna i contatori e chiede alla regola
//     (regola.js) se e' il momento della prova;
//   - se lo e', la svolge (orchestratore.js) mostrando tutto sul tabellone;
//   - rimette lo stato della partita a posto, QUALUNQUE cosa sia successa.
//
// Lo stato vive nel tabellone: qui ci si arriva con due funzioni
// (getStato / setStato) e con quello che serve per animare le pedine.

import { configSalmoSicura, valutaSalmo, contatoriDopoTurno, contatoriDopoAvvio } from './regola.js';
import { campiDaConfig, sembranoValoriDiProva } from './admin-valori.js';
import { creaSessione } from './sessione.js';
import { ID_DISEGNI } from './disegni.js';
import { svolgiSalmo } from './orchestratore.js';
import { creaReteTabellone, ascoltaCapacita, registraStatisticheSalmo } from './rete-salmo.js';
import { creaInterfacciaTabellone } from './tabellone-salmo-ui.js';
import { oraServer } from '../sincronizzazione.js';

// Quanto il guardiano aspetta, oltre la scadenza massima della prova, prima di
// chiuderla con la forza. Non dovrebbe mai servire: e' l'ultima rete di sicurezza.
const MARGINE_GUARDIANO_MS = 20000;

let contesto = null;
let cfg = null;
let reteTabellone = null;
let interfaccia = null;
let capacita = {};
let inCorso = false;

// contesto = {
//   codicePartita, configSalmo, ultimaCasella,
//   getStato(), setStato(stato), presente(id), animaSpostamento(id, da, a)
// }
export function inizializza(nuovoContesto) {
  contesto = nuovoContesto;
  cfg = configSalmoSicura(contesto.configSalmo);
  reteTabellone = null;
  interfaccia = null;
  capacita = {};
  inCorso = false;
  // Spenta dall'Admin: il tabellone si comporta come se COLLABORIAMO! non esistesse
  // (niente schermate, niente ascolti, nessun dato in piu' nello stato della partita).
  if (!cfg.attivo) return;

  reteTabellone = creaReteTabellone(contesto.codicePartita);
  interfaccia = creaInterfacciaTabellone({ animaSpostamento: contesto.animaSpostamento });
  ascoltaCapacita(contesto.codicePartita, c => { capacita = c || {}; });
  // Se sono rimasti salvati i valori PER PROVARE, una targhetta sulla TV lo ricorda.
  try {
    if (sembranoValoriDiProva(campiDaConfig(cfg))) interfaccia.mostraEtichettaProva();
  } catch (errore) { /* solo un promemoria: se non riesce, pazienza */ }
}

// Il tabellone si e' appena riavviato su una partita gia' iniziata: la prova
// che era eventualmente in corso non esiste piu'. Toglie i resti dallo stato
// e (senza aspettarla) anche da Firebase. Restituisce lo stato pulito.
export function pulisciInRipresa(stato) {
  if (reteTabellone) {
    try { Promise.resolve(reteTabellone.pulisci()).catch(() => {}); } catch (errore) { /* pazienza */ }
  }
  if (!stato) return stato;
  const pulito = { ...stato };
  delete pulito.salmoInCorso;
  return pulito;
}

function senzaProvaInCorso(stato) {
  const copia = { ...stato };
  delete copia.salmoInCorso;
  return copia;
}

// Da chiamare subito dopo passaTurno(), prima di pubblicare il nuovo turno.
// Non lancia mai errori e non restituisce nulla: se parte una prova, lo stato
// del tabellone (getStato/setStato) viene aggiornato con il risultato.
export async function dopoPassaggioDiTurno() {
  if (!contesto || !cfg || !cfg.attivo || inCorso) return;
  inCorso = true;
  const sicuro = contesto.getStato();
  try {
    let stato = contesto.getStato();
    if (!stato || stato.vincitore != null) return;

    // 1. un altro passaggio di turno e' avvenuto
    stato = { ...stato, salmo: contatoriDopoTurno(stato) };
    contesto.setStato(stato);

    // 2. e' il momento della prova? Servono due telefoni che sanno fare COLLABORIAMO!.
    //    Non si guarda se in questo istante risultano "collegati": un telefono con lo
    //    schermo spento (capita di continuo, mentre aspetta il suo turno) risulta
    //    scollegato, ma si risveglia appena la persona lo prende in mano, e per premere
    //    «Sono pronto» ci sono 60 secondi.
    const decisione = valutaSalmo(stato, cfg, {
      presenti: id => capacita[id] === true
    });
    if (!decisione.scatta) return;

    // 3. si parte. Il contatore sale SUBITO (anche se la prova verra' annullata
    //    conta comunque nelle due massime della partita).
    stato = { ...stato, salmo: contatoriDopoAvvio(stato) };
    contesto.setStato(stato);

    const sessione = creaSessione({
      decisione, cfg, idDisegni: ID_DISEGNI, adesso: oraServer(), rng: Math.random
    });

    const segnale = { annullato: false };
    const ambiente = {
      adesso: oraServer,
      getStato: contesto.getStato,
      setStato: contesto.setStato,
      pubblica: contesto.pubblica,
      ultimaCasella: contesto.ultimaCasella,
      presente: id => contesto.presente(id) !== false,
      rete: reteTabellone,
      ui: interfaccia
    };

    // Il guardiano: se per un guasto che non ho previsto la prova non finisse
    // mai, dopo il tempo massimo la chiude con la forza.
    let timerGuardiano = null;
    const guardiano = new Promise(risolvi => {
      const attesa = Math.max(1000, sessione.pubblica.scadenzaMassima - oraServer()) + MARGINE_GUARDIANO_MS;
      timerGuardiano = setTimeout(() => { segnale.annullato = true; risolvi('guardiano'); }, attesa);
    });

    const risultato = await Promise.race([
      svolgiSalmo({ decisione, cfg, sessione, ambiente, segnale }),
      guardiano
    ]);
    clearTimeout(timerGuardiano);

    let finale;
    if (risultato === 'guardiano') {
      console.warn('COLLABORIAMO!: prova chiusa dal guardiano');
      try { interfaccia.nascondi(); interfaccia.ripristinaMusica(); } catch (errore) { /* pazienza */ }
      try { Promise.resolve(reteTabellone.pulisci()).catch(() => {}); } catch (errore) { /* pazienza */ }
      finale = senzaProvaInCorso(contesto.getStato());
      registra({ esito: 'annullato', motivo: 'guardiano', durataMs: 0, tentativi: 0, sbirciata: false, livello: decisione.livello });
    } else {
      finale = risultato.stato ? senzaProvaInCorso(risultato.stato) : senzaProvaInCorso(contesto.getStato());
      // L'esito ha fatto passare il turno una seconda volta: conta anche questo.
      if (risultato.turnoPassato) finale.salmo = contatoriDopoTurno(finale);
      registra(risultato);
    }
    contesto.setStato(finale);
  } catch (errore) {
    // Qualunque cosa sia andata storta: la partita riprende com'era, senza prova.
    console.warn('COLLABORIAMO!: errore, prova annullata', errore);
    try { interfaccia.nascondi(); interfaccia.ripristinaMusica(); } catch (e) { /* pazienza */ }
    try {
      const attuale = contesto.getStato() || sicuro;
      contesto.setStato(senzaProvaInCorso(attuale));
    } catch (e) { /* pazienza */ }
  } finally {
    inCorso = false;
  }
}

// Statistiche anonime: si spara e ci si dimentica, non devono mai rallentare nulla.
function registra(risultato) {
  try {
    Promise.resolve(registraStatisticheSalmo({
      esito: risultato.esito,
      motivo: risultato.motivo,
      durataMs: risultato.durataMs,
      tentativi: risultato.tentativi,
      sbirciata: risultato.sbirciata,
      livello: risultato.livello
    })).catch(() => {});
  } catch (errore) { /* pazienza */ }
}
