// schermo-primo.js
// Salmo 133:1 — lo schermo del telefono di chi e' in testa ("il primo"): vede
// l'immagine per pochi secondi, poi la descrive a voce a chi e' rimasto
// indietro. Durante la prova puo' "sbirciare" di nuovo UNA volta sola.
//
// L'immagine compare solo qui, sul telefono del primo: mai sul tabellone, mai
// sugli altri telefoni.

import { crea, svuota, avviaConto, pausa, memoriaLeggi, memoriaScrivi } from './dom.js';
import { disegnaMosaico } from './mosaico-ui.js';
import { comeElenco } from './sessione.js';
import { telefono as TESTI, CHIUDI } from './testi.js';
import { leggiSegreto, inviaPronto, inviaSbirciata, leggiRisposte } from './rete-salmo.js';
import { oraServer } from '../sincronizzazione.js';

export function creaSchermoPrimo({ codicePartita, mioId, corpo, alChiudere }) {
  let sid = null;
  let fermato = false;

  let caricamento = 'attesa';       // 'attesa' | 'in-corso' | 'ok' | 'errore'
  let tessere = null;               // l'immagine giusta, nell'ordine giusto
  let pronto = false;
  let invioPronto = false;
  let sbirciataUsata = false;
  let sbirciataControllata = false;
  let sbirciandoFinoA = 0;          // istante (ora del server) in cui finisce la sbirciata in corso

  let ultimaS = null;
  let ultimiDati = null;
  let fermaConto = null;
  let timerSbirciata = null;
  let chiaveUltima = null;

  const chiaveSbirciata = () => `salmo-sbirciata-${sid}`;

  function fermaTimer() {
    if (fermaConto) fermaConto();
    fermaConto = null;
    if (timerSbirciata) clearTimeout(timerSbirciata);
    timerSbirciata = null;
  }

  // ---------- caricare l'immagine (con qualche tentativo) ----------

  async function caricaImmagine(s) {
    if (caricamento === 'in-corso' || caricamento === 'ok') return;
    caricamento = 'in-corso';
    const miaSessione = s.id;
    for (let giro = 0; giro < 40 && !fermato && sid === miaSessione; giro++) {
      try {
        const segreto = await leggiSegreto(codicePartita, 'primo');
        const lista = segreto && segreto.sid === miaSessione ? comeElenco(segreto.tessere) : null;
        if (lista && lista.length === s.riquadri) {
          tessere = lista;
          caricamento = 'ok';
          if (!fermato && sid === miaSessione) disegna();
          return;
        }
      } catch (errore) { /* riprovo tra poco */ }
      if (giro >= 1 && sid === miaSessione && caricamento !== 'errore') {
        caricamento = 'errore';
        disegna();
      }
      await pausa(1500);
    }
    if (sid === miaSessione && caricamento !== 'ok') {
      caricamento = 'errore';
      disegna();
    }
  }

  // Dopo una ricarica della pagina: la sbirciata era gia' stata usata?
  async function controllaSbirciata(s) {
    if (sbirciataControllata) return;
    sbirciataControllata = true;
    if (memoriaLeggi(chiaveSbirciata()) === '1') { sbirciataUsata = true; return; }
    try {
      const risposte = await leggiRisposte(codicePartita, s.id);
      if (risposte && risposte.sbirciata === true && sid === s.id) {
        sbirciataUsata = true;
        if (!fermato) disegna();
      }
    } catch (errore) { /* pazienza: al massimo se ne concede una in piu' */ }
  }

  // ---------- azioni del primo ----------

  async function premiPronto() {
    if (pronto || invioPronto || caricamento !== 'ok') return;
    invioPronto = true;
    pronto = true;
    disegna();
    try {
      await inviaPronto(codicePartita, sid, mioId);
    } catch (errore) {
      pronto = false;
    }
    invioPronto = false;
    if (!fermato) disegna();
  }

  function sbircia() {
    if (sbirciataUsata || caricamento !== 'ok' || !ultimaS || ultimaS.fase !== 'prova') return;
    sbirciataUsata = true;
    memoriaScrivi(chiaveSbirciata(), '1');
    sbirciandoFinoA = oraServer() + (ultimaS.sbirciataMs || 10000);
    inviaSbirciata(codicePartita, sid).catch(() => {});
    disegna();
  }

  // ---------- disegnare lo schermo ----------

  function disegna() {
    if (fermato || !ultimaS) return;
    const s = ultimaS;
    const dati = ultimiDati;
    fermaTimer();
    svuota(corpo);

    if (s.fase === 'pronti') disegnaPronti(s, dati);
    else if (s.fase === 'anteprima') disegnaAnteprima(s, dati);
    else if (s.fase === 'prova') disegnaProva(s, dati);
    else disegnaEsito(s, dati);
  }

  function disegnaPronti(s, dati) {
    const t = TESTI.primo.pronti(dati);
    const col = crea('div', 'salmo-colonna');
    col.appendChild(crea('h2', 'salmo-fase-titolo', t.titolo));
    col.appendChild(crea('p', 'salmo-testo', t.testo));
    const bottone = crea('button', 'salmo-bottone', pronto ? '✅' : t.bottone);
    bottone.type = 'button';
    bottone.disabled = pronto || caricamento !== 'ok';
    bottone.addEventListener('click', premiPronto);
    col.appendChild(bottone);
    let stato = '';
    if (pronto) stato = t.dopo;
    else if (caricamento === 'errore') stato = t.errore;
    else if (caricamento !== 'ok') stato = t.caricamento;
    col.appendChild(crea('p', 'salmo-stato', stato));
    const conto = crea('p', 'salmo-conto-piccolo');
    col.appendChild(conto);
    corpo.appendChild(col);
    fermaConto = avviaConto(sec => { conto.textContent = `⏳ ${sec}s`; }, s.scadenza, oraServer);
  }

  // L'immagine e' visibile solo finche' non scade la scadenza: anche se la
  // fase successiva tardasse ad arrivare, lo schermo la nasconde da solo.
  function disegnaAnteprima(s, dati) {
    const t = TESTI.primo.anteprima(dati);
    const col = crea('div', 'salmo-colonna salmo-colonna-prova');
    col.appendChild(crea('h2', 'salmo-fase-titolo', t.titolo));
    const conto = crea('div', 'salmo-conto-prova');
    col.appendChild(conto);
    const griglia = crea('div', 'salmo-griglia');
    col.appendChild(griglia);
    corpo.appendChild(col);

    const mostra = () => {
      if (caricamento === 'ok' && tessere && oraServer() < s.scadenza) {
        if (!griglia.firstChild) disegnaMosaico(griglia, tessere, s.righe, s.colonne);
      } else {
        svuota(griglia);
      }
    };
    mostra();
    fermaConto = avviaConto(sec => {
      conto.textContent = t.conto(sec);
      conto.classList.toggle('salmo-urgente', sec <= 5);
      if (sec <= 0) mostra();
    }, s.scadenza, oraServer);
  }

  function disegnaProva(s, dati) {
    const t = TESTI.primo.prova(dati);
    const col = crea('div', 'salmo-colonna salmo-colonna-prova');
    col.appendChild(crea('h2', 'salmo-fase-titolo', t.titolo));
    const conto = crea('div', 'salmo-conto-prova');
    col.appendChild(conto);

    const sbirciando = sbirciandoFinoA > oraServer() && caricamento === 'ok' && tessere;
    if (sbirciando) {
      col.appendChild(crea('p', 'salmo-stato', t.sbirciando));
      const griglia = crea('div', 'salmo-griglia');
      disegnaMosaico(griglia, tessere, s.righe, s.colonne);
      col.appendChild(griglia);
      const contoSbirciata = crea('p', 'salmo-conto-piccolo');
      col.appendChild(contoSbirciata);
      // quando la sbirciata finisce, torna lo schermo normale
      timerSbirciata = setTimeout(() => { sbirciandoFinoA = 0; disegna(); }, Math.max(0, sbirciandoFinoA - oraServer()) + 50);
      corpo.appendChild(col);
      fermaConto = avviaConto(sec => {
        conto.textContent = t.conto(Math.max(0, Math.ceil((s.scadenza - oraServer()) / 1000)));
        contoSbirciata.textContent = `👀 ${sec}s`;
      }, sbirciandoFinoA, oraServer);
      return;
    }

    col.appendChild(crea('p', 'salmo-testo', t.testo));
    const bottone = crea('button', 'salmo-bottone salmo-bottone-secondario', sbirciataUsata ? t.sbirciataFinita : t.sbircia);
    bottone.type = 'button';
    bottone.disabled = sbirciataUsata || caricamento !== 'ok';
    bottone.addEventListener('click', sbircia);
    col.appendChild(bottone);
    corpo.appendChild(col);
    fermaConto = avviaConto(sec => {
      conto.textContent = t.conto(sec);
      conto.classList.toggle('salmo-urgente', sec <= 10);
    }, s.scadenza, oraServer);
  }

  function disegnaEsito(s, dati) {
    const t = TESTI.primo.esito({ ...dati, spostamento: s.spostamento });
    const col = crea('div', 'salmo-colonna salmo-esito ' + (s.esito === 'successo' ? 'salmo-esito-successo' : (s.esito === 'fallimento' ? 'salmo-esito-fallimento' : 'salmo-esito-annullato')));
    col.appendChild(crea('h2', 'salmo-fase-titolo', t.titolo));
    col.appendChild(crea('p', 'salmo-testo', t.testo));
    const chiudi = crea('button', 'salmo-bottone', CHIUDI);
    chiudi.type = 'button';
    chiudi.addEventListener('click', () => { if (alChiudere) alChiudere(); });
    col.appendChild(chiudi);
    corpo.appendChild(col);
  }

  // ---------- da fuori ----------

  return {
    aggiorna(s, dati) {
      if (fermato) return;
      const nuovaSessione = s.id !== sid;
      if (nuovaSessione) {
        sid = s.id;
        caricamento = 'attesa'; tessere = null; pronto = false; invioPronto = false;
        sbirciataUsata = false; sbirciataControllata = false; sbirciandoFinoA = 0;
      }
      ultimaS = s;
      ultimiDati = dati;

      if (caricamento === 'attesa') caricaImmagine(s);
      if (s.fase === 'prova') controllaSbirciata(s);

      const chiave = `${s.fase}|${caricamento}|${s.esito || ''}`;
      if (nuovaSessione || chiave !== chiaveUltima) {
        chiaveUltima = chiave;
        disegna();
      }
    },
    ferma() {
      fermato = true;
      fermaTimer();
    }
  };
}
