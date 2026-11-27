// protezione.js
// Salmo 133:1 — l'immagine "a torcia": sul telefono del primo il mosaico non
// compare mai tutto insieme. Resta coperto, e si vede solo il pezzetto
// illuminato vicino al dito (un po' piu' in alto, cosi' il dito non lo copre).
// Si muove il dito e la "torcia" segue.
//
// Perche': uno screenshot (o una foto) cattura solo il cerchio illuminato in
// quel momento, non l'immagine intera. Per copiarla tutta servirebbero tante
// foto mentre si tiene il dito premuto: in pochi secondi non conviene.
// In piu':
//   - con due o piu' dita (lo screenshot "a tre dita" di molti Android, il
//     palmo dei Samsung...) l'immagine si spegne subito;
//   - se la pagina perde il primo piano (si cambia app, si abbassa la tendina,
//     parte una registrazione dello schermo dal centro di controllo...) si spegne;
//   - sopra l'immagine e' stampato il nome di chi la guarda: una foto "rubata"
//     porta la firma;
//   - non si stampa, non si seleziona, non si trascina.
// Una pagina web non puo' vietare gli screenshot del tutto (solo le app
// installate possono): qui li rendiamo inutili.
//
// La geometria (dove va la torcia, quanto e' grande) e' in funzioni pure,
// provate da test-salmo-protezione.mjs senza browser.

import { crea, svuota } from './dom.js';
import { disegnaMosaico, disegnaSegnaposto } from './mosaico-ui.js';

// Quanto e' grande la torcia, rispetto a un riquadro: un po' piu' di mezzo
// riquadro di raggio = si vede bene un riquadro, appena un bordo dei vicini.
export const RAGGIO_PER_LATO = 0.72;
export const RAGGIO_MINIMO_PX = 34;
// Quanto sopra il dito sta il centro della torcia (con il dito, non con il mouse).
export const SOLLEVAMENTO_PER_LATO = 0.95;
export const SOLLEVAMENTO_MINIMO_PX = 56;
export const SOLLEVAMENTO_MASSIMO_PX = 120;
// Dopo un tocco con piu' dita l'immagine resta spenta almeno per tanto.
export const BLOCCO_MULTITOCCO_MS = 1500;

// lato: larghezza di un riquadro in pixel.
export function raggioTorcia(lato) {
  const l = Number(lato);
  if (!Number.isFinite(l) || l <= 0) return RAGGIO_MINIMO_PX;
  return Math.max(RAGGIO_MINIMO_PX, Math.round(l * RAGGIO_PER_LATO));
}

export function sollevamentoTorcia(lato, tipo) {
  if (tipo === 'mouse') return 0;
  const l = Number(lato);
  const base = Number.isFinite(l) && l > 0 ? l * SOLLEVAMENTO_PER_LATO : SOLLEVAMENTO_MINIMO_PX;
  return Math.round(Math.min(SOLLEVAMENTO_MASSIMO_PX, Math.max(SOLLEVAMENTO_MINIMO_PX, base)));
}

// Dove si accende la torcia, in coordinate dentro la griglia.
// punto: { x, y } del dito sullo schermo; rettangolo: quello della griglia
// (getBoundingClientRect); colonne: quante colonne ha il mosaico.
export function posizioneTorcia(punto, rettangolo, colonne, tipo) {
  const larghezza = Number(rettangolo && rettangolo.width) || 0;
  const n = Math.max(1, Number(colonne) || 1);
  const lato = larghezza / n;
  const x = Number(punto && punto.x) - (Number(rettangolo && rettangolo.left) || 0);
  const y = Number(punto && punto.y) - (Number(rettangolo && rettangolo.top) || 0) - sollevamentoTorcia(lato, tipo);
  return { x: Math.round(x), y: Math.round(y), r: raggioTorcia(lato) };
}

// Il testo della "firma" stampata sopra l'immagine.
export function testoFirma(nome) {
  const pulito = String(nome === undefined || nome === null ? '' : nome).replace(/\s+/g, ' ').trim().slice(0, 30);
  return pulito ? `${pulito} · COLLABORIAMO!` : 'COLLABORIAMO!';
}

// ---------- la vista sulla pagina ----------

// Crea il mosaico protetto e lo restituisce: { nodo, ferma }.
// "ferma" va chiamata quando lo schermo cambia, per togliere gli ascoltatori.
export function creaMosaicoProtetto({ tessere, righe, colonne, nome, aiuto }) {
  const radice = crea('div', 'salmo-protetta');
  radice.setAttribute('aria-label', 'Immagine da memorizzare: tieni il dito sopra e muovilo per vederla a pezzetti');

  const scena = crea('div', 'salmo-protetta-scena salmo-griglia');
  const copertura = crea('div', 'salmo-protetta-copertura');
  disegnaSegnaposto(copertura, righe, colonne, tessere.length);
  const vera = crea('div', 'salmo-protetta-vera');
  disegnaMosaico(vera, tessere, righe, colonne);
  const firma = crea('div', 'salmo-protetta-firma');
  const testo = testoFirma(nome);
  for (let i = 0; i < 7; i++) firma.appendChild(crea('span', '', `${testo}   ${testo}`));
  vera.appendChild(firma);
  scena.appendChild(copertura);
  scena.appendChild(vera);
  radice.appendChild(scena);

  const avviso = crea('p', 'salmo-protetta-aiuto', aiuto || '');
  radice.appendChild(avviso);
  const bloccoAvviso = crea('div', 'salmo-protetta-blocco nascosta', '✋ Un dito solo!');
  scena.appendChild(bloccoAvviso);

  const dita = new Set();
  let bloccatoFinoA = 0;
  let timerBlocco = null;
  let fermata = false;

  function spegni() {
    radice.classList.remove('salmo-protetta-accesa');
  }

  function accendiIn(evento) {
    if (fermata || Date.now() < bloccatoFinoA || dita.size > 1) { spegni(); return; }
    const p = posizioneTorcia({ x: evento.clientX, y: evento.clientY }, scena.getBoundingClientRect(), colonne, evento.pointerType);
    scena.style.setProperty('--torcia-x', `${p.x}px`);
    scena.style.setProperty('--torcia-y', `${p.y}px`);
    scena.style.setProperty('--torcia-r', `${p.r}px`);
    radice.classList.add('salmo-protetta-accesa');
  }

  function blocca() {
    spegni();
    bloccatoFinoA = Date.now() + BLOCCO_MULTITOCCO_MS;
    bloccoAvviso.classList.remove('nascosta');
    if (timerBlocco) clearTimeout(timerBlocco);
    timerBlocco = setTimeout(() => { bloccoAvviso.classList.add('nascosta'); }, BLOCCO_MULTITOCCO_MS);
  }

  const giu = evento => {
    if (evento.pointerType !== 'mouse') dita.add(evento.pointerId);
    if (dita.size > 1) { blocca(); return; }
    try { radice.setPointerCapture(evento.pointerId); } catch (errore) { /* pazienza */ }
    evento.preventDefault();
    accendiIn(evento);
  };
  const muovi = evento => {
    if (evento.pointerType === 'mouse' || dita.has(evento.pointerId)) accendiIn(evento);
  };
  const su = evento => {
    dita.delete(evento.pointerId);
    if (evento.pointerType !== 'mouse' || evento.type === 'pointerleave') spegni();
  };
  // Il tocco "classico": serve per contare le dita anche dove i pointer events arrivano a meta'.
  const tocco = evento => { if (evento.touches && evento.touches.length > 1) blocca(); };
  const nonQui = evento => evento.preventDefault();
  const visibilita = () => { if (document.visibilityState !== 'visible') { dita.clear(); spegni(); } };
  const finestraVia = () => { dita.clear(); spegni(); };
  const tasto = evento => {
    if (evento.key === 'PrintScreen' || evento.key === 'Snapshot') blocca();
  };

  radice.addEventListener('pointerdown', giu);
  radice.addEventListener('pointermove', muovi);
  radice.addEventListener('pointerup', su);
  radice.addEventListener('pointercancel', su);
  radice.addEventListener('pointerleave', su);
  radice.addEventListener('touchstart', tocco, { passive: true });
  radice.addEventListener('contextmenu', nonQui);
  radice.addEventListener('dragstart', nonQui);
  radice.addEventListener('selectstart', nonQui);
  document.addEventListener('visibilitychange', visibilita);
  window.addEventListener('blur', finestraVia);
  window.addEventListener('pagehide', finestraVia);
  window.addEventListener('beforeprint', finestraVia);
  window.addEventListener('keydown', tasto);
  window.addEventListener('keyup', tasto);

  function ferma() {
    if (fermata) return;
    fermata = true;
    spegni();
    if (timerBlocco) clearTimeout(timerBlocco);
    document.removeEventListener('visibilitychange', visibilita);
    window.removeEventListener('blur', finestraVia);
    window.removeEventListener('pagehide', finestraVia);
    window.removeEventListener('beforeprint', finestraVia);
    window.removeEventListener('keydown', tasto);
    window.removeEventListener('keyup', tasto);
    svuota(vera);
  }

  return { nodo: radice, ferma };
}
