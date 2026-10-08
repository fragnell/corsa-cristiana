// telefono-salmo.js
// Salmo 133:1 — COLLABORIAMO! sul telefono. E' l'UNICO file della prova che
// giocatore-ui.js conosce, e lo carica in un modo "a prova di guasto": se
// non si carica, il telefono continua a funzionare come sempre.
//
// Funziona cosi': a ogni nuovo stato della partita, giocatore-ui.js chiama
// aggiorna(stato). Se nello stato c'e' una prova in corso, qui si apre una
// schermata che copre tutto e, a seconda di chi sono io:
//   - il primo       -> schermo-primo.js
//   - l'ultimo       -> schermo-ultimo.js
//   - chiunque altro -> una schermata semplice ("stanno giocando insieme")
// Quando la prova sparisce dallo stato, la schermata si chiude da sola.

import { crea, svuota, caricaStile, segnaBeta } from './dom.js';
import { ruoloDi, sessioneScaduta } from './sessione.js';
import { TITOLO, VERSETTO, telefono as TESTI } from './testi.js';
import { dichiaraCapacita } from './rete-salmo.js';
import { creaSchermoPrimo } from './schermo-primo.js';
import { creaSchermoUltimo } from './schermo-ultimo.js';
import { creaSchermoAcceso } from './schermo-acceso.js';
import { oraServer } from '../sincronizzazione.js';

let contesto = null;
let overlay = null;
let corpo = null;
let sidCorrente = null;
let schermoRuolo = null;          // lo schermo del primo o dell'ultimo, se tocca a me
let chiuse = new Set();           // prove che ho chiuso a mano con "OK"
let chiaveSpettatore = null;
// Finche' la prova e' aperta per i due protagonisti, lo schermo del telefono non si spegne.
const schermoAcceso = creaSchermoAcceso();

// contesto = { codicePartita, mioId }
export function inizializza(nuovoContesto) {
  contesto = nuovoContesto;
  caricaStile();
  costruisciOverlay();
  // "Il mio telefono sa fare la prova": senza questo il tabellone non la avvia
  // con me. Se la rete non risponde non succede nulla di grave.
  dichiaraCapacita(contesto.codicePartita, contesto.mioId).catch(() => {});
}

function costruisciOverlay() {
  if (overlay) return;
  overlay = crea('div', 'salmo-overlay salmo-tel');
  overlay.id = 'salmo-telefono';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  // Il minimo indispensabile e' scritto qui, cosi' la schermata copre tutto e
  // resta nascosta anche se il foglio di stile non si caricasse.
  overlay.style.cssText = 'position:fixed;inset:0;z-index:320;display:none;';
  segnaBeta(overlay);
  // Ogni tocco e' un'occasione per (ri)chiedere di tenere acceso lo schermo.
  overlay.addEventListener('click', () => schermoAcceso.riprova(), true);

  const scatola = crea('div', 'salmo-scatola');
  const intestazione = crea('div', 'salmo-intestazione');
  intestazione.appendChild(crea('h1', 'salmo-titolo', TITOLO));
  intestazione.appendChild(crea('p', 'salmo-versetto', VERSETTO));
  corpo = crea('div', 'salmo-corpo');
  scatola.append(intestazione, corpo);
  overlay.appendChild(scatola);
  document.body.appendChild(overlay);
}

function nome(stato, id) {
  const g = stato.giocatori && stato.giocatori[id];
  return g ? g.nome : '?';
}

function nascondi() {
  if (schermoRuolo) {
    try { schermoRuolo.ferma(); } catch (errore) { /* pazienza */ }
    schermoRuolo = null;
  }
  schermoAcceso.spegni();
  sidCorrente = null;
  chiaveSpettatore = null;
  if (overlay) {
    overlay.style.display = 'none';
    svuota(corpo);
  }
}

function chiudiQuesta(sid) {
  chiuse.add(sid);
  if (schermoRuolo) {
    try { schermoRuolo.ferma(); } catch (errore) { /* pazienza */ }
    schermoRuolo = null;
  }
  schermoAcceso.spegni();
  sidCorrente = null;
  overlay.style.display = 'none';
  svuota(corpo);
}

// Chi guarda soltanto: una schermata semplice e allegra.
function schermataSpettatore(s, dati) {
  const chiave = `${s.id}|${s.fase}|${s.esito || ''}`;
  if (chiave === chiaveSpettatore) return;
  chiaveSpettatore = chiave;
  svuota(corpo);
  const t = s.fase === 'esito' ? TESTI.altri.esito({ ...dati, spostamento: s.spostamento }) : TESTI.altri.corso(dati);
  const col = crea('div', 'salmo-colonna');
  col.appendChild(crea('h2', 'salmo-fase-titolo', t.titolo));
  col.appendChild(crea('p', 'salmo-testo', t.testo));
  corpo.appendChild(col);
}

// Restituisce true se la schermata della prova e' aperta in questo momento.
export function aggiorna(stato) {
  if (!contesto || !overlay) return false;
  const s = stato && stato.salmoInCorso;
  if (!s || typeof s !== 'object' || sessioneScaduta(s, oraServer()) || chiuse.has(s.id)) {
    if (sidCorrente !== null || overlay.style.display !== 'none') nascondi();
    return false;
  }

  const ruolo = ruoloDi(s, contesto.mioId);
  const dati = { ...s, primo: nome(stato, s.primoId), ultimo: nome(stato, s.ultimoId) };

  if (s.id !== sidCorrente) {
    // una prova nuova: ricomincio da zero
    if (schermoRuolo) { try { schermoRuolo.ferma(); } catch (errore) { /* pazienza */ } }
    schermoRuolo = null;
    chiaveSpettatore = null;
    svuota(corpo);
    sidCorrente = s.id;
    const alChiudere = () => chiudiQuesta(s.id);
    const base = { codicePartita: contesto.codicePartita, mioId: contesto.mioId, corpo, alChiudere };
    if (ruolo === 'primo') schermoRuolo = creaSchermoPrimo(base);
    else if (ruolo === 'ultimo') schermoRuolo = creaSchermoUltimo(base);
  }

  overlay.style.display = 'flex';
  if (schermoRuolo) schermoRuolo.aggiorna(s, dati);
  else schermataSpettatore(s, dati);
  // Solo i due protagonisti: chi guarda soltanto puo' lasciare che lo schermo si spenga.
  if (schermoRuolo) schermoAcceso.accendi();
  else schermoAcceso.spegni();
  return true;
}
