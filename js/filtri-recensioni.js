// filtri-recensioni.js
// Il "cervello" della scheda Recensioni dell'Admin. Non tocca la pagina: riceve l'elenco delle
// recensioni arrivate e i filtri scelti, e restituisce quelle da mostrare, il riepilogo (media,
// quante per ogni voto...) e le righe per il file Excel. Cosi' si prova con i test, senza browser.
//
// I filtri sono un semplice oggetto:
//   { testo: '', stelle: 'tutte', commento: 'tutte', modalita: 'tutte', versione: 'tutte', ordine: 'recenti' }
//   testo:     le parole cercate nel commento e nel soprannome (devono esserci tutte)
//   stelle:    'tutte' | '5' | '4' | '3' | '2' | '1'
//   commento:  'tutte' | 'con' (solo quelle con un commento scritto)
//   modalita:  'tutte' | 'normale' | 'veloce'
//   versione:  'tutte' | 'beta' | 'ufficiale'
//   ordine:    'recenti' | 'vecchie' | 'basse' (voto piu' basso per primo) | 'alte' (voto piu' alto per primo)

import { normalizzaTesto } from './filtri-carte.js';
import { STELLE_MINIME, STELLE_MASSIME } from './recensioni-logica.js';

export const FILTRI_RECENSIONI_INIZIALI = Object.freeze({ testo: '', stelle: 'tutte', commento: 'tutte', modalita: 'tutte', versione: 'tutte', ordine: 'recenti' });

// ---------- leggere una recensione (anche se i dati sono un po' strani) ----------

// Il voto: un numero intero da 1 a 5, oppure 0 se i dati non vanno bene.
export function votoDi(recensione) {
  const n = Number(recensione && recensione.stelle);
  return Number.isInteger(n) && n >= STELLE_MINIME && n <= STELLE_MASSIME ? n : 0;
}

export function commentoDi(recensione) {
  return recensione && typeof recensione.commento === 'string' ? recensione.commento.trim() : '';
}

// Il soprannome con cui e' firmata (quelle arrivate prima, o con la spunta spenta, non ce l'hanno: '').
// E' scritto dai telefoni e quindi va sempre mostrato come semplice testo, mai interpretato come pagina.
export function nomeDi(recensione) {
  return recensione && typeof recensione.nome === 'string' ? recensione.nome.trim() : '';
}

export function modalitaDi(recensione) {
  return recensione && recensione.modalita === 'veloce' ? 'veloce' : 'normale';
}

// 'beta' | 'ufficiale' | 'sconosciuta'
export function versioneDi(recensione) {
  if (recensione && recensione.versione === 'beta') return 'beta';
  if (recensione && recensione.versione === 'ufficiale') return 'ufficiale';
  return 'sconosciuta';
}

export function dataDi(recensione) {
  const n = Number(recensione && recensione.creataIl);
  return Number.isFinite(n) ? n : 0;
}

// "★★★★☆" per 4 su 5
export function etichettaStelle(voto) {
  const v = Number.isInteger(voto) ? Math.max(0, Math.min(STELLE_MASSIME, voto)) : 0;
  return '★'.repeat(v) + '☆'.repeat(STELLE_MASSIME - v);
}

// { data: '2026-10-14', ora: '10:32' } con l'orologio di chi guarda; vuote se la data non c'e'.
export function dataEOra(millisecondi) {
  if (!Number.isFinite(millisecondi) || millisecondi <= 0) return { data: '', ora: '' };
  const d = new Date(millisecondi);
  const due = n => String(n).padStart(2, '0');
  return {
    data: `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`,
    ora: `${due(d.getHours())}:${due(d.getMinutes())}`
  };
}

// ---------- il riepilogo ----------

// { totale, votate, media (un decimale, o null), distribuzione: {1..5}, conCommento, ultima }
export function riassumi(lista) {
  const distribuzione = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let somma = 0;
  let votate = 0;
  let conCommento = 0;
  let ultima = 0;
  const elenco = Array.isArray(lista) ? lista : [];
  for (const r of elenco) {
    const voto = votoDi(r);
    if (voto > 0) { distribuzione[voto]++; somma += voto; votate++; }
    if (commentoDi(r)) conCommento++;
    ultima = Math.max(ultima, dataDi(r));
  }
  return {
    totale: elenco.length,
    votate,
    media: votate > 0 ? Math.round((somma / votate) * 10) / 10 : null,
    distribuzione,
    conCommento,
    ultima: ultima > 0 ? ultima : null
  };
}

// I numeri mostrati accanto ai pulsanti dei filtri (su tutte le recensioni, senza filtri).
export function contaRecensioni(lista) {
  const conti = {
    totale: 0, conCommento: 0,
    stelle: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    modalita: { normale: 0, veloce: 0 },
    versione: { beta: 0, ufficiale: 0 }
  };
  for (const r of Array.isArray(lista) ? lista : []) {
    conti.totale++;
    if (commentoDi(r)) conti.conCommento++;
    const voto = votoDi(r);
    if (voto > 0) conti.stelle[voto]++;
    conti.modalita[modalitaDi(r)]++;
    const versione = versioneDi(r);
    if (versione !== 'sconosciuta') conti.versione[versione]++;
  }
  return conti;
}

// ---------- filtrare e ordinare ----------

const VOTI_DEL_FILTRO = ['1', '2', '3', '4', '5'];

// True se la recensione passa i filtri. Un valore di filtro che non si conosce vale come "nessun filtro".
export function corrisponde(recensione, filtri) {
  const f = { ...FILTRI_RECENSIONI_INIZIALI, ...(filtri || {}) };

  if (VOTI_DEL_FILTRO.includes(String(f.stelle)) && votoDi(recensione) !== Number(f.stelle)) return false;
  if (f.commento === 'con' && !commentoDi(recensione)) return false;
  if ((f.modalita === 'normale' || f.modalita === 'veloce') && modalitaDi(recensione) !== f.modalita) return false;
  if ((f.versione === 'beta' || f.versione === 'ufficiale') && versioneDi(recensione) !== f.versione) return false;

  const parole = normalizzaTesto(f.testo).split(' ').filter(Boolean);
  if (parole.length > 0) {
    const testo = normalizzaTesto(`${commentoDi(recensione)} ${nomeDi(recensione)}`);   // si cerca nel commento e nel soprannome
    if (!parole.every(parola => testo.includes(parola))) return false;
  }
  return true;
}

// Mette le recensioni nell'ordine scelto. Non modifica l'elenco ricevuto.
// A parita' di voto (o di data) restano prima le piu' recenti.
export function ordinaRecensioni(lista, ordine) {
  const copia = [...lista];
  const piuRecentiPrima = (a, b) => dataDi(b) - dataDi(a);
  if (ordine === 'vecchie') return copia.sort((a, b) => dataDi(a) - dataDi(b));
  if (ordine === 'basse') {
    return copia.sort((a, b) => ((votoDi(a) || 99) - (votoDi(b) || 99)) || piuRecentiPrima(a, b));
  }
  if (ordine === 'alte') {
    return copia.sort((a, b) => (votoDi(b) - votoDi(a)) || piuRecentiPrima(a, b));
  }
  return copia.sort(piuRecentiPrima);   // 'recenti' (o qualsiasi altro valore)
}

// Le recensioni da mostrare: prima si filtra, poi si ordina.
export function filtraRecensioni(lista, filtri) {
  const f = { ...FILTRI_RECENSIONI_INIZIALI, ...(filtri || {}) };
  return ordinaRecensioni((Array.isArray(lista) ? lista : []).filter(r => corrisponde(r, f)), f.ordine);
}

// Quanti filtri sono accesi (la ricerca conta uno se c'e' qualcosa scritto): per il pulsante "Azzera".
export function filtriAttivi(filtri) {
  const f = { ...FILTRI_RECENSIONI_INIZIALI, ...(filtri || {}) };
  let n = 0;
  if (normalizzaTesto(f.testo) !== '') n++;
  if (VOTI_DEL_FILTRO.includes(String(f.stelle))) n++;
  if (f.commento === 'con') n++;
  if (f.modalita === 'normale' || f.modalita === 'veloce') n++;
  if (f.versione === 'beta' || f.versione === 'ufficiale') n++;
  return n;
}

// ---------- il file Excel ----------

// Una riga per recensione, dalla piu' vecchia alla piu' recente, con le intestazioni in italiano.
export function righeExcel(lista) {
  return ordinaRecensioni(Array.isArray(lista) ? lista : [], 'vecchie').map(r => {
    const { data, ora } = dataEOra(dataDi(r));
    return {
      'Data': data,
      'Ora': ora,
      'Soprannome': nomeDi(r),
      'Stelle': votoDi(r) || '',
      'Commento': commentoDi(r),
      'Modalità': modalitaDi(r) === 'veloce' ? 'Veloce' : 'Normale',
      'Giocatori': Number.isInteger(r && r.giocatori) ? r.giocatori : '',
      'Junior': r && r.junior === true ? 'sì' : '',
      'Versione': versioneDi(r) === 'sconosciuta' ? '' : versioneDi(r),
      'Partite fatte': Number.isInteger(r && r.partite) ? r.partite : ''
    };
  });
}
