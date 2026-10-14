// tabellone-salmo-ui.js
// Salmo 133:1 — la schermata di COLLABORIAMO! sul tabellone (la TV).
//
// REGOLA: il tabellone non mostra MAI l'immagine, ne' le posizioni giuste.
// Qui dentro non arriva nemmeno: l'orchestratore non passa la soluzione allo
// schermo, e per far vedere "un mosaico" si usa solo il segnaposto con i
// punti interrogativi.
//
// Interfaccia verso l'orchestratore (vedi orchestratore.js):
//   mostra(vista)  nascondi()  suono(nome)  abbassaMusica()  ripristinaMusica()  anima(spostamenti)

import { crea, svuota, caricaStile, secondiRimasti } from './dom.js';
import { disegnaSegnaposto } from './mosaico-ui.js';
import { TITOLO, VERSETTO, tabellone as TESTI, secondi } from './testi.js';
import { oraServer } from '../sincronizzazione.js';
import { riproduciEffetto, abbassaMusica, ripristinaMusica } from '../audio-ui.js';

export function creaInterfacciaTabellone({ animaSpostamento }) {
  caricaStile();

  const overlay = crea('div', 'salmo-overlay salmo-tv');
  overlay.id = 'salmo-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-live', 'polite');
  // Il minimo indispensabile e' scritto qui, cosi' la schermata copre tutto e
  // resta nascosta anche se il foglio di stile non si caricasse.
  overlay.style.cssText = 'position:fixed;inset:0;z-index:240;display:none;';

  const scatola = crea('div', 'salmo-scatola');
  const intestazione = crea('div', 'salmo-intestazione');
  intestazione.appendChild(crea('h1', 'salmo-titolo', TITOLO));
  intestazione.appendChild(crea('p', 'salmo-versetto', VERSETTO));
  const corpo = crea('div', 'salmo-corpo');
  const barra = crea('div', 'salmo-barra');
  const riempimento = crea('div', 'salmo-barra-riempimento');
  barra.appendChild(riempimento);

  scatola.append(intestazione, corpo, barra);
  overlay.appendChild(scatola);
  document.body.appendChild(overlay);

  let ticker = null;
  let scadenzaCorrente = null;
  let durataIniziale = 1;

  function aggiornaConti() {
    const restanti = secondiRimasti(scadenzaCorrente, oraServer());
    overlay.querySelectorAll('[data-conto]').forEach(el => {
      el.textContent = el.dataset.conto === 'esteso' ? `Tempo per prepararsi: ${secondi(restanti * 1000)}` : String(restanti);
    });
    const frazione = Math.max(0, Math.min(1, (scadenzaCorrente - oraServer()) / durataIniziale));
    riempimento.style.width = `${(frazione * 100).toFixed(1)}%`;
    scatola.classList.toggle('salmo-urgente', restanti <= 10 && frazione < 1);
  }

  function fermaTicker() {
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
  }

  function impostaScadenza(scadenza) {
    if (scadenza === scadenzaCorrente && ticker !== null) return;
    fermaTicker();
    scadenzaCorrente = Number.isFinite(scadenza) ? scadenza : null;
    if (scadenzaCorrente === null) {
      barra.style.visibility = 'hidden';
      return;
    }
    barra.style.visibility = 'visible';
    durataIniziale = Math.max(1, scadenzaCorrente - oraServer());
    ticker = setInterval(aggiornaConti, 250);
  }

  // Rete di sicurezza per lo schermo: le misure sono gia' proporzionali, ma con nomi
  // lunghissimi (o una finestra strana) il contenuto potrebbe non starci. In quel caso
  // lo si rimpicciolisce a piccoli passi, finche' entra tutto.
  function adattaAlloSchermo() {
    try {
      let scala = 1;
      scatola.style.setProperty('--salmo-scala', '1');
      for (let passo = 0; passo < 12; passo++) {
        const sta = corpo.scrollHeight <= corpo.clientHeight + 1 && corpo.scrollWidth <= corpo.clientWidth + 1;
        if (sta) return;
        scala = Math.round((scala - 0.06) * 100) / 100;
        if (scala < 0.4) return;
        scatola.style.setProperty('--salmo-scala', String(scala));
      }
    } catch (errore) { /* pazienza: resta com'e' */ }
  }

  // ---------- le schermate di ogni fase ----------

  function schermataPronti(p) {
    const a = TESTI.annuncio(p);
    const stato = TESTI.statoPronti(p);
    const colonna = crea('div', 'salmo-colonna');
    a.righe.forEach(r => colonna.appendChild(crea('p', 'salmo-riga-grande', r)));
    colonna.appendChild(crea('p', 'salmo-testo', a.come));
    colonna.appendChild(crea('p', 'salmo-testo', a.poste));

    const pronti = crea('div', 'salmo-pronti');
    pronti.appendChild(crea('div', 'salmo-pronto-voce' + (p.primoPronto ? ' salmo-pronto-si' : ''), stato.primo));
    pronti.appendChild(crea('div', 'salmo-pronto-voce' + (p.ultimoPronto ? ' salmo-pronto-si' : ''), stato.ultimo));
    colonna.appendChild(pronti);

    colonna.appendChild(crea('p', 'salmo-invito', a.invito));
    const conto = crea('p', 'salmo-conto-piccolo');
    conto.dataset.conto = 'esteso';
    colonna.appendChild(conto);
    return colonna;
  }

  function schermataConConto(testi, p, conSegnaposto = true) {
    const colonna = crea('div', 'salmo-colonna');
    colonna.appendChild(crea('h2', 'salmo-fase-titolo', testi.titolo));
    colonna.appendChild(crea('p', 'salmo-testo', testi.sotto));
    const conto = crea('div', 'salmo-conto-grande');
    conto.dataset.conto = 'numero';
    colonna.appendChild(conto);
    if (p.fase === 'prova') {
      colonna.appendChild(crea('p', 'salmo-tentativo', TESTI.tentativo(p.tentativiFatti || 0, p.tentativiMax || 1)));
    }
    if (conSegnaposto) {
      const griglia = crea('div', 'salmo-segnaposto' + (p.riquadri > 0 && p.riquadri <= 6 ? ' salmo-segnaposto-pochi' : ''));
      disegnaSegnaposto(griglia, p.righe || 4, p.colonne || 4, p.riquadri > 0 ? p.riquadri : undefined);
      colonna.appendChild(griglia);
    }
    return colonna;
  }

  function schermataEsito(p) {
    const colonna = crea('div', 'salmo-colonna salmo-esito');
    let testi;
    if (p.esito === 'successo') {
      testi = TESTI.successo(p);
      colonna.classList.add('salmo-esito-successo');
    } else if (p.esito === 'fallimento') {
      testi = TESTI.fallimento(p);
      colonna.classList.add('salmo-esito-fallimento');
    } else {
      testi = TESTI.annullato();
      colonna.classList.add('salmo-esito-annullato');
    }
    colonna.appendChild(crea('h2', 'salmo-fase-titolo', testi.titolo));
    colonna.appendChild(crea('p', 'salmo-riga-grande', testi.testo));
    return colonna;
  }

  // ---------- l'interfaccia vera e propria ----------

  return {
    mostra(vista) {
      const p = { ...vista, primo: vista.primoNome, ultimo: vista.ultimoNome };
      svuota(corpo);
      if (p.fase === 'pronti') corpo.appendChild(schermataPronti(p));
      else if (p.fase === 'anteprima') corpo.appendChild(schermataConConto(TESTI.anteprima(p), p));
      else if (p.fase === 'prova') corpo.appendChild(schermataConConto(TESTI.prova(p), p));
      else corpo.appendChild(schermataEsito(p));

      overlay.style.display = 'flex';
      impostaScadenza(p.scadenza);
      if (scadenzaCorrente !== null) aggiornaConti();
      // per ultimo: prima devono esserci anche i numeri dei conti alla rovescia
      adattaAlloSchermo();
    },

    nascondi() {
      fermaTicker();
      scadenzaCorrente = null;
      overlay.style.display = 'none';
      svuota(corpo);
    },

    suono(nome) { riproduciEffetto(nome); },
    abbassaMusica,
    ripristinaMusica,

    // Una targhetta fissa, in alto a sinistra (sotto "BETA", dove non copre niente): ricorda
    // a chi guarda la TV che COLLABORIAMO! sta usando i valori PER PROVARE (non quelli di una
    // serata vera).
    mostraEtichettaProva() {
      if (document.getElementById('salmo-etichetta-prova')) return;
      const etichetta = crea('div', 'salmo-etichetta-prova', TESTI.etichettaProva);
      etichetta.id = 'salmo-etichetta-prova';
      etichetta.style.cssText = 'position:fixed;left:6px;top:36px;z-index:4999;pointer-events:none;';
      document.body.appendChild(etichetta);
    },

    // Muove le pedine come in ogni altro movimento del gioco, una dopo l'altra.
    async anima(spostamenti) {
      for (const s of spostamenti) await animaSpostamento(s.id, s.da, s.a);
    }
  };
}
