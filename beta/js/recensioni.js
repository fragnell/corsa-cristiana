// recensioni.js
// La richiesta di recensione a fine partita, sul telefono: cinque stelline e un campo dove scrivere
// (cosa e' piaciuto, cosa no, cosa si propone). La recensione e' ANONIMA e finisce su Firebase in
// "recensioni/", dove la legge solo l'Admin (scheda Recensioni).
//
// Questo modulo si carica "a parte" (import dinamico da giocatore-ui.js) e solo quando la partita e'
// finita: se manca o si rompe qualcosa, la partita non ne risente.
// La logica (a chi si chiede e quando, come si conta, come si pulisce il commento) e' in
// recensioni-logica.js, provata con test-recensioni.mjs.
//
// Per provarla anche su un telefono dove l'hai gia' vista: apri giocatore.html?recensioni=prova
// (chiede sempre, senza contare niente e senza ricordare niente).

import { CONFIG, unisciConfig } from './config.js';
import { leggiConfigDaFirebase, nuovaChiaveRecensione, inviaRecensione, oraServer } from './sincronizzazione.js';
import {
  CHIAVE_ARCHIVIO, MAX_CARATTERI_COMMENTO, leggiArchivio, scriviArchivio, registraFinePartita,
  segnaChiesta, segnaInviata, decidiRichiesta, costruisciRecensione, tipoErroreInvio, versioneDalPercorso
} from './recensioni-logica.js';

const RITARDO_APERTURA_MS = 4000;          // si lascia il tempo di vedere chi ha vinto
const ATTESA_MASSIMA_VERDETTO_MS = 30000;  // se il pannello del verdetto resta aperto, non si aspetta oltre
const ATTESA_MASSIMA_IMPOSTAZIONI_MS = 5000;
const TEMPO_MASSIMO_INVIO_MS = 10000;      // oltre, il collegamento e' troppo lento
const CHIUSURA_GRAZIE_MS = 6000;           // "Grazie" si chiude da solo dopo qualche secondo

const COMMENTI_AL_VOTO = ['', 'Non mi è piaciuta', 'Così così', 'Discreta', 'Bella!', 'Bellissima! 🎉'];

// ---------- piccoli aiuti ----------

const aspetta = ms => new Promise(risolvi => setTimeout(risolvi, ms));

// Se la promessa non finisce entro "ms" fallisce con { codice: 'tempo-scaduto' } (la promessa vera continua per conto suo).
function conTempoMassimo(promessa, ms) {
  return new Promise((risolvi, rifiuta) => {
    const timer = setTimeout(() => rifiuta({ codice: 'tempo-scaduto', message: 'tempo scaduto' }), ms);
    Promise.resolve(promessa).then(
      valore => { clearTimeout(timer); risolvi(valore); },
      errore => { clearTimeout(timer); rifiuta(errore); }
    );
  });
}

// La memoria del telefono: se non si puo' usare (navigazione privata, spazio pieno...) si va avanti senza.
function leggiArchivioSalvato() {
  try {
    return leggiArchivio(localStorage.getItem(CHIAVE_ARCHIVIO));
  } catch (errore) {
    return leggiArchivio(null);
  }
}

function salvaArchivio(archivio) {
  try {
    localStorage.setItem(CHIAVE_ARCHIVIO, scriviArchivio(archivio));
  } catch (errore) {
    console.warn('Recensioni: non riesco a ricordare le partite su questo telefono', errore);
  }
}

// Le impostazioni dell'Admin (scheda Regole). Se non si riesce a leggerle, valgono quelle di base.
async function leggiImpostazioni() {
  try {
    const salvate = await conTempoMassimo(leggiConfigDaFirebase(), ATTESA_MASSIMA_IMPOSTAZIONI_MS);
    return unisciConfig(CONFIG, salvate || {}).recensioni;
  } catch (errore) {
    console.warn('Recensioni: non riesco a leggere le impostazioni, uso quelle di base', errore);
    return CONFIG.recensioni;
  }
}

// Se c'e' il pannello del verdetto ("Risposta corretta!") non ci si mette sopra: si aspetta che si chiuda.
async function aspettaVerdettoChiuso() {
  const inizio = Date.now();
  while (Date.now() - inizio < ATTESA_MASSIMA_VERDETTO_MS) {
    const verdetto = document.getElementById('verdetto-overlay');
    if (!verdetto || verdetto.classList.contains('nascosta')) return;
    await aspetta(500);
  }
}

// Il foglio di stile si carica solo ora (se manca, la richiesta si vede lo stesso, solo meno bella).
function caricaStile() {
  if (document.getElementById('recensioni-stile')) return Promise.resolve();
  return new Promise(risolvi => {
    const collegamento = document.createElement('link');
    collegamento.id = 'recensioni-stile';
    collegamento.rel = 'stylesheet';
    collegamento.href = new URL('../css/recensioni.css', import.meta.url).href;
    collegamento.addEventListener('load', () => risolvi());
    collegamento.addEventListener('error', () => risolvi());
    document.head.appendChild(collegamento);
    setTimeout(risolvi, 3000);
  });
}

// Una chiave nuova per ogni apertura: un secondo tentativo di invio riscrive lo stesso posto, senza doppioni.
function creaChiave() {
  try {
    return nuovaChiaveRecensione();
  } catch (errore) {
    return '-L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
}

// ---------- la scheda ----------

// Il testo e' tutto fisso (nessun dato di nessuno), quindi si puo' scrivere come HTML.
const MODELLO_SCHEDA = `
  <div id="recensione-scheda" role="dialog" aria-modal="true" aria-labelledby="recensione-titolo" tabindex="-1">
    <div id="recensione-vista-modulo">
      <h2 id="recensione-titolo">Ti è piaciuta la partita?</h2>
      <p class="recensione-intro">Dai un voto e dicci cosa ti è piaciuto, cosa no e cosa proponi: ci aiuti a migliorare il gioco.</p>
      <div id="recensione-stelle" role="radiogroup" aria-label="Il tuo voto, da 1 a 5 stelle"></div>
      <p id="recensione-voto-testo" aria-live="polite"></p>
      <label for="recensione-commento" class="recensione-etichetta">Il tuo commento <span>(facoltativo)</span></label>
      <textarea id="recensione-commento" rows="4" maxlength="${MAX_CARATTERI_COMMENTO}" placeholder="Cosa ti è piaciuto? Cosa no? Cosa proponi?"></textarea>
      <p id="recensione-contatore" aria-hidden="true"></p>
      <p id="recensione-messaggio" role="status" aria-live="polite"></p>
      <div class="recensione-bottoni">
        <button type="button" id="recensione-invia">Invia la recensione</button>
        <button type="button" id="recensione-salta">Non ora</button>
      </div>
      <p class="recensione-privacy">È anonima: salviamo solo il voto, il commento e il tipo di partita, non il tuo nome.</p>
    </div>
    <div id="recensione-vista-grazie" class="nascosta">
      <h2>Grazie! 🙏</h2>
      <p id="recensione-grazie-testo"></p>
      <button type="button" id="recensione-chiudi">OK</button>
    </div>
  </div>`;

// Costruisce la scheda (nascosta) e restituisce i suoi pezzi.
function creaScheda() {
  const vecchia = document.getElementById('recensione-overlay');
  if (vecchia) vecchia.remove();

  const radice = document.createElement('div');
  radice.id = 'recensione-overlay';
  radice.innerHTML = MODELLO_SCHEDA;
  document.body.appendChild(radice);

  const trova = id => radice.querySelector('#' + id);
  const stelle = [];
  const contenitoreStelle = trova('recensione-stelle');
  for (let voto = 1; voto <= 5; voto++) {
    const stella = document.createElement('button');
    stella.type = 'button';
    stella.className = 'recensione-stella';
    stella.dataset.voto = String(voto);
    stella.setAttribute('role', 'radio');
    stella.setAttribute('aria-checked', 'false');
    stella.setAttribute('aria-label', voto === 1 ? '1 stella' : `${voto} stelle`);
    stella.textContent = '★';
    contenitoreStelle.appendChild(stella);
    stelle.push(stella);
  }

  return {
    radice, stelle, contenitoreStelle,
    scheda: trova('recensione-scheda'),
    vistaModulo: trova('recensione-vista-modulo'),
    vistaGrazie: trova('recensione-vista-grazie'),
    testoVoto: trova('recensione-voto-testo'),
    campo: trova('recensione-commento'),
    contatore: trova('recensione-contatore'),
    messaggio: trova('recensione-messaggio'),
    bottoneInvia: trova('recensione-invia'),
    bottoneSalta: trova('recensione-salta'),
    bottoneChiudi: trova('recensione-chiudi'),
    testoGrazie: trova('recensione-grazie-testo')
  };
}

function scriviMessaggio(s, testo, errore) {
  s.messaggio.textContent = testo;
  s.messaggio.classList.toggle('recensione-errore', !!errore);
}

function testoDiErrore(tipo) {
  if (tipo === 'permessi') return 'Per ora non riesco a salvare le recensioni. Grazie lo stesso! 🙏';
  return 'Non sono riuscito a inviarla. Controlla la connessione e riprova.';
}

// Apre la scheda e la fa funzionare. "contesto" = i dati sulla partita che finiscono nella recensione.
function mostraScheda({ forzata, contesto }) {
  const s = creaScheda();
  const chiave = creaChiave();
  let voto = 0;
  let inInvio = false;
  let chiusa = false;
  let timerChiusura = null;

  function chiudi() {
    if (chiusa) return;
    chiusa = true;
    clearTimeout(timerChiusura);
    document.removeEventListener('keydown', allaPressioneDiUnTasto);
    s.radice.remove();
  }

  function scegliVoto(nuovoVoto) {
    voto = nuovoVoto;
    s.stelle.forEach(stella => {
      const n = Number(stella.dataset.voto);
      stella.classList.toggle('accesa', n <= voto);
      stella.setAttribute('aria-checked', String(n === voto));
      stella.tabIndex = (voto === 0 ? n === 1 : n === voto) ? 0 : -1;
    });
    s.testoVoto.textContent = voto ? COMMENTI_AL_VOTO[voto] : '';
    if (voto && s.messaggio.classList.contains('recensione-errore')) scriviMessaggio(s, '', false);
  }

  function allaPressioneDiUnTasto(evento) {
    if (evento.key === 'Escape') chiudi();
  }

  // Frecce sinistra/destra sulle stelle (per chi usa la tastiera)
  s.contenitoreStelle.addEventListener('keydown', evento => {
    if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return;
    evento.preventDefault();
    const passo = evento.key === 'ArrowRight' ? 1 : -1;
    const nuovo = Math.max(1, Math.min(5, (voto || 0) + passo));
    scegliVoto(nuovo);
    s.stelle[nuovo - 1].focus();
  });
  s.stelle.forEach(stella => stella.addEventListener('click', () => scegliVoto(Number(stella.dataset.voto))));

  s.campo.addEventListener('input', () => {
    s.contatore.textContent = `${Array.from(s.campo.value).length} / ${MAX_CARATTERI_COMMENTO}`;
  });

  function finito(esito) {
    if (!forzata) salvaArchivio(segnaInviata(leggiArchivioSalvato()));
    if (chiusa) return;
    s.vistaModulo.classList.add('nascosta');
    s.vistaGrazie.classList.remove('nascosta');
    s.testoGrazie.textContent = esito === 'in-coda'
      ? 'Il collegamento è lento: la tua recensione partirà appena possibile. Non chiudere questa pagina ancora per qualche istante.'
      : 'La tua recensione ci aiuta a migliorare il gioco. A presto!';
    s.bottoneChiudi.focus();
    timerChiusura = setTimeout(chiudi, CHIUSURA_GRAZIE_MS);
  }

  async function invia() {
    if (inInvio || chiusa) return;
    const esito = costruisciRecensione({ stelle: voto, commento: s.campo.value, adesso: oraServer(), ...contesto });
    if (!esito.ok) {
      scriviMessaggio(s, esito.errore === 'stelle' ? 'Tocca le stelline per dare un voto ⭐' : 'Qualcosa non va, riprova tra poco.', true);
      if (esito.errore === 'stelle') s.stelle[0].focus();
      return;
    }

    inInvio = true;
    s.bottoneInvia.disabled = true;
    scriviMessaggio(s, 'Invio in corso…', false);
    try {
      await conTempoMassimo(inviaRecensione(chiave, esito.recensione), TEMPO_MASSIMO_INVIO_MS);
      finito('inviata');
    } catch (errore) {
      if (errore && errore.codice === 'tempo-scaduto') {
        finito('in-coda');   // Firebase tiene la scrittura in coda e la manda appena torna il collegamento
      } else {
        console.warn('Recensione non inviata', errore);
        if (!chiusa) scriviMessaggio(s, testoDiErrore(tipoErroreInvio(errore)), true);
      }
    } finally {
      inInvio = false;
      s.bottoneInvia.disabled = false;
    }
  }

  s.bottoneInvia.addEventListener('click', invia);
  s.bottoneSalta.addEventListener('click', chiudi);
  s.bottoneChiudi.addEventListener('click', chiudi);
  document.addEventListener('keydown', allaPressioneDiUnTasto);

  scegliVoto(0);
  s.scheda.focus();
}

// ---------- l'unica funzione che serve a giocatore-ui.js ----------

// Da chiamare quando il telefono vede la fine della partita. Fa tutto da sola: conta la partita,
// decide se chiedere la recensione e, se si', la mostra dopo qualche secondo.
//   codicePartita: il codice di 4 lettere; stato: lo stato della partita (con il vincitore);
//   mioId: il numero di questo giocatore.
export async function proponiRecensione({ codicePartita, stato, mioId }) {
  const forzata = new URLSearchParams(location.search).get('recensioni') === 'prova';

  let archivio = leggiArchivioSalvato();
  let nuova = false;
  if (!forzata) {
    const conto = registraFinePartita(archivio, codicePartita, Date.now());
    archivio = conto.archivio;
    nuova = conto.nuova;
    if (nuova) salvaArchivio(archivio);
  }

  const impostazioni = await leggiImpostazioni();
  const decisione = decidiRichiesta({ config: impostazioni, archivio, nuova, forzata });
  console.info(`Recensione di fine partita: ${decisione.chiedere ? 'la chiedo' : 'non la chiedo'} (${decisione.motivo})`);
  if (!decisione.chiedere) return;

  await aspetta(RITARDO_APERTURA_MS);
  await aspettaVerdettoChiuso();
  await caricaStile();

  if (!forzata) salvaArchivio(segnaChiesta(leggiArchivioSalvato()));

  const giocatori = Array.isArray(stato.giocatori) ? stato.giocatori : [];
  const io = giocatori[mioId];
  mostraScheda({
    forzata,
    contesto: {
      versione: versioneDalPercorso(location.pathname),
      modalita: stato.modalita === 'veloce' ? 'veloce' : 'normale',
      giocatori: giocatori.length,
      junior: !!io && io.junior === true,
      partite: archivio.partite
    }
  });
}
