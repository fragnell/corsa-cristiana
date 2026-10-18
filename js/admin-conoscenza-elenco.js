// admin-conoscenza-elenco.js
// L'elenco delle domande Conoscenza nel pannello Admin, con la barra dei filtri:
// cerca nel testo e nelle risposte, livello (normali / junior), tipo di domanda, link Approfondisci,
// ordinamento e "mostra altre" (le righe appaiono 30 alla volta, cosi' anche con tante domande
// la pagina resta leggera).
//
// I filtri vivono qui dentro, non nella lista: quando Firebase manda un aggiornamento (per esempio
// dopo aver salvato una domanda) la lista si ridisegna ma i filtri restano come li hai messi.
// La logica vera (chi passa i filtri, i conteggi) e' in filtri-carte.js, provata con test-admin-conoscenza.mjs.

import {
  FILTRI_INIZIALI, filtraCarte, filtriAttivi, contaCarte, descriviRisposta,
  livelloDi, tipoDi, statoLink, proteggiHtml
} from './filtri-carte.js';

const PER_PAGINA = 30;

const ICONE_TIPO = { diretta: '💬', elenco: '📋', scelta: '🔘' };
const NOMI_TIPO = { diretta: 'Diretta', elenco: 'Elenco', scelta: 'Scelta' };

// I gruppi di pulsanti della barra: per ognuno la chiave del filtro, il titolo e le voci.
const GRUPPI = [
  {
    chiave: 'livello', titolo: 'Livello', voci: [
      { valore: 'tutte', etichetta: 'Tutte', conteggio: c => c.totale },
      { valore: 'normali', etichetta: 'Normali', conteggio: c => c.livello.normali },
      { valore: 'junior', etichetta: '🟢 Junior', conteggio: c => c.livello.junior }
    ]
  },
  {
    chiave: 'tipo', titolo: 'Tipo', voci: [
      { valore: 'tutti', etichetta: 'Tutti', conteggio: c => c.totale },
      { valore: 'diretta', etichetta: '💬 Diretta', conteggio: c => c.tipo.diretta },
      { valore: 'elenco', etichetta: '📋 Elenco', conteggio: c => c.tipo.elenco },
      { valore: 'scelta', etichetta: '🔘 Scelta', conteggio: c => c.tipo.scelta }
    ]
  },
  {
    chiave: 'link', titolo: 'Link Approfondisci', voci: [
      { valore: 'tutti', etichetta: 'Tutti', conteggio: c => c.totale },
      { valore: 'con', etichetta: '🔗 Con link', conteggio: c => c.link.con },
      { valore: 'senza', etichetta: 'Senza link', conteggio: c => c.link.senza },
      { valore: 'nonvalido', etichetta: '⚠️ Non valido', conteggio: c => c.link.nonvalido }
    ]
  }
];

const ORDINAMENTI = [
  { valore: 'inserimento', etichetta: 'Come sono state inserite' },
  { valore: 'recenti', etichetta: 'Le ultime inserite per prime' },
  { valore: 'az', etichetta: 'In ordine alfabetico (A → Z)' },
  { valore: 'senzalink', etichetta: 'Prima quelle senza link' }
];

// ---------- la barra dei filtri ----------

function creaElemento(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo !== undefined) el.textContent = testo;
  return el;
}

// Costruisce la barra e restituisce i pezzi che servono per aggiornarla.
// "alCambio(chiave, valore)" viene chiamata quando si cambia un filtro.
function costruisciBarra(alCambio, alAzzera) {
  const radice = creaElemento('div', 'filtri-carte');

  const campoTesto = document.createElement('input');
  campoTesto.type = 'search';
  campoTesto.className = 'filtri-ricerca';
  campoTesto.placeholder = '🔍 Cerca nella domanda o nelle risposte…';
  campoTesto.setAttribute('aria-label', 'Cerca nelle domande');
  campoTesto.autocomplete = 'off';
  campoTesto.addEventListener('input', () => alCambio('testo', campoTesto.value));
  campoTesto.addEventListener('keydown', e => {
    if (e.key === 'Escape' && campoTesto.value !== '') { campoTesto.value = ''; alCambio('testo', ''); }
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
      el.addEventListener('click', () => alCambio(gruppo.chiave, voce.valore));
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
  selectOrdine.addEventListener('change', () => alCambio('ordine', selectOrdine.value));
  etichettaOrdine.appendChild(document.createTextNode(' '));
  etichettaOrdine.appendChild(selectOrdine);
  rigaOrdine.appendChild(etichettaOrdine);

  const bottoneAzzera = creaElemento('button', 'filtri-azzera', '✖ Azzera i filtri');
  bottoneAzzera.type = 'button';
  bottoneAzzera.addEventListener('click', alAzzera);
  rigaOrdine.appendChild(bottoneAzzera);
  radice.appendChild(rigaOrdine);

  const riepilogo = creaElemento('p', 'filtri-riepilogo');
  riepilogo.setAttribute('aria-live', 'polite');
  radice.appendChild(riepilogo);

  return { radice, campoTesto, pulsanti, selectOrdine, bottoneAzzera, riepilogo };
}

// ---------- le righe ----------

function creaRiga(carta, alModifica, alElimina) {
  const riga = document.createElement('div');
  riga.className = 'admin-riga-carta riga-conoscenza';

  const tipo = tipoDi(carta);
  const link = statoLink(carta);
  const risposta = descriviRisposta(carta);

  const marcatori = [
    `<span class="marcatore marcatore-tipo">${ICONE_TIPO[tipo]} ${NOMI_TIPO[tipo]}</span>`,
    livelloDi(carta) === 'junior' ? '<span class="marcatore marcatore-junior" title="Domanda per la modalità junior">🟢 Junior</span>' : '',
    link === 'con' ? '<span class="marcatore marcatore-link" title="Ha il link Approfondisci">🔗 Link</span>' : '',
    link === 'nonvalido' ? '<span class="marcatore marcatore-avviso" title="Il link Approfondisci non è valido: il pulsante non comparirà">⚠️ Link non valido</span>' : ''
  ].join('');

  riga.innerHTML = `
    <div class="admin-riga-testo">
      <div class="conoscenza-domanda">${proteggiHtml(carta.domanda)}</div>
      <div class="conoscenza-dettagli">${marcatori}${risposta ? `<span class="conoscenza-risposta">${proteggiHtml(risposta)}</span>` : ''}</div>
    </div>
    <button type="button" class="admin-btn-modifica" title="Modifica">✏️</button>
    <button type="button" class="admin-btn-elimina" title="Elimina">🗑️</button>
  `;
  riga.querySelector('.admin-btn-modifica').addEventListener('click', () => alModifica(carta));
  riga.querySelector('.admin-btn-elimina').addEventListener('click', () => alElimina(carta));
  return riga;
}

// ---------- l'elenco completo ----------

// contenitoreFiltri: dove mettere la barra; contenitoreLista: dove mettere le righe.
// alModifica(carta) e alElimina(carta): cosa fare quando si preme ✏️ o 🗑️.
// Restituisce { aggiorna(carte) }: da chiamare ogni volta che l'elenco delle carte cambia.
export function creaElencoConoscenza({ contenitoreFiltri, contenitoreLista, alModifica, alElimina }) {
  let carte = [];
  let filtri = { ...FILTRI_INIZIALI };
  let visibili = PER_PAGINA;

  const barra = costruisciBarra(cambiaFiltro, azzeraFiltri);
  contenitoreFiltri.innerHTML = '';
  contenitoreFiltri.appendChild(barra.radice);

  function cambiaFiltro(chiave, valore) {
    filtri = { ...filtri, [chiave]: valore };
    visibili = PER_PAGINA;   // un filtro nuovo riparte dalla prima pagina
    disegna();
  }

  function azzeraFiltri() {
    filtri = { ...FILTRI_INIZIALI };
    visibili = PER_PAGINA;
    disegna();
  }

  // Aggiorna la barra (pulsanti accesi, conteggi, riepilogo) senza ricostruirla: cosi' la casella
  // di ricerca non perde il cursore mentre si scrive.
  function aggiornaBarra(trovate) {
    const conti = contaCarte(carte);
    for (const { gruppo, voce, el } of barra.pulsanti) {
      const acceso = filtri[gruppo.chiave] === voce.valore;
      el.classList.toggle('filtro-acceso', acceso);
      el.setAttribute('aria-pressed', String(acceso));
      el.querySelector('.filtro-conteggio').textContent = `(${voce.conteggio(conti)})`;
      // "Link non valido" si vede solo se ce n'e' qualcuno (o se e' il filtro acceso)
      if (voce.valore === 'nonvalido') el.hidden = voce.conteggio(conti) === 0 && !acceso;
    }
    if (barra.campoTesto.value !== filtri.testo) barra.campoTesto.value = filtri.testo;
    barra.selectOrdine.value = filtri.ordine;
    barra.bottoneAzzera.hidden = filtriAttivi(filtri) === 0 && filtri.ordine === FILTRI_INIZIALI.ordine;

    const mostrate = Math.min(trovate, visibili);
    let testo = filtriAttivi(filtri) > 0
      ? `${trovate} ${trovate === 1 ? 'domanda trovata' : 'domande trovate'} su ${carte.length}`
      : `${carte.length} ${carte.length === 1 ? 'domanda' : 'domande'}`;
    if (trovate > mostrate) testo += ` · mostro le prime ${mostrate}`;
    barra.riepilogo.textContent = testo;
  }

  function disegna() {
    const trovate = filtraCarte(carte, filtri);
    const mostrate = trovate.slice(0, visibili);

    contenitoreLista.innerHTML = '';
    for (const carta of mostrate) contenitoreLista.appendChild(creaRiga(carta, alModifica, alElimina));

    if (trovate.length === 0) {
      const vuoto = creaElemento('p', 'filtri-vuoto', carte.length === 0
        ? 'Non ci sono ancora domande.'
        : 'Nessuna domanda corrisponde ai filtri scelti.');
      contenitoreLista.appendChild(vuoto);
    } else if (trovate.length > mostrate.length) {
      const resto = trovate.length - mostrate.length;
      const altre = creaElemento('button', 'filtri-altre', `Mostra altre ${Math.min(PER_PAGINA, resto)} (ne restano ${resto})`);
      altre.type = 'button';
      altre.addEventListener('click', () => { visibili += PER_PAGINA; disegna(); });
      contenitoreLista.appendChild(altre);
    }

    aggiornaBarra(trovate.length);
  }

  return {
    aggiorna(nuoveCarte) {
      carte = Array.isArray(nuoveCarte) ? nuoveCarte : [];
      disegna();
    }
  };
}
