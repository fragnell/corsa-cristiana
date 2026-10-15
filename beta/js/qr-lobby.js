// qr-lobby.js
// Il QR della lobby: sta sul tabellone, in alto a sinistra della tavola. Inquadrandolo, il telefono
// si apre su giocatore.html con il codice della partita gia' scritto (vedi link-partita.js).
//
// E' un disegno (SVG) creato qui, nel browser, a ogni partita: niente immagini fisse e niente servizi
// esterni. Chi calcola i quadratini e' una libreria che sta in vendor/ (vedi vendor/LEGGIMI.txt).
// Questo modulo si carica "a parte" (vedi tabellone-ui.js): se non si carica la lobby funziona come
// sempre, con il codice scritto in grande.

import qrcode from './vendor/qrcode.mjs';
import { indirizzoPerEntrare } from './link-partita.js';

const MARGINE_QUADRATINI = 4;      // il bordo bianco attorno al QR: 4 quadratini e' quanto chiede lo standard
const SVG_NS = 'http://www.w3.org/2000/svg';

// Calcola il disegno. 'dimensione' e' il lato in quadratini (compreso il bordo bianco); 'tracciato' sono
// i quadratini scuri scritti come righe di un disegno SVG (un tratto per ogni fila continua di quadratini).
export function disegnoQr(testo) {
  const qr = qrcode(0, 'M');       // 0 = la dimensione piu' piccola che basta; 'M' = si legge anche con qualche riflesso
  qr.addData(testo, 'Byte');
  qr.make();
  const lato = qr.getModuleCount();
  const tratti = [];
  for (let riga = 0; riga < lato; riga++) {
    let colonna = 0;
    while (colonna < lato) {
      if (!qr.isDark(riga, colonna)) { colonna++; continue; }
      const inizio = colonna;
      while (colonna < lato && qr.isDark(riga, colonna)) colonna++;
      const lunghezza = colonna - inizio;
      tratti.push(`M${inizio + MARGINE_QUADRATINI} ${riga + MARGINE_QUADRATINI}h${lunghezza}v1h-${lunghezza}z`);
    }
  }
  return { dimensione: lato + MARGINE_QUADRATINI * 2, tracciato: tratti.join('') };
}

// Costruisce l'elemento <svg> pronto da mettere nella pagina.
export function creaSvgQr(testo, descrizione, documento = document) {
  const { dimensione, tracciato } = disegnoQr(testo);
  const svg = documento.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${dimensione} ${dimensione}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', descrizione);

  const sfondo = documento.createElementNS(SVG_NS, 'rect');
  sfondo.setAttribute('width', dimensione);
  sfondo.setAttribute('height', dimensione);
  sfondo.setAttribute('fill', '#ffffff');

  const quadratini = documento.createElementNS(SVG_NS, 'path');
  quadratini.setAttribute('d', tracciato);
  quadratini.setAttribute('fill', '#000000');

  svg.append(sfondo, quadratini);
  return svg;
}

// Disegna il QR nel riquadro della lobby (tabellone.html: #lobby-qr) e lo mostra.
export function mostraQrLobby(codice, { pagina = location.href, documento = document } = {}) {
  const riquadro = documento.getElementById('lobby-qr');
  const immagine = documento.getElementById('lobby-qr-immagine');
  if (!riquadro || !immagine) return false;

  const indirizzo = indirizzoPerEntrare(codice, pagina);
  immagine.replaceChildren(creaSvgQr(indirizzo, `QR per entrare nella partita ${codice}`, documento));
  riquadro.dataset.indirizzo = indirizzo;   // cosa c'e' scritto nel QR (serve a controllare, e alle prove)
  riquadro.classList.remove('nascosta');
  return true;
}
