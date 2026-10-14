// schermo-ultimo.js
// Salmo 133:1 — lo schermo del telefono di chi e' rimasto indietro ("l'ultimo"):
// e' lui che rimette i riquadri nell'ordine giusto, toccandone due per
// scambiarli. Qui NON arriva mai la soluzione, solo i riquadri mescolati.
//
// Il telefono non decide nulla: manda soltanto cio' che l'ultimo ha fatto
// ("sono pronto", "ho finito + quest'ordine") e il tabellone controlla.

import { crea, svuota, avviaConto, pausa, memoriaLeggi, memoriaScrivi } from './dom.js';
import { disegnaMosaico } from './mosaico-ui.js';
import { scambia, ordineValido } from './mosaico.js';
import { comeElenco } from './sessione.js';
import { telefono as TESTI, IMMAGINE_GIUSTA, CHIUDI } from './testi.js';
import { leggiSegreto, inviaPronto, inviaConsegna } from './rete-salmo.js';
import { oraServer } from '../sincronizzazione.js';

// Se dopo "Ho finito" il verdetto non arriva entro questo tempo, il bottone
// si riabilita (la consegna potrebbe essersi persa per strada).
const SBLOCCO_CONTROLLO_MS = 10000;

export function creaSchermoUltimo({ codicePartita, mioId, corpo, alChiudere }) {
  let sid = null;
  let fermato = false;

  let caricamento = 'attesa';       // 'attesa' | 'in-corso' | 'ok' | 'errore'
  let mescolata = null;
  let ordine = null;
  let selezionata = -1;
  let evidenzia = null;
  let pronto = false;
  let invioPronto = false;
  let controllo = false;            // true = ho consegnato, aspetto il verdetto
  let messaggio = '';
  let tentativoLocale = 0;          // quanti tentativi sbagliati ho visto dal tabellone
  const consegnati = {};            // tentativo -> true se gia' consegnato

  let ultimaS = null;
  let ultimiDati = null;
  let fermaConto = null;
  const rif = {};                   // riferimenti agli elementi che cambiano spesso

  const chiaveOrdine = () => `salmo-ordine-${sid}`;

  function salvaOrdine() {
    if (ordine) memoriaScrivi(chiaveOrdine(), JSON.stringify(ordine));
  }

  function ordineIniziale(lista) {
    try {
      const salvato = JSON.parse(memoriaLeggi(chiaveOrdine()) || 'null');
      if (Array.isArray(salvato) && ordineValido(salvato, lista)) return salvato;
    } catch (errore) { /* uso quello di partenza */ }
    return [...lista];
  }

  // ---------- caricare i riquadri (con qualche tentativo) ----------

  async function caricaRiquadri(s) {
    if (caricamento === 'in-corso' || caricamento === 'ok') return;
    caricamento = 'in-corso';
    const miaSessione = s.id;
    for (let giro = 0; giro < 40 && !fermato && sid === miaSessione; giro++) {
      try {
        const segreto = await leggiSegreto(codicePartita, 'ultimo');
        const lista = segreto && segreto.sid === miaSessione ? comeElenco(segreto.mescolata) : null;
        if (lista && lista.length === s.riquadri) {
          mescolata = lista;
          ordine = ordineIniziale(lista);
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

  // ---------- azioni dell'ultimo ----------

  async function premiPronto() {
    if (pronto || invioPronto || caricamento !== 'ok') return;
    invioPronto = true;
    pronto = true;                  // subito, cosi' non si preme due volte
    disegna();
    try {
      await inviaPronto(codicePartita, sid, mioId);
    } catch (errore) {
      pronto = false;               // la rete non ha risposto: si puo' riprovare
    }
    invioPronto = false;
    if (!fermato) disegna();
  }

  function tocco(i) {
    if (controllo || !ordine) return;
    if (selezionata === -1) {
      selezionata = i;
    } else if (selezionata === i) {
      selezionata = -1;
    } else {
      ordine = scambia(ordine, selezionata, i);
      evidenzia = [selezionata, i];
      selezionata = -1;
      messaggio = '';
      salvaOrdine();
      try { if (navigator.vibrate) navigator.vibrate(25); } catch (errore) { /* pazienza */ }
    }
    ridisegnaGriglia();
    if (rif.messaggio) rif.messaggio.textContent = messaggio;
  }

  async function consegna(automatica) {
    if (!ordine || !ultimaS || ultimaS.fase !== 'prova') return;
    const indice = tentativoLocale;
    if (consegnati[indice]) return;
    consegnati[indice] = true;
    controllo = true;
    selezionata = -1;
    const t = TESTI.ultimo.prova(ultimiDati);
    messaggio = automatica ? t.tempoScaduto : '';
    disegna();
    try {
      await inviaConsegna(codicePartita, sid, indice, ordine, automatica);
    } catch (errore) { /* ci pensa lo sblocco qui sotto */ }
    setTimeout(() => {
      // Nessuna risposta del tabellone: si puo' riprovare (a meno che sia finito il tempo).
      if (!fermato && controllo && tentativoLocale === indice && !automatica) {
        controllo = false;
        consegnati[indice] = false;
        disegna();
      }
    }, SBLOCCO_CONTROLLO_MS);
  }

  // ---------- disegnare lo schermo ----------

  function ridisegnaGriglia() {
    if (!rif.griglia || !ordine || !ultimaS) return;
    disegnaMosaico(rif.griglia, ordine, ultimaS.righe, ultimaS.colonne, {
      selezionata, evidenzia, bloccato: controllo, alTocco: tocco
    });
    evidenzia = null;
  }

  function fermaTimer() {
    if (fermaConto) fermaConto();
    fermaConto = null;
  }

  function disegna() {
    if (fermato || !ultimaS) return;
    const s = ultimaS;
    const dati = ultimiDati;
    fermaTimer();
    svuota(corpo);
    rif.griglia = null;
    rif.messaggio = null;

    if (s.fase === 'pronti') disegnaPronti(s, dati);
    else if (s.fase === 'anteprima') disegnaAnteprima(s, dati);
    else if (s.fase === 'prova') disegnaProva(s, dati);
    else disegnaEsito(s, dati);
  }

  function disegnaPronti(s, dati) {
    const t = TESTI.ultimo.pronti(dati);
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

  function disegnaAnteprima(s, dati) {
    const t = TESTI.ultimo.anteprima(dati);
    const col = crea('div', 'salmo-colonna');
    col.appendChild(crea('h2', 'salmo-fase-titolo', t.titolo));
    col.appendChild(crea('p', 'salmo-testo', t.testo));
    const conto = crea('div', 'salmo-conto-grande');
    col.appendChild(conto);
    corpo.appendChild(col);
    fermaConto = avviaConto(sec => { conto.textContent = t.conto(sec); }, s.scadenza, oraServer);
  }

  function disegnaProva(s, dati) {
    const t = TESTI.ultimo.prova(dati);
    const col = crea('div', 'salmo-colonna salmo-colonna-prova');

    const testata = crea('div', 'salmo-testata-prova');
    testata.appendChild(crea('span', 'salmo-tentativo', t.tentativo(s.tentativiFatti || 0, s.tentativiMax || 1)));
    const conto = crea('span', 'salmo-conto-prova');
    testata.appendChild(conto);
    col.appendChild(testata);

    if (caricamento !== 'ok' || !ordine) {
      col.appendChild(crea('p', 'salmo-testo', caricamento === 'errore' ? TESTI.ultimo.pronti(dati).errore : TESTI.ultimo.pronti(dati).caricamento));
      corpo.appendChild(col);
      fermaConto = avviaConto(sec => { conto.textContent = t.conto(sec); }, s.scadenza, oraServer);
      return;
    }

    col.appendChild(crea('p', 'salmo-suggerimento', t.suggerimento));
    const griglia = crea('div', 'salmo-griglia');
    col.appendChild(griglia);
    rif.griglia = griglia;

    const msg = crea('p', 'salmo-messaggio', messaggio);
    col.appendChild(msg);
    rif.messaggio = msg;

    const bottone = crea('button', 'salmo-bottone', controllo ? t.controllo : t.bottone);
    bottone.type = 'button';
    bottone.disabled = controllo;
    bottone.addEventListener('click', () => consegna(false));
    col.appendChild(bottone);

    corpo.appendChild(col);
    ridisegnaGriglia();
    fermaConto = avviaConto(
      sec => { conto.textContent = t.conto(sec); conto.classList.toggle('salmo-urgente', sec <= 10); },
      s.scadenza, oraServer,
      () => consegna(true)             // tempo scaduto: consegno quello che ho
    );
  }

  function disegnaEsito(s, dati) {
    const t = TESTI.ultimo.esito({ ...dati, spostamento: s.spostamento });
    const col = crea('div', 'salmo-colonna salmo-esito ' + (s.esito === 'successo' ? 'salmo-esito-successo' : (s.esito === 'fallimento' ? 'salmo-esito-fallimento' : 'salmo-esito-annullato')));
    col.appendChild(crea('h2', 'salmo-fase-titolo', t.titolo));
    col.appendChild(crea('p', 'salmo-testo', t.testo));
    const sol = comeElenco(s.soluzione);
    if (s.esito !== 'annullato' && sol && sol.length === s.riquadri) {
      col.appendChild(crea('p', 'salmo-stato', IMMAGINE_GIUSTA));
      const piccola = crea('div', 'salmo-griglia salmo-griglia-piccola');
      disegnaMosaico(piccola, sol, s.righe, s.colonne);
      col.appendChild(piccola);
    }
    const chiudi = crea('button', 'salmo-bottone', CHIUDI);
    chiudi.type = 'button';
    chiudi.addEventListener('click', () => { if (alChiudere) alChiudere(); });
    col.appendChild(chiudi);
    corpo.appendChild(col);
  }

  // ---------- da fuori ----------

  return {
    // Chiamata a ogni nuovo stato della partita che contiene questa prova.
    aggiorna(s, dati) {
      if (fermato) return;
      const nuovaSessione = s.id !== sid;
      if (nuovaSessione) {
        sid = s.id;
        caricamento = 'attesa'; mescolata = null; ordine = null; selezionata = -1;
        pronto = false; invioPronto = false; controllo = false; messaggio = '';
        tentativoLocale = 0;
        Object.keys(consegnati).forEach(k => delete consegnati[k]);
      }
      ultimaS = s;
      ultimiDati = dati;

      // Il tabellone ha contato un tentativo sbagliato in piu': sblocco e avviso.
      const fatti = s.tentativiFatti || 0;
      const nuovoSbagliato = fatti > tentativoLocale;
      if (nuovoSbagliato) {
        tentativoLocale = fatti;
        controllo = false;
        const restano = (s.tentativiMax || 1) - fatti;
        messaggio = restano > 0 ? TESTI.ultimo.prova(dati).sbagliato(restano) : '';
      }

      if (caricamento === 'attesa') caricaRiquadri(s);

      // Ridisegno tutto solo quando cambia qualcosa che conta.
      const chiave = `${s.fase}|${fatti}|${caricamento}|${s.esito || ''}`;
      if (nuovaSessione || chiave !== rif.chiave || nuovoSbagliato) {
        rif.chiave = chiave;
        disegna();
      }
    },
    ferma() {
      fermato = true;
      fermaTimer();
    }
  };
}
