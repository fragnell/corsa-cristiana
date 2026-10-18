// admin-attivita.js
// Il riquadro "Quanto si gioca" della scheda Statistiche dell'Admin: le partite di oggi, degli ultimi
// 7 e degli ultimi 30 giorni, quando si e' giocato l'ultima volta, un grafico giorno per giorno e i
// totali dall'inizio. In alto, una riga dice se in questo momento c'e' un tabellone aperto.
//
// I numeri si ricostruiscono dalle partite salvate nel database (anche per il passato): si leggono
// quando si apre la scheda e ogni volta che si preme «Aggiorna». Il calcolo e' in
// statistiche-attivita.js (provato con test-statistiche-attivita.mjs); qui c'e' solo il disegno.
//
// Si carica "a parte" (import dinamico da admin-ui.js, la prima volta che si apre la scheda): se si
// rompe qualcosa qui, il resto dell'Admin — e le statistiche delle domande — non ne risente.
// Tutto quello che arriva dal database entra nella pagina come TESTO (textContent), mai come codice.

import { leggiPartiteUnaVolta, ascoltaRiepilogoTabelloniAttivi } from './sincronizzazione.js';
import {
  GIORNI_GRAFICO, GIORNI_SETTIMANA, calcolaAttivita, plurale, formattaGiorno, etichettaAsse, formattaOra, descriviQuando
} from './statistiche-attivita.js';

const ALTEZZA_GRAFICO = 150;          // px: l'area delle colonne (le etichette dell'asse stanno sotto)
const SPESSORE_MINIMO = 3;            // px: anche una sola partita deve vedersi
const SPAZIO_TRA_BLOCCHI = 2;         // px: lo spazio tra la parte "partite" e la parte "da solo" di una colonna
const ATTESA_MASSIMA_MS = 20000;      // oltre, si da' per fallita la lettura (si puo' riprovare con «Aggiorna»)
const OGNI_QUANTI_GIORNI = 7;         // un'etichetta di data ogni 7 colonne, a partire da oggi

const PERIODI = [
  { id: 'oggi', nome: 'Oggi', aiuto: 'La giornata di oggi' },
  { id: 'settimana', nome: '7 giorni', aiuto: `Oggi e i ${GIORNI_SETTIMANA - 1} giorni prima` },
  { id: 'mese', nome: '30 giorni', aiuto: `Oggi e i ${GIORNI_GRAFICO - 1} giorni prima` }
];

let inCaricamento = false;
let ultimaRisposta = null;            // l'ultimo calcolo riuscito (si tiene a schermo se un aggiornamento fallisce)
let figuraAperta = null;              // la figura del grafico che c'e' ora in pagina (per chiudere il suggerimento)
let nascondiSuggerimento = () => {};

// ---------- piccoli aiuti ----------

const trova = id => document.getElementById(id);

function creaElemento(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo !== undefined) el.textContent = testo;
  return el;
}

function svuota(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// "3,5" (virgola, come si scrive in Italia)
function comeNumero(n) {
  return n.toFixed(1).replace('.', ',');
}

function conTempoMassimo(promessa, ms) {
  return new Promise((risolvi, rifiuta) => {
    const timer = setTimeout(() => rifiuta(new Error('tempo scaduto')), ms);
    promessa.then(
      valore => { clearTimeout(timer); risolvi(valore); },
      errore => { clearTimeout(timer); rifiuta(errore); }
    );
  });
}

function mostraAvviso(testo) {
  const avviso = trova('attivita-avviso');
  if (!avviso) return;
  avviso.textContent = testo || '';
  avviso.classList.toggle('nascosta', !testo);
}

function scriviAggiornato(testo) {
  const el = trova('attivita-aggiornato');
  if (el) el.textContent = testo;
}

function impostaOccupato(occupato) {
  const radice = trova('sezione-attivita');
  if (radice) {
    radice.classList.toggle('attivita-occupata', occupato);
    radice.setAttribute('aria-busy', occupato ? 'true' : 'false');
  }
}

// ---------- l'avvio ----------

export function avviaSezioneAttivita() {
  if (!trova('sezione-attivita')) return;     // una pagina Admin senza questo riquadro (vecchia): niente da fare

  const pulsante = trova('attivita-btn-aggiorna');
  if (pulsante) pulsante.addEventListener('click', carica);

  document.addEventListener('pointerdown', (evento) => {
    if (figuraAperta && !figuraAperta.contains(evento.target)) nascondiSuggerimento();
  });

  ascoltaRiepilogoTabelloniAttivi(disegnaAdesso);
  carica();
}

async function carica() {
  if (inCaricamento) return;
  inCaricamento = true;
  impostaOccupato(true);
  try {
    const partite = await conTempoMassimo(leggiPartiteUnaVolta(), ATTESA_MASSIMA_MS);
    const adesso = Date.now();
    ultimaRisposta = calcolaAttivita(partite, adesso);
    disegna(ultimaRisposta);
    mostraAvviso('');
    scriviAggiornato(`Aggiornato alle ${formattaOra(new Date(adesso))}`);
  } catch (errore) {
    console.warn('Statistiche: non riesco a leggere le partite', errore);
    mostraAvviso('⚠️ Non riesco a leggere le partite dal database in questo momento. Controlla la connessione e premi «Aggiorna».');
    scriviAggiornato(ultimaRisposta ? `Numeri delle ${formattaOra(new Date(ultimaRisposta.adesso))} (non aggiornati)` : 'Numeri non caricati');
  } finally {
    inCaricamento = false;
    impostaOccupato(false);
  }
}

function disegna(r) {
  disegnaPeriodi(r);
  disegnaUltima(r);
  disegnaGrafico(r);
  disegnaTabella(r);
  disegnaTotale(r);
}

// ---------- "adesso" (in diretta) ----------

function disegnaAdesso({ numeroPartite, numeroGiocatori }) {
  const el = trova('attivita-adesso');
  if (!el) return;
  if (!numeroPartite) {
    el.textContent = '⚪ In questo momento nessun tabellone è aperto.';
    return;
  }
  el.textContent = `🟢 In questo momento ${numeroPartite} ${plurale(numeroPartite, 'tabellone è aperto', 'tabelloni sono aperti')}, `
    + `con ${numeroGiocatori} ${plurale(numeroGiocatori, 'giocatore entrato', 'giocatori entrati')}.`;
}

// ---------- i tre riquadri: oggi / 7 giorni / 30 giorni ----------

function disegnaPeriodi(r) {
  const contenitore = trova('attivita-periodi');
  if (!contenitore) return;
  svuota(contenitore);

  for (const periodo of PERIODI) {
    const c = r[periodo.id];
    const scheda = creaElemento('div', 'attivita-periodo');
    scheda.title = periodo.aiuto;
    scheda.appendChild(creaElemento('div', 'attivita-periodo-nome', periodo.nome));
    scheda.appendChild(creaElemento('strong', c.partite === 0 ? 'attivita-zero' : '', String(c.partite)));
    scheda.appendChild(creaElemento('span', 'attivita-periodo-unita', plurale(c.partite, 'partita', 'partite')));

    const dettagli = creaElemento('ul', 'attivita-periodo-dettagli');
    dettagli.appendChild(creaElemento('li', '', `${c.concluse} ${plurale(c.concluse, 'conclusa', 'concluse')}`));
    dettagli.appendChild(creaElemento('li', '', `${c.giocatori} ${plurale(c.giocatori, 'giocatore', 'giocatori')}`));
    if (c.daSolo > 0) {
      const solo = creaElemento('li', 'attivita-solo', `+ ${c.daSolo} da solo`);
      solo.title = 'Partite con un solo giocatore (di solito prove): non sono contate nelle partite';
      dettagli.appendChild(solo);
    }
    scheda.appendChild(dettagli);
    contenitore.appendChild(scheda);
  }
}

function disegnaUltima(r) {
  const el = trova('attivita-ultima');
  if (!el) return;
  if (!r.ultima) {
    el.textContent = 'Ultima partita: ancora nessuna.';
    return;
  }
  const u = r.ultima;
  const pezzi = [`${u.giocatori} giocatori`, u.conclusa ? 'conclusa' : 'non conclusa'];
  if (u.veloce) pezzi.push('modalità veloce');
  el.textContent = `Ultima partita: ${descriviQuando(u.quando, r.adesso)} — ${pezzi.join(', ')}.`;
}

// ---------- il grafico a colonne ----------

// Il numero piu' alto dell'asse: pari (cosi' anche la riga di mezzo e' un numero intero) e "tondo".
function scalaMassima(n) {
  if (n <= 10) return Math.max(2, n + (n % 2));
  const ordine = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 1.2, 1.4, 1.6, 2, 3, 4, 5, 6, 8, 10]) {
    if (m * ordine >= n) return Math.round(m * ordine);
  }
  return 10 * ordine;
}

function frase(g) {
  const data = new Date(g.inizio);
  const pezzi = [
    `${g.partite} ${plurale(g.partite, 'partita', 'partite')}`,
    `${g.concluse} ${plurale(g.concluse, 'conclusa', 'concluse')}`,
    `${g.giocatori} ${plurale(g.giocatori, 'giocatore', 'giocatori')}`
  ];
  if (g.daSolo > 0) pezzi.push(`${g.daSolo} da solo`);
  return `${formattaGiorno(data, { lungo: true })}: ${pezzi.join(', ')}`;
}

function creaLegenda() {
  const legenda = creaElemento('div', 'attivita-legenda');
  for (const [classe, testo] of [['attivita-seg-partite', 'Partite (2 o più giocatori)'], ['attivita-seg-solo', 'Da solo (prove)']]) {
    const voce = creaElemento('span', 'attivita-legenda-voce');
    voce.appendChild(creaElemento('i', `attivita-chiave ${classe}`));
    voce.appendChild(document.createTextNode(testo));
    legenda.appendChild(voce);
  }
  return legenda;
}

function contenutoSuggerimento(g) {
  const frag = document.createDocumentFragment();
  frag.appendChild(creaElemento('div', 'attivita-tt-titolo', formattaGiorno(new Date(g.inizio))));

  const riga = (classeChiave, valore, etichetta, secondaria) => {
    const el = creaElemento('div', secondaria ? 'attivita-tt-riga attivita-tt-secondaria' : 'attivita-tt-riga');
    if (classeChiave) el.appendChild(creaElemento('i', `attivita-tt-chiave ${classeChiave}`));
    el.appendChild(creaElemento('strong', '', String(valore)));
    el.appendChild(document.createTextNode(` ${etichetta}`));
    return el;
  };
  frag.appendChild(riga('attivita-seg-partite', g.partite, plurale(g.partite, 'partita', 'partite')));
  frag.appendChild(riga('attivita-seg-solo', g.daSolo, 'da solo'));
  frag.appendChild(riga('', g.concluse, plurale(g.concluse, 'conclusa', 'concluse'), true));
  frag.appendChild(riga('', g.giocatori, plurale(g.giocatori, 'giocatore', 'giocatori'), true));
  return frag;
}

function disegnaGrafico(r) {
  const contenitore = trova('attivita-grafico');
  if (!contenitore) return;
  svuota(contenitore);
  figuraAperta = null;

  const massimoDato = Math.max(0, ...r.giorni.map(g => g.partite + g.daSolo));
  if (massimoDato === 0) {
    contenitore.appendChild(creaElemento('p', 'attivita-vuoto', `Nessuna partita negli ultimi ${GIORNI_GRAFICO} giorni.`));
    return;
  }
  const massimo = scalaMassima(massimoDato);

  const figura = creaElemento('figure', 'attivita-grafico');
  figura.setAttribute('aria-label', `Partite al giorno negli ultimi ${GIORNI_GRAFICO} giorni`);
  figura.appendChild(creaLegenda());

  const area = creaElemento('div', 'attivita-plot');
  const asse = creaElemento('div', 'attivita-asse-y');
  const campo = creaElemento('div', 'attivita-campo');
  campo.style.height = `${ALTEZZA_GRAFICO}px`;
  asse.style.height = `${ALTEZZA_GRAFICO}px`;

  // le tre righe orizzontali (0, meta', massimo) e i loro numeri
  for (const valore of [0, massimo / 2, massimo]) {
    const percento = (valore / massimo) * 100;
    const riga = creaElemento('div', valore === 0 ? 'attivita-griglia attivita-base' : 'attivita-griglia');
    riga.style.bottom = `${percento}%`;
    campo.appendChild(riga);
    const numero = creaElemento('span', 'attivita-asse-numero', String(valore));
    numero.style.bottom = `${percento}%`;
    asse.appendChild(numero);
  }

  const colonne = creaElemento('div', 'attivita-colonne');
  const suggerimento = creaElemento('div', 'attivita-suggerimento');
  suggerimento.hidden = true;

  const mostra = (indice, colonna) => {
    svuota(suggerimento);
    suggerimento.appendChild(contenutoSuggerimento(r.giorni[indice]));
    suggerimento.hidden = false;
    const rf = figura.getBoundingClientRect();
    const rc = colonna.getBoundingClientRect();
    const larghezza = suggerimento.offsetWidth;
    const aDestra = rc.left + rc.width / 2 < rf.left + rf.width / 2;        // la colonna e' nella meta' sinistra: il suggerimento va a destra
    let sinistra = aDestra ? rc.right - rf.left + 6 : rc.left - rf.left - larghezza - 6;
    sinistra = Math.max(4, Math.min(sinistra, rf.width - larghezza - 4));
    suggerimento.style.left = `${sinistra}px`;
    suggerimento.style.top = `${campo.getBoundingClientRect().top - rf.top}px`;
  };
  nascondiSuggerimento = () => { suggerimento.hidden = true; };

  const ultimoIndice = r.giorni.length - 1;
  r.giorni.forEach((g, indice) => {
    const colonna = creaElemento('div', 'attivita-giorno');
    colonna.tabIndex = 0;
    colonna.setAttribute('role', 'img');
    colonna.setAttribute('aria-label', frase(g));

    const totale = g.partite + g.daSolo;
    if (totale > 0) {
      const blocchi = (g.partite > 0 ? 1 : 0) + (g.daSolo > 0 ? 1 : 0);
      const minimo = blocchi * SPESSORE_MINIMO + (blocchi - 1) * SPAZIO_TRA_BLOCCHI;
      const pila = creaElemento('div', 'attivita-pila');
      pila.style.height = `${Math.max(minimo, Math.round((totale / massimo) * ALTEZZA_GRAFICO))}px`;
      if (g.partite > 0) {
        const blocco = creaElemento('div', 'attivita-seg attivita-seg-partite');
        blocco.style.flexGrow = String(g.partite);
        pila.appendChild(blocco);
      }
      if (g.daSolo > 0) {
        const blocco = creaElemento('div', 'attivita-seg attivita-seg-solo');
        blocco.style.flexGrow = String(g.daSolo);
        pila.appendChild(blocco);
      }
      colonna.appendChild(pila);
    }

    if ((ultimoIndice - indice) % OGNI_QUANTI_GIORNI === 0) {
      colonna.appendChild(creaElemento('span', 'attivita-etichetta-x', indice === ultimoIndice ? 'oggi' : etichettaAsse(new Date(g.inizio))));
    }

    colonna.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') mostra(indice, colonna); });
    colonna.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') nascondiSuggerimento(); });
    colonna.addEventListener('focus', () => mostra(indice, colonna));
    colonna.addEventListener('blur', () => nascondiSuggerimento());
    colonna.addEventListener('click', () => mostra(indice, colonna));
    colonne.appendChild(colonna);
  });

  campo.appendChild(colonne);
  area.appendChild(asse);
  area.appendChild(campo);
  figura.appendChild(area);
  figura.appendChild(suggerimento);

  const didascalia = creaElemento('figcaption', 'attivita-didascalia',
    `Si è giocato in ${r.giorniAttivi} ${plurale(r.giorniAttivi, 'giorno', 'giorni')} su ${GIORNI_GRAFICO}.`);
  figura.appendChild(didascalia);

  contenitore.appendChild(figura);
  figuraAperta = figura;
}

// ---------- la stessa cosa in tabella (per chi non puo' usare il grafico) ----------

function disegnaTabella(r) {
  const contenitore = trova('attivita-tabella');
  if (!contenitore) return;
  svuota(contenitore);

  const righe = r.giorni.filter(g => g.partite > 0 || g.daSolo > 0).reverse();
  if (righe.length === 0) {
    contenitore.appendChild(creaElemento('p', 'attivita-vuoto', `Nessuna partita negli ultimi ${GIORNI_GRAFICO} giorni.`));
    return;
  }

  const tabella = creaElemento('table', 'attivita-tabella');
  const testa = creaElemento('thead');
  const rigaTesta = creaElemento('tr');
  for (const titolo of ['Giorno', 'Partite', 'Concluse', 'Giocatori', 'Da solo']) {
    const th = creaElemento('th', '', titolo);
    th.scope = 'col';
    rigaTesta.appendChild(th);
  }
  testa.appendChild(rigaTesta);
  tabella.appendChild(testa);

  const corpo = creaElemento('tbody');
  for (const g of righe) {
    const tr = creaElemento('tr');
    const giorno = creaElemento('th', '', formattaGiorno(new Date(g.inizio)));
    giorno.scope = 'row';
    tr.appendChild(giorno);
    for (const valore of [g.partite, g.concluse, g.giocatori, g.daSolo]) tr.appendChild(creaElemento('td', '', String(valore)));
    corpo.appendChild(tr);
  }
  tabella.appendChild(corpo);
  contenitore.appendChild(tabella);
  contenitore.appendChild(creaElemento('p', 'admin-nota', 'I giorni che non compaiono qui sono giorni senza partite.'));
}

// ---------- i totali dall'inizio ----------

function disegnaTotale(r) {
  const contenitore = trova('attivita-totale');
  const nota = trova('attivita-totale-nota');
  const t = r.totale;

  if (contenitore) {
    svuota(contenitore);
    const aggiungi = (valore, etichetta) => {
      const blocco = creaElemento('div', 'riepilogo-numero');
      blocco.appendChild(creaElemento('strong', '', valore));
      blocco.appendChild(creaElemento('span', '', etichetta));
      contenitore.appendChild(blocco);
    };
    aggiungi(String(t.partite), plurale(t.partite, 'partita', 'partite'));
    aggiungi(String(t.concluse), plurale(t.concluse, 'conclusa', 'concluse'));
    aggiungi(t.partite > 0 ? comeNumero(t.giocatori / t.partite) : '—', 'giocatori a partita (in media)');
  }

  if (nota) {
    const pezzi = [`In tutto ${t.giocatori} ${plurale(t.giocatori, 'giocatore', 'giocatori')}, sommati partita per partita.`];
    if (t.daSolo > 0) pezzi.push(`In più ${t.daSolo} ${plurale(t.daSolo, 'partita', 'partite')} da solo (prove), non contate qui.`);
    pezzi.push(t.veloci === 0
      ? 'La modalità veloce non è ancora stata scelta da nessuno.'
      : `Modalità veloce: ${t.veloci} ${plurale(t.veloci, 'partita', 'partite')} su ${t.partite}.`);
    nota.textContent = pezzi.join(' ');
  }
}
