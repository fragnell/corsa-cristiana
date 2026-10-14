// statistiche-attivita.js
// "Quanto si gioca": le partite di oggi, degli ultimi 7 e degli ultimi 30 giorni, giorno per
// giorno. Calcolo PURO (niente schermo, niente Firebase): riceve le partite così come sono
// salvate in "partite/<codice>" e l'ora di adesso, e restituisce i numeri. Funziona anche per
// il passato, perché le partite vecchie restano nel database.
//
// Come si conta (le stesse regole che la scheda Statistiche spiega a chi legge):
//  - una partita CONTA solo se è davvero iniziata: c'è stato almeno un lancio di dado
//    ("ultimoLancio" pieno) oppure c'è già un vincitore. Le lobby aperte e mai giocate no;
//  - è "di gruppo" se ci hanno giocato almeno 2 giocatori. Con 1 solo giocatore di solito è
//    una prova: si conta a parte ("daSolo") e non finisce mai dentro "partite";
//  - è CONCLUSA se c'è un vincitore ("vincitore" è un numero: anche 0, il primo giocatore);
//  - conta nel GIORNO in cui è stata aperta ("creataIl"; se manca, l'ultimo aggiornamento).
//    Senza nessuna data credibile conta solo nel totale;
//  - i giorni sono quelli di calendario del fuso orario di chi guarda.

export const GIORNI_GRAFICO = 30;
export const GIORNI_SETTIMANA = 7;
export const GIOCATORI_MINIMI_DI_GRUPPO = 2;

const UN_GIORNO_MS = 24 * 60 * 60 * 1000;

const dataValida = v => typeof v === 'number' && Number.isFinite(v) && v > 0;

// ---------------------------------------------------------------- giorni

// "2026-10-14": il giorno di calendario (fuso del dispositivo) di una data.
export function chiaveGiorno(data) {
  const mese = String(data.getMonth() + 1).padStart(2, '0');
  const giorno = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mese}-${giorno}`;
}

// Quanti giorni di calendario passano dalla chiave A alla chiave B (B - A). Non dipende dall'ora
// legale: un giorno da 23 o da 25 ore conta comunque 1.
export function giorniTra(chiaveA, chiaveB) {
  const [a1, a2, a3] = chiaveA.split('-').map(Number);
  const [b1, b2, b3] = chiaveB.split('-').map(Number);
  return Math.round((Date.UTC(b1, b2 - 1, b3) - Date.UTC(a1, a2 - 1, a3)) / UN_GIORNO_MS);
}

// Gli ultimi "quanti" giorni, dal piu' vecchio a oggi. Ogni giorno nasce a mezzanotte locale
// (new Date(anno, mese, giorno - i) tiene conto da solo dell'ora legale e dei cambi di mese).
function costruisciGiorni(ora, quanti) {
  const adesso = new Date(ora);
  const giorni = [];
  for (let i = quanti - 1; i >= 0; i--) {
    const inizio = new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate() - i);
    giorni.push({ chiave: chiaveGiorno(inizio), inizio: inizio.getTime(), ...nuovoConteggio() });
  }
  return giorni;
}

// ---------------------------------------------------------------- una partita

export function contaGiocatori(giocatori) {
  let elenco = [];
  if (Array.isArray(giocatori)) elenco = giocatori;
  else if (giocatori && typeof giocatori === 'object') elenco = Object.values(giocatori);
  return elenco.filter(g => g && typeof g === 'object').length;
}

// Da una partita salvata a quello che serve per contarla. Restituisce null se non e' una partita
// "giocata" (nessuno stato, nessun giocatore, mai iniziata): in quel caso non si conta da nessuna parte.
export function leggiPartita(grezza) {
  if (!grezza || typeof grezza !== 'object') return null;
  const stato = grezza.stato;
  if (!stato || typeof stato !== 'object') return null;

  const giocatori = contaGiocatori(stato.giocatori);
  if (giocatori < 1) return null;

  const conclusa = Number.isInteger(stato.vincitore);
  const iniziata = conclusa || Number.isFinite(stato.ultimoLancio);
  if (!iniziata) return null;

  let quando = null;
  if (dataValida(grezza.creataIl)) quando = grezza.creataIl;
  else if (dataValida(stato.ultimoAggiornamento)) quando = stato.ultimoAggiornamento;

  return { quando, giocatori, conclusa, veloce: stato.modalita === 'veloce' };
}

// ---------------------------------------------------------------- conteggi

function nuovoConteggio() {
  return { partite: 0, concluse: 0, giocatori: 0, daSolo: 0, veloci: 0 };
}

function conta(conteggio, partita) {
  if (partita.giocatori >= GIOCATORI_MINIMI_DI_GRUPPO) {
    conteggio.partite++;
    conteggio.giocatori += partita.giocatori;
    if (partita.conclusa) conteggio.concluse++;
    if (partita.veloce) conteggio.veloci++;
  } else {
    conteggio.daSolo++;
  }
}

function somma(giorni) {
  const totale = nuovoConteggio();
  for (const g of giorni) {
    totale.partite += g.partite;
    totale.concluse += g.concluse;
    totale.giocatori += g.giocatori;
    totale.daSolo += g.daSolo;
    totale.veloci += g.veloci;
  }
  return totale;
}

// ---------------------------------------------------------------- il calcolo

// partite: l'oggetto "partite" di Firebase (codice -> partita). adesso: millisecondi.
export function calcolaAttivita(partite, adesso) {
  const ora = Number.isFinite(adesso) ? adesso : Date.now();
  const giorni = costruisciGiorni(ora, GIORNI_GRAFICO);
  const posizione = new Map(giorni.map((g, i) => [g.chiave, i]));

  const totale = { ...nuovoConteggio(), senzaData: 0 };
  let ultima = null;

  const elenco = partite && typeof partite === 'object' ? Object.values(partite) : [];
  for (const grezza of elenco) {
    const partita = leggiPartita(grezza);
    if (!partita) continue;
    conta(totale, partita);

    // Una data di piu' di un giorno nel futuro viene da un orologio sbagliato: non e' credibile.
    if (partita.quando === null || partita.quando > ora + UN_GIORNO_MS) {
      totale.senzaData++;
      continue;
    }

    const diGruppo = partita.giocatori >= GIOCATORI_MINIMI_DI_GRUPPO;
    if (diGruppo && (ultima === null || partita.quando > ultima.quando)) {
      ultima = { quando: partita.quando, giocatori: partita.giocatori, conclusa: partita.conclusa, veloce: partita.veloce };
    }

    const indice = posizione.get(chiaveGiorno(new Date(partita.quando)));
    if (indice !== undefined) conta(giorni[indice], partita);
  }

  return {
    adesso: ora,
    oggi: somma(giorni.slice(-1)),
    settimana: somma(giorni.slice(-GIORNI_SETTIMANA)),
    mese: somma(giorni),
    totale,
    giorni,
    giorniAttivi: giorni.filter(g => g.partite > 0).length,
    ultima
  };
}

// ---------------------------------------------------------------- parole

export function plurale(n, uno, molti) {
  return n === 1 ? uno : molti;
}

const LOCALE = 'it-IT';

// "mer 14 ott" (breve) oppure "mercoledì 14 ottobre" (lungo); con anno = true aggiunge l'anno.
export function formattaGiorno(data, { lungo = false, anno = false } = {}) {
  const parti = new Intl.DateTimeFormat(LOCALE, {
    weekday: lungo ? 'long' : 'short',
    day: 'numeric',
    month: lungo ? 'long' : 'short',
    year: anno ? 'numeric' : undefined
  }).formatToParts(data);
  const valore = tipo => (parti.find(p => p.type === tipo) || { value: '' }).value;
  return [valore('weekday'), valore('day'), valore('month'), anno ? valore('year') : ''].filter(Boolean).join(' ');
}

// "14/10": per l'asse del grafico.
export function etichettaAsse(data) {
  return `${data.getDate()}/${data.getMonth() + 1}`;
}

export function formattaOra(data) {
  return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(data);
}

// "oggi alle 15:11", "ieri alle 21:04", "domenica 11 ottobre alle 16:17 (3 giorni fa)".
export function descriviQuando(quando, adesso) {
  const data = new Date(quando);
  const fa = giorniTra(chiaveGiorno(data), chiaveGiorno(new Date(adesso)));
  const ora = formattaOra(data);
  if (fa <= 0) return `oggi alle ${ora}`;
  if (fa === 1) return `ieri alle ${ora}`;
  const stessoAnno = data.getFullYear() === new Date(adesso).getFullYear();
  return `${formattaGiorno(data, { lungo: true, anno: !stessoAnno })} alle ${ora} (${fa} giorni fa)`;
}
