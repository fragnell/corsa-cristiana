// admin-recensioni.js
// La scheda "Recensioni" dell'Admin: le stelline e i commenti lasciati dai giocatori a fine partita.
// Mostra il riepilogo (media, quante per ogni voto), un elenco con filtri (voto, solo con commento,
// normale/veloce, beta/ufficiale, ricerca nel testo), il cestino per eliminare una recensione e
// l'esportazione in Excel. Le recensioni nuove compaiono da sole, senza ricaricare la pagina.
//
// Si carica "a parte" (import dinamico da admin-ui.js, la prima volta che si apre la scheda): se si
// rompe qualcosa qui, il resto dell'Admin non ne risente.
// La logica (filtri, riepilogo, righe di Excel) e' in filtri-recensioni.js, provata con test-recensioni.mjs.

import { ascoltaRecensioni, eliminaRecensione } from './sincronizzazione.js';
import {
  FILTRI_RECENSIONI_INIZIALI, filtraRecensioni, filtriAttivi, riassumi, contaRecensioni, righeExcel,
  votoDi, commentoDi, modalitaDi, versioneDi, dataDi, etichettaStelle, dataEOra
} from './filtri-recensioni.js';

const PER_PAGINA = 30;

let recensioni = [];        // tutte quelle arrivate, come le manda Firebase
let caricate = false;       // false finche' non e' arrivata la prima risposta
let filtri = { ...FILTRI_RECENSIONI_INIZIALI };
let visibili = PER_PAGINA;

// I pezzi della pagina (si trovano una volta sola, all'avvio)
let elRiepilogo = null;
let elFiltri = null;
let elLista = null;
let elAvviso = null;
let elRisultato = null;
let barra = null;           // i pezzi della barra dei filtri, per aggiornarli senza ricostruirla

const GRUPPI = [
  {
    chiave: 'stelle', titolo: 'Voto', voci: [
      { valore: 'tutte', etichetta: 'Tutti', conteggio: c => c.totale },
      { valore: '5', etichetta: '5 ★', conteggio: c => c.stelle[5] },
      { valore: '4', etichetta: '4 ★', conteggio: c => c.stelle[4] },
      { valore: '3', etichetta: '3 ★', conteggio: c => c.stelle[3] },
      { valore: '2', etichetta: '2 ★', conteggio: c => c.stelle[2] },
      { valore: '1', etichetta: '1 ★', conteggio: c => c.stelle[1] }
    ]
  },
  {
    chiave: 'commento', titolo: 'Commento', voci: [
      { valore: 'tutte', etichetta: 'Tutte', conteggio: c => c.totale },
      { valore: 'con', etichetta: '💬 Solo con commento', conteggio: c => c.conCommento }
    ]
  },
  {
    chiave: 'modalita', titolo: 'Partita', voci: [
      { valore: 'tutte', etichetta: 'Tutte', conteggio: c => c.totale },
      { valore: 'normale', etichetta: 'Normale', conteggio: c => c.modalita.normale },
      { valore: 'veloce', etichetta: '⚡ Veloce', conteggio: c => c.modalita.veloce }
    ]
  },
  {
    chiave: 'versione', titolo: 'Versione', voci: [
      { valore: 'tutte', etichetta: 'Tutte', conteggio: c => c.totale },
      { valore: 'beta', etichetta: 'Beta', conteggio: c => c.versione.beta },
      { valore: 'ufficiale', etichetta: 'Ufficiale', conteggio: c => c.versione.ufficiale }
    ]
  }
];

const ORDINAMENTI = [
  { valore: 'recenti', etichetta: 'Le più recenti per prime' },
  { valore: 'vecchie', etichetta: 'Le più vecchie per prime' },
  { valore: 'basse', etichetta: 'Prima i voti più bassi' },
  { valore: 'alte', etichetta: 'Prima i voti più alti' }
];

// ---------- piccoli aiuti ----------

function creaElemento(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo !== undefined) el.textContent = testo;
  return el;
}

// "4,3" (virgola, come si scrive in Italia)
function comeNumero(n) {
  return n === null ? '—' : String(n).replace('.', ',');
}

function quandoScritta(millisecondi) {
  const { data, ora } = dataEOra(millisecondi);
  if (!data) return 'data sconosciuta';
  try {
    return new Date(millisecondi).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (errore) {
    return `${data} ${ora}`;
  }
}

function mostraAvviso(testo) {
  if (!elAvviso) return;
  elAvviso.textContent = testo || '';
  elAvviso.classList.toggle('nascosta', !testo);
}

function dicoErrore(errore) {
  const testo = String((errore && (errore.code || errore.message)) || errore || '');
  if (/permission[_ -]?denied/i.test(testo)) {
    return '🔒 Firebase non mi lascia leggere le recensioni. Controlla di aver fatto il login con la tua email e che nelle regole del database sia stato aggiunto il blocco «recensioni» (te l\'ha spiegato Claude).';
  }
  return '⚠️ Non riesco a leggere le recensioni in questo momento. Controlla la connessione e ricarica la pagina.';
}

// ---------- il riepilogo in alto ----------

function disegnaRiepilogo() {
  const r = riassumi(recensioni);
  elRiepilogo.innerHTML = '';

  const numeri = creaElemento('div', 'statistiche-riepilogo');
  const aggiungiNumero = (valore, etichetta) => {
    const blocco = creaElemento('div', 'riepilogo-numero');
    blocco.appendChild(creaElemento('strong', '', valore));
    blocco.appendChild(creaElemento('span', '', etichetta));
    numeri.appendChild(blocco);
  };
  aggiungiNumero(r.media === null ? '—' : `⭐ ${comeNumero(r.media)}`, 'media su 5');
  aggiungiNumero(String(r.totale), r.totale === 1 ? 'recensione' : 'recensioni');
  aggiungiNumero(String(r.conCommento), 'con commento');
  elRiepilogo.appendChild(numeri);

  if (r.votate > 0) {
    const barre = creaElemento('div', 'recensioni-barre');
    const massimo = Math.max(...Object.values(r.distribuzione));
    for (let voto = 5; voto >= 1; voto--) {
      const quante = r.distribuzione[voto];
      const riga = creaElemento('div', 'recensioni-barra-riga');
      riga.appendChild(creaElemento('span', 'recensioni-barra-voto', `${voto} ★`));
      const pista = creaElemento('div', 'recensioni-barra-pista');
      const riempimento = creaElemento('div', 'recensioni-barra-piena');
      riempimento.style.width = massimo > 0 ? `${Math.round((quante / massimo) * 100)}%` : '0%';
      pista.appendChild(riempimento);
      riga.appendChild(pista);
      riga.appendChild(creaElemento('span', 'recensioni-barra-numero', String(quante)));
      barre.appendChild(riga);
    }
    elRiepilogo.appendChild(barre);
  }
}

// ---------- la barra dei filtri ----------

function costruisciBarra() {
  const radice = creaElemento('div', 'filtri-carte');

  const campoTesto = document.createElement('input');
  campoTesto.type = 'search';
  campoTesto.className = 'filtri-ricerca';
  campoTesto.placeholder = '🔍 Cerca nei commenti…';
  campoTesto.setAttribute('aria-label', 'Cerca nei commenti');
  campoTesto.autocomplete = 'off';
  campoTesto.addEventListener('input', () => cambiaFiltro('testo', campoTesto.value));
  campoTesto.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && campoTesto.value !== '') { campoTesto.value = ''; cambiaFiltro('testo', ''); }
  });
  radice.appendChild(campoTesto);

  const pulsanti = [];   // { gruppo, voce, el }
  for (const gruppo of GRUPPI) {
    const riga = creaElemento('div', 'filtri-gruppo');
    riga.setAttribute('role', 'group');
    riga.setAttribute('aria-label', gruppo.titolo);
    riga.appendChild(creaElemento('span', 'filtri-titolo', gruppo.titolo + ':'));
    for (const voce of gruppo.voci) {
      const el = creaElemento('button', 'filtro-pulsante');
      el.type = 'button';
      el.setAttribute('aria-pressed', 'false');
      el.appendChild(document.createTextNode(voce.etichetta + ' '));
      el.appendChild(creaElemento('span', 'filtro-conteggio', ''));
      el.addEventListener('click', () => cambiaFiltro(gruppo.chiave, voce.valore));
      riga.appendChild(el);
      pulsanti.push({ gruppo, voce, el });
    }
    radice.appendChild(riga);
  }

  const rigaOrdine = creaElemento('div', 'filtri-gruppo filtri-ordine');
  const etichettaOrdine = creaElemento('label', 'filtri-titolo', 'Ordina:');
  const selectOrdine = document.createElement('select');
  selectOrdine.className = 'filtri-select';
  for (const o of ORDINAMENTI) {
    const opzione = document.createElement('option');
    opzione.value = o.valore;
    opzione.textContent = o.etichetta;
    selectOrdine.appendChild(opzione);
  }
  selectOrdine.addEventListener('change', () => cambiaFiltro('ordine', selectOrdine.value));
  etichettaOrdine.appendChild(document.createTextNode(' '));
  etichettaOrdine.appendChild(selectOrdine);
  rigaOrdine.appendChild(etichettaOrdine);

  const bottoneAzzera = creaElemento('button', 'filtri-azzera', '✖ Azzera i filtri');
  bottoneAzzera.type = 'button';
  bottoneAzzera.addEventListener('click', azzeraFiltri);
  rigaOrdine.appendChild(bottoneAzzera);
  radice.appendChild(rigaOrdine);

  const riepilogo = creaElemento('p', 'filtri-riepilogo');
  riepilogo.setAttribute('aria-live', 'polite');
  radice.appendChild(riepilogo);

  return { radice, campoTesto, pulsanti, selectOrdine, bottoneAzzera, riepilogo };
}

function cambiaFiltro(chiave, valore) {
  filtri = { ...filtri, [chiave]: valore };
  visibili = PER_PAGINA;
  disegna();
}

function azzeraFiltri() {
  filtri = { ...FILTRI_RECENSIONI_INIZIALI };
  visibili = PER_PAGINA;
  disegna();
}

// Aggiorna la barra (pulsanti accesi, conteggi, riepilogo) senza ricostruirla: cosi' la casella
// di ricerca non perde il cursore mentre si scrive.
function aggiornaBarra(trovate) {
  const conti = contaRecensioni(recensioni);
  for (const { gruppo, voce, el } of barra.pulsanti) {
    const acceso = String(filtri[gruppo.chiave]) === voce.valore;
    el.classList.toggle('filtro-acceso', acceso);
    el.setAttribute('aria-pressed', String(acceso));
    el.querySelector('.filtro-conteggio').textContent = `(${voce.conteggio(conti)})`;
  }
  if (barra.campoTesto.value !== filtri.testo) barra.campoTesto.value = filtri.testo;
  barra.selectOrdine.value = filtri.ordine;
  barra.bottoneAzzera.hidden = filtriAttivi(filtri) === 0 && filtri.ordine === FILTRI_RECENSIONI_INIZIALI.ordine;

  const mostrate = Math.min(trovate, visibili);
  let testo = filtriAttivi(filtri) > 0
    ? `${trovate} ${trovate === 1 ? 'recensione trovata' : 'recensioni trovate'} su ${recensioni.length}`
    : `${recensioni.length} ${recensioni.length === 1 ? 'recensione' : 'recensioni'}`;
  if (trovate > mostrate) testo += ` · mostro le prime ${mostrate}`;
  barra.riepilogo.textContent = testo;
}

// ---------- le righe ----------

function creaRiga(recensione) {
  const riga = creaElemento('div', 'recensione-riga');
  const voto = votoDi(recensione);

  const corpo = creaElemento('div', 'recensione-corpo');

  const testa = creaElemento('div', 'recensione-testa');
  testa.appendChild(creaElemento('span', 'recensione-stelline', etichettaStelle(voto)));
  testa.appendChild(creaElemento('span', 'recensione-voto', voto ? `${voto}/5` : 'senza voto'));
  testa.appendChild(creaElemento('span', 'recensione-data', quandoScritta(dataDi(recensione))));
  corpo.appendChild(testa);

  const commento = commentoDi(recensione);
  corpo.appendChild(commento
    ? creaElemento('p', 'recensione-testo', commento)           // textContent: mai interpretato come pagina
    : creaElemento('p', 'recensione-testo recensione-senza-commento', '(nessun commento)'));

  const marcatori = creaElemento('div', 'conoscenza-dettagli');
  marcatori.appendChild(creaElemento('span', 'marcatore', modalitaDi(recensione) === 'veloce' ? '⚡ Veloce' : 'Normale'));
  if (Number.isInteger(recensione.giocatori)) marcatori.appendChild(creaElemento('span', 'marcatore', `${recensione.giocatori} giocatori`));
  if (recensione.junior === true) marcatori.appendChild(creaElemento('span', 'marcatore marcatore-junior', '🟢 Junior'));
  const versione = versioneDi(recensione);
  if (versione !== 'sconosciuta') marcatori.appendChild(creaElemento('span', 'marcatore marcatore-link', versione === 'beta' ? 'Beta' : 'Ufficiale'));
  if (Number.isInteger(recensione.partite)) marcatori.appendChild(creaElemento('span', 'marcatore', `${recensione.partite}ª partita di quel telefono`));
  corpo.appendChild(marcatori);

  riga.appendChild(corpo);

  const elimina = creaElemento('button', 'admin-btn-elimina', '🗑️');
  elimina.type = 'button';
  elimina.title = 'Elimina questa recensione';
  elimina.addEventListener('click', () => chiediEliminazione(recensione));
  riga.appendChild(elimina);

  return riga;
}

async function chiediEliminazione(recensione) {
  if (!confirm('Eliminare questa recensione? Non si può annullare.')) return;
  try {
    await eliminaRecensione(recensione._chiave);
    mostraAvviso('');
  } catch (errore) {
    console.warn('Recensioni: eliminazione non riuscita', errore);
    mostraAvviso('❌ Non sono riuscito a eliminarla. Controlla di essere entrato con la tua email e riprova.');
  }
}

// ---------- tutto insieme ----------

function disegna() {
  disegnaRiepilogo();

  const trovate = filtraRecensioni(recensioni, filtri);
  const mostrate = trovate.slice(0, visibili);

  elLista.innerHTML = '';
  for (const recensione of mostrate) elLista.appendChild(creaRiga(recensione));

  if (!caricate) {
    elLista.appendChild(creaElemento('p', 'filtri-vuoto', 'Carico le recensioni…'));
  } else if (trovate.length === 0) {
    elLista.appendChild(creaElemento('p', 'filtri-vuoto', recensioni.length === 0
      ? 'Non è ancora arrivata nessuna recensione.'
      : 'Nessuna recensione corrisponde ai filtri scelti.'));
  } else if (trovate.length > mostrate.length) {
    const resto = trovate.length - mostrate.length;
    const altre = creaElemento('button', 'filtri-altre', `Mostra altre ${Math.min(PER_PAGINA, resto)} (ne restano ${resto})`);
    altre.type = 'button';
    altre.addEventListener('click', () => { visibili += PER_PAGINA; disegna(); });
    elLista.appendChild(altre);
  }

  aggiornaBarra(trovate.length);
}

// ---------- Excel ----------

function esporta() {
  if (typeof XLSX === 'undefined' || !XLSX.utils) {
    elRisultato.textContent = '❌ Il programma che crea i file Excel non si è caricato. Ricarica la pagina e riprova.';
    return;
  }
  const righe = righeExcel(recensioni);
  if (righe.length === 0) {
    elRisultato.textContent = 'Non ci sono ancora recensioni da esportare.';
    return;
  }
  try {
    const foglio = XLSX.utils.json_to_sheet(righe);
    foglio['!cols'] = [{ wch: 11 }, { wch: 7 }, { wch: 7 }, { wch: 70 }, { wch: 10 }, { wch: 10 }, { wch: 7 }, { wch: 10 }, { wch: 13 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, foglio, 'Recensioni');
    const dataOggi = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `recensioni-corsa-cristiana-${dataOggi}.xlsx`);
    elRisultato.textContent = `✅ Esportate ${righe.length} ${righe.length === 1 ? 'recensione' : 'recensioni'}.`;
  } catch (errore) {
    console.warn('Recensioni: esportazione non riuscita', errore);
    elRisultato.textContent = '❌ Non sono riuscito a creare il file: ' + errore.message;
  }
}

// ---------- avvio ----------

export function avviaSezioneRecensioni() {
  elRiepilogo = document.getElementById('recensioni-riepilogo');
  elFiltri = document.getElementById('recensioni-filtri');
  elLista = document.getElementById('recensioni-lista');
  elAvviso = document.getElementById('recensioni-avviso');
  elRisultato = document.getElementById('recensioni-risultato');
  if (!elRiepilogo || !elFiltri || !elLista) {
    throw new Error('La scheda Recensioni non e\' nella pagina (admin.html vecchio?)');
  }

  barra = costruisciBarra();
  elFiltri.innerHTML = '';
  elFiltri.appendChild(barra.radice);

  const bottoneEsporta = document.getElementById('recensioni-btn-esporta');
  if (bottoneEsporta) bottoneEsporta.addEventListener('click', esporta);

  // L'indirizzo per provare la richiesta anche su un telefono dove l'hai gia' vista
  const campoIndirizzo = document.getElementById('recensioni-prova-indirizzo');
  if (campoIndirizzo) {
    campoIndirizzo.value = new URL('giocatore.html?recensioni=prova', location.href).href;
    campoIndirizzo.addEventListener('focus', () => campoIndirizzo.select());
  }

  disegna();
  ascoltaRecensioni(
    lista => {
      recensioni = lista;
      caricate = true;
      mostraAvviso('');
      disegna();
    },
    errore => {
      console.warn('Recensioni: lettura non riuscita', errore);
      caricate = true;
      mostraAvviso(dicoErrore(errore));
      disegna();
    }
  );
}
