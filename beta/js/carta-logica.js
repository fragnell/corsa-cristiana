// carta-logica.js
// La parte "di calcolo" delle carte sul tabellone, senza pagina: si prova con test-carta-logica.mjs.
//   - trovaDimensione: il testo della carta parte grande e si rimpicciolisce solo quanto serve per
//     entrare tutto (niente tagli, niente barre di scorrimento);
//   - rispostaGiustaDaMostrare: cosa scrivere come "risposta giusta" quando si sbaglia;
//   - testoSpostamento: la frase grande che annuncia quanto si e' mossa la pedina.

// Cerca la dimensione del testo piu' grande (tra "massima" e "minima") per cui il contenuto entra.
// "entra(dimensione)" prova una dimensione e dice se ci sta: la pagina la imposta e misura.
// Scende a passi del "passo" (es. 0.93 = 7% per volta), cosi' bastano pochi tentativi.
// Restituisce { dimensione, entra }: entra = false se nemmeno la minima basta (allora si scorre).
export function trovaDimensione(entra, { massima, minima, passo = 0.93 } = {}) {
  const max = Number(massima);
  const min = Number(minima);
  if (!(max > 0) || !(min > 0) || typeof entra !== 'function') return { dimensione: max > 0 ? max : min, entra: true };
  const fattore = passo > 0 && passo < 1 ? passo : 0.93;
  let dimensione = max;
  for (let giro = 0; giro < 60 && dimensione > min; giro++) {
    if (entra(dimensione)) return { dimensione, entra: true };
    dimensione = Math.max(min, dimensione * fattore);
  }
  return { dimensione: min, entra: !!entra(min) };
}

// La risposta giusta da mostrare quando qualcuno sbaglia. Per le risposte libere si mostra solo la
// prima (la principale): le altre sono modi diversi di dire la stessa cosa ("30", "Trenta",
// "30 monete"...), e scriverle tutte confonde. Per gli elenchi si mostrano tutte (sono l'elenco).
export function rispostaGiustaDaMostrare(carta) {
  if (!carta || typeof carta !== 'object') return '';
  if (carta.tipo === 'elenco') {
    return Array.isArray(carta.rispostePossibili) ? carta.rispostePossibili.filter(Boolean).join(', ') : '';
  }
  if (carta.tipo === 'scelta') return typeof carta.rispostaCorretta === 'string' ? carta.rispostaCorretta : '';
  if (Array.isArray(carta.risposta)) return String(carta.risposta.find(r => r) || '');
  return typeof carta.risposta === 'string' ? carta.risposta : '';
}

// "Anna avanza di 3 caselle" / "Bruno torna indietro di 1 casella" / "Anna resta sulla casella 12".
// etichettaCasella: come si scrive il numero di una casella sul tabellone (vedi etichettaPosizione).
export function testoSpostamento(nome, prima, dopo, etichettaCasella = n => String(n)) {
  const chi = String(nome || '').trim() || 'Il giocatore';
  const da = Number(prima);
  const a = Number(dopo);
  if (!Number.isFinite(da) || !Number.isFinite(a) || da === a) {
    return { testo: `${chi} resta sulla casella ${etichettaCasella(Number.isFinite(a) ? a : da)}`, verso: 'fermo' };
  }
  const passi = Math.abs(a - da);
  const caselle = passi === 1 ? '1 casella' : `${passi} caselle`;
  return a > da
    ? { testo: `${chi} avanza di ${caselle}`, verso: 'avanti' }
    : { testo: `${chi} torna indietro di ${caselle}`, verso: 'indietro' };
}

// I livelli del pulsante A− / A+ del tabellone (1 = dimensione normale).
export const LIVELLI_TESTO = [0.85, 1, 1.15, 1.3, 1.45];

export function livelloSuccessivo(attuale, verso) {
  const i = LIVELLI_TESTO.indexOf(Number(attuale));
  const da = i === -1 ? LIVELLI_TESTO.indexOf(1) : i;
  const nuovo = Math.min(LIVELLI_TESTO.length - 1, Math.max(0, da + (verso > 0 ? 1 : -1)));
  return LIVELLI_TESTO[nuovo];
}

export function livelloValido(valore) {
  const n = Number(valore);
  return LIVELLI_TESTO.includes(n) ? n : 1;
}
