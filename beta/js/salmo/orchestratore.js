// orchestratore.js
// Salmo 133:1 — il "regista" della prova, che vive sul tabellone.
// Guida tutte le fasi, una dopo l'altra:
//
//   pronti    i due premono «Sono pronto» (entro prontoMs)
//   anteprima il primo guarda l'immagine; l'ultimo NON deve guardare
//   prova     il primo descrive a voce, l'ultimo ricostruisce sul telefono
//   esito     successo, fallimento oppure "prova annullata"
//
// Regole d'oro di questo file:
//   1. Non lancia MAI un errore verso chi lo chiama: qualunque cosa vada
//      storta (telefono che sparisce, rete che cade, dati rovinati...) la
//      prova si ANNULLA senza conseguenze e la partita riprende normalmente.
//   2. Non conosce ne' Firebase ne' la pagina: tutto cio' che tocca il mondo
//      esterno (rete, schermo, suoni, orologio) arriva dall'oggetto
//      "ambiente". Cosi' si puo' collaudare con orologio e telefoni finti.
//   3. Alla fine rimette tutto a posto (ascolti staccati, musica, schermo,
//      nodi su Firebase) anche se la prova e' finita male.
//
// Lo stato della partita NON viene pubblicato alla fine: lo restituisce a chi
// ci ha chiamato, che lo pubblica insieme al passaggio di turno.

import { applicaEsitoSalmo } from './esito.js';
import {
  eProntoDi,
  consegnaNumero,
  sbirciataFatta,
  valutaConsegna,
  senzaUndefined,
  GRAZIA_CONSEGNA_FINALE_MS,
  DURATA_ANNULLAMENTO_MS,
  MARGINE_ANIMAZIONE_MS
} from './sessione.js';
import { conLimite } from './tempo.js';

// (lo riesportiamo: i collaudi lo usano da qui)
export { conLimite };

// Ogni quanto il regista guarda cosa e' successo.
export const PASSO_MS = 200;
// Un telefono che risulta disconnesso per meno di cosi' e' solo "una scossa"
// (una ricarica di pagina, un attimo senza campo, lo schermo che si e' spento e
// si riaccende): si aspetta.
export const TOLLERANZA_PRESENZA_MS = 20000;
// Quanto aspettare, al massimo, che Firebase confermi una scrittura.
export const LIMITE_PUBBLICAZIONE_MS = 6000;
export const LIMITE_RETE_MS = 5000;
export const LIMITE_PULIZIA_MS = 3000;
// Margine sul cronometro "locale" di ogni fase (rete di sicurezza se l'orologio
// del server si comportasse in modo strano).
export const MARGINE_LOCALE_MS = 15000;

function dormi(ms) {
  return new Promise(risolvi => setTimeout(risolvi, ms));
}

// Esegue una funzione dell'interfaccia (schermo, suoni...) senza mai lasciare
// che un suo errore fermi la prova.
function sicuro(funzione) {
  try {
    return funzione();
  } catch (errore) {
    console.warn('Salmo: errore ignorato nell\'interfaccia', errore);
    return undefined;
  }
}

function senzaSalmoInCorso(stato) {
  if (!stato) return stato;
  const copia = { ...stato };
  delete copia.salmoInCorso;
  return copia;
}

const AVANTI = Symbol('avanti');

// Svolge una prova dall'inizio alla fine.
//   decisione  il risultato di valutaSalmo (scatta: true): { primo, ultimo, livello, ... }
//   cfg        la configurazione del Salmo (gia' resa sicura)
//   sessione   il risultato di creaSessione
//   ambiente   le dipendenze (vedi sotto)
//   segnale    { annullato: false }: se qualcuno mette annullato = true, il regista
//              si ferma al prossimo passo (serve al "guardiano" esterno)
//
// ambiente = {
//   adesso()                ora del server, in millisecondi
//   getStato() / setStato(s) lo stato vivo della partita sul tabellone
//   pubblica(stato)         pubblica lo stato su Firebase (promessa)
//   ultimaCasella           numero dell'ultima casella del percorso
//   presente(id)            false = il dispositivo di quel giocatore risulta disconnesso
//   rete: { scriviSegreti(sessione), ascolta(sid, callback) -> funzioneDiStop, pulisci() }
//   ui:   { mostra(vista), nascondi(), suono(nome), abbassaMusica(), ripristinaMusica(), anima(spostamenti) }
// }
//
// Restituisce sempre un oggetto:
//   { esito: 'successo' | 'fallimento' | 'annullato', motivo, stato, turnoPassato,
//     spostamenti, tentativi, sbirciata, durataMs, livello }
export async function svolgiSalmo({ decisione, cfg, sessione, ambiente, segnale }) {
  const stop = segnale || { annullato: false };
  const { adesso, rete, ui } = ambiente;
  const base = sessione.pubblica;
  const sid = base.id;
  const primoId = decisione.primo;
  const ultimoId = decisione.ultimo;
  const inizio = adesso();

  let risposte = {};
  let staccaAscolto = null;
  let musicaAbbassata = false;
  let pubblicaCorrente = base;
  let tentativiFatti = 0;
  let sbirciata = false;
  let primoPronto = false;
  let ultimoPronto = false;
  const assenteDa = { primo: null, ultimo: null };

  const annullata = motivo => ({ esito: 'annullato', motivo });

  // L'ultimo stato della partita che abbiamo visto con certezza: serve come
  // ancora di salvezza se, per qualche guasto, lo stato vivo non si lascia leggere.
  let ultimoNoto = null;
  try { ultimoNoto = ambiente.getStato(); } catch (errore) { /* si vedra' dopo */ }
  function statoVivoOUltimoNoto() {
    try {
      const vivo = ambiente.getStato();
      if (vivo) { ultimoNoto = vivo; return vivo; }
    } catch (errore) { /* uso l'ultimo noto */ }
    return ultimoNoto;
  }

  function nomeDi(id) {
    const giocatore = ambiente.getStato().giocatori[id];
    return giocatore ? giocatore.nome : '?';
  }

  // ---------- interfaccia (mai bloccante) ----------

  function mostra(fase, extra = {}) {
    if (stop.annullato) return;
    // La soluzione non arriva MAI allo schermo del tabellone.
    const { soluzione: _nonMostrare, ...pubblicaSenzaSoluzione } = pubblicaCorrente;
    sicuro(() => ui.mostra({
      ...pubblicaSenzaSoluzione,
      fase,
      primoNome: nomeDi(primoId),
      ultimoNome: nomeDi(ultimoId),
      primoPronto,
      ultimoPronto,
      tentativiFatti,
      ...extra
    }));
  }

  function abbassaMusica() {
    musicaAbbassata = true;
    sicuro(() => ui.abbassaMusica());
  }

  function ripristinaMusica() {
    if (!musicaAbbassata) return;
    musicaAbbassata = false;
    sicuro(() => ui.ripristinaMusica());
  }

  // ---------- pubblicare una fase ----------

  // Mette la fase nello stato della partita e la pubblica. Lo stato vivo viene
  // riletto ogni volta (puo' essere cambiato nel frattempo, ad esempio per un
  // abbandono). Restituisce true se Firebase ha confermato in tempo.
  async function pubblicaFase(fase, extra = {}) {
    // Dopo uno stop forzato il tabellone e' gia' andato avanti: pubblicare
    // ancora riporterebbe sui telefoni una prova che non esiste piu'.
    if (stop.annullato) return false;
    pubblicaCorrente = { ...base, ...extra, fase };
    const nuovo = {
      ...ambiente.getStato(),
      turnoInCorso: true,
      salmoInCorso: senzaUndefined(pubblicaCorrente)
    };
    ambiente.setStato(nuovo);
    ultimoNoto = nuovo;
    try {
      await conLimite(() => ambiente.pubblica(nuovo), LIMITE_PUBBLICAZIONE_MS);
      return true;
    } catch (errore) {
      console.warn('Salmo: pubblicazione non riuscita', errore);
      return false;
    }
  }

  // ---------- controlli di sicurezza ----------

  function assente(ruolo, id, ora, tolleranza = TOLLERANZA_PRESENZA_MS) {
    if (ambiente.presente(id) !== false) {
      assenteDa[ruolo] = null;
      return false;
    }
    if (assenteDa[ruolo] === null) assenteDa[ruolo] = ora;
    return ora - assenteDa[ruolo] >= tolleranza;
  }

  // L'anteprima e' breve: se il primo manca per piu' della meta' del tempo, l'immagine
  // non l'ha vista davvero (e comunque mai oltre la tolleranza normale).
  const tolleranzaPrimoInAnteprima = Math.min(TOLLERANZA_PRESENZA_MS, Math.floor(base.anteprimaMs / 2));

  // C'e' qualcosa che rende la prova impossibile? Restituisce il motivo, o null.
  function anomalia(fase) {
    const stato = ambiente.getStato();
    if (!stato) return 'errore-interno';
    if (stato.vincitore != null) return 'partita-finita';
    const primo = stato.giocatori[primoId];
    const ultimo = stato.giocatori[ultimoId];
    if (!primo || !ultimo) return 'giocatore-assente';
    if (primo.abbandonato || ultimo.abbandonato) return 'abbandono';
    const ora = adesso();
    if (ora > base.scadenzaMassima) return 'timeout-generale';
    // Mentre i due si preparano ("pronti") nessuno e' ancora "dentro" la prova: un telefono
    // con lo schermo spento risulta scollegato, ma la persona lo riprende in mano e preme
    // «Sono pronto» (c'e' tempo fino a prontoMs). Chi non lo fa viene gestito li'.
    if (fase === 'pronti') return null;
    if (assente('ultimo', ultimoId, ora)) return 'ultimo-disconnesso';
    // Il primo serve solo finche' guarda l'immagine; poi descrive a voce.
    if (fase === 'anteprima' && assente('primo', primoId, ora, tolleranzaPrimoInAnteprima)) {
      return 'primo-disconnesso';
    }
    return null;
  }

  // Aspetta, a piccoli passi, finche' "controlla" restituisce qualcosa.
  //   undefined  -> continua ad aspettare
  //   AVANTI     -> la fase e' finita bene
  //   un oggetto { esito, motivo } -> la prova finisce cosi'
  async function aspetta(controlla, limiteLocaleMs) {
    const partenza = Date.now();
    for (;;) {
      if (stop.annullato) return annullata('fermato');
      const risultato = await controlla();
      if (risultato !== undefined) return risultato;
      if (Date.now() - partenza > limiteLocaleMs) return annullata('timeout-generale');
      await dormi(PASSO_MS);
    }
  }

  // ---------- le fasi ----------

  async function fasePronti() {
    const scadenza = adesso() + cfg.prontoMs;
    if (!(await pubblicaFase('pronti', { scadenza }))) return annullata('errore-rete');
    mostra('pronti');

    const r = await aspetta(async () => {
      const problema = anomalia('pronti');
      if (problema) return annullata(problema);

      const pp = eProntoDi(risposte, primoId);
      const up = eProntoDi(risposte, ultimoId);
      if (pp !== primoPronto || up !== ultimoPronto) {
        primoPronto = pp;
        ultimoPronto = up;
        mostra('pronti');
      }
      if (pp && up) return AVANTI;
      if (adesso() >= scadenza) {
        if (!pp && !up) return annullata('nessuno-pronto');
        return annullata(pp ? 'ultimo-non-pronto' : 'primo-non-pronto');
      }
      return undefined;
    }, cfg.prontoMs + MARGINE_LOCALE_MS);

    return r === AVANTI ? null : r;
  }

  async function faseAnteprima() {
    const scadenza = adesso() + base.anteprimaMs;
    if (!(await pubblicaFase('anteprima', { scadenza }))) return annullata('errore-rete');
    mostra('anteprima');

    const r = await aspetta(async () => {
      const problema = anomalia('anteprima');
      if (problema) return annullata(problema);
      if (adesso() >= scadenza) return AVANTI;
      return undefined;
    }, base.anteprimaMs + MARGINE_LOCALE_MS);

    return r === AVANTI ? null : r;
  }

  // Restituisce sempre { esito, motivo }.
  async function faseProva() {
    const fine = adesso() + base.provaMs;
    if (!(await pubblicaFase('prova', { scadenza: fine, tentativiFatti: 0 }))) {
      return annullata('errore-rete');
    }
    abbassaMusica();
    mostra('prova');

    return aspetta(async () => {
      if (!sbirciata && sbirciataFatta(risposte)) sbirciata = true;

      const problema = anomalia('prova');
      if (problema) return annullata(problema);

      // L'ultima consegna che aspettiamo e' quella del tentativo in corso.
      const consegna = consegnaNumero(risposte, tentativiFatti);
      if (consegna !== null) {
        const verdetto = valutaConsegna(consegna, sessione.soluzione);
        if (verdetto === 'giusta') return { esito: 'successo', motivo: 'ordine-giusto' };
        if (verdetto === 'sbagliata') {
          tentativiFatti += 1;
          if (tentativiFatti >= base.tentativiMax) {
            return { esito: 'fallimento', motivo: 'tentativi-esauriti' };
          }
          if (adesso() >= fine) return { esito: 'fallimento', motivo: 'tempo-scaduto' };
          // Avviso il telefono che c'e' un altro tentativo. Se la rete non
          // risponde, meglio annullare che lasciarlo in attesa.
          if (!(await pubblicaFase('prova', { scadenza: fine, tentativiFatti }))) {
            return annullata('errore-rete');
          }
          mostra('prova');
          return undefined;
        }
        // 'non-valida': dato rovinato, non conta come tentativo. Si aspetta
        // che il telefono ne mandi una buona.
      }

      // Tempo scaduto: il telefono dell'ultimo consegna da solo quello che ha
      // fatto; il tabellone gli concede qualche secondo per farla arrivare.
      if (adesso() >= fine + GRAZIA_CONSEGNA_FINALE_MS) {
        if (ambiente.presente(ultimoId) === false) return annullata('ultimo-disconnesso');
        return { esito: 'fallimento', motivo: 'tempo-scaduto' };
      }
      return undefined;
    }, base.provaMs + GRAZIA_CONSEGNA_FINALE_MS + MARGINE_LOCALE_MS);
  }

  // Quanto cambia la partita con questo esito (solo per i testi sullo schermo:
  // lo spostamento vero si calcola alla fine, sullo stato piu' fresco).
  function anteprimaSpostamento(esito) {
    const r = applicaEsitoSalmo(
      ambiente.getStato(), { primoId, ultimoId, esito }, cfg, ambiente.ultimaCasella
    );
    const mosso = r.spostamenti.find(s => s.id === (esito === 'successo' ? ultimoId : primoId));
    return mosso ? Math.abs(mosso.a - mosso.da) : 0;
  }

  async function faseEsito({ esito, motivo }) {
    ripristinaMusica();
    const durata = esito === 'annullato' ? DURATA_ANNULLAMENTO_MS : base.esitoMs;
    const scadenza = adesso() + durata;
    const spostamento = anteprimaSpostamento(esito);

    const extra = { scadenza, esito, motivo, spostamento, tentativiFatti };
    if (esito !== 'annullato') extra.soluzione = sessione.soluzione;
    await pubblicaFase('esito', extra);   // se non conferma, si procede lo stesso

    if (esito === 'successo') sicuro(() => ui.suono('corretto'));
    if (esito === 'fallimento') sicuro(() => ui.suono('sbagliato'));
    mostra('esito', { esito, motivo, spostamento });

    await aspetta(async () => (adesso() >= scadenza ? AVANTI : undefined), durata + MARGINE_LOCALE_MS);
  }

  // ---------- il filo conduttore ----------

  let risultato = annullata('errore-interno');
  let finale = null;
  let spostamenti = [];
  let turnoPassato = false;

  try {
    // Prima di tutto: ripulisco eventuali avanzi (anche un vecchio "TIRA_DADO"
    // rimasto nella casella delle intenzioni) e metto i segreti al sicuro,
    // PRIMA che qualunque telefono veda la prova.
    let partenzaOk = true;
    try {
      await conLimite(() => rete.pulisci(), LIMITE_PULIZIA_MS);
      await conLimite(() => rete.scriviSegreti(sessione), LIMITE_RETE_MS);
    } catch (errore) {
      console.warn('Salmo: preparazione non riuscita', errore);
      partenzaOk = false;
    }

    if (!partenzaOk) {
      risultato = annullata('errore-rete');
    } else {
      staccaAscolto = rete.ascolta(sid, nuove => { risposte = nuove || {}; });

      risultato = (await fasePronti()) || (await faseAnteprima()) || (await faseProva());
    }

    if (partenzaOk) {
      await faseEsito(risultato);
    }
  } catch (errore) {
    console.warn('Salmo: errore imprevisto, prova annullata', errore);
    risultato = annullata('errore-interno');
  } finally {
    if (staccaAscolto) sicuro(staccaAscolto);
    ripristinaMusica();
    sicuro(() => ui.nascondi());
  }

  // Lo stato finale si calcola ADESSO, sullo stato piu' fresco, e non e' mai
  // un motivo di errore: se qualcosa non va, la partita riprende com'era.
  try {
    const vivo = statoVivoOUltimoNoto();
    const r = applicaEsitoSalmo(
      vivo, { primoId, ultimoId, esito: risultato.esito }, cfg, ambiente.ultimaCasella
    );
    spostamenti = r.spostamenti;
    turnoPassato = r.turnoPassato;
    finale = senzaSalmoInCorso(r.stato);

    if (spostamenti.length > 0 && !stop.annullato) {
      try {
        await conLimite(() => ui.anima(spostamenti), MARGINE_ANIMAZIONE_MS);
      } catch (errore) {
        console.warn('Salmo: animazione non riuscita', errore);
      }
    }
  } catch (errore) {
    console.warn('Salmo: stato finale non calcolabile, nessuna modifica', errore);
    finale = senzaSalmoInCorso(statoVivoOUltimoNoto());
    spostamenti = [];
    turnoPassato = false;
    risultato = annullata('errore-interno');
  }

  // Pulizia finale su Firebase. Va finita PRIMA di restituire il controllo:
  // dopo, il giocatore di turno potra' tirare il dado e la sua intenzione non
  // deve essere cancellata per sbaglio.
  if (!stop.annullato) {
    try {
      await conLimite(() => rete.pulisci(), LIMITE_PULIZIA_MS);
    } catch (errore) {
      console.warn('Salmo: pulizia finale non riuscita', errore);
    }
  }

  return {
    esito: risultato.esito,
    motivo: risultato.motivo,
    stato: finale,
    turnoPassato,
    spostamenti,
    tentativi: tentativiFatti,
    sbirciata,
    durataMs: adesso() - inizio,
    livello: decisione.livello
  };
}
