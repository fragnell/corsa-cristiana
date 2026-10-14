// mosaico.js
// Salmo 133:1 — il mosaico. Solo funzioni pure: un mosaico e' una lista di
// riquadri, ognuno con il SUO disegno (ogni disegno ha il proprio sfondo).
// La "soluzione" e' l'ordine giusto (quello che vede il primo); "mescolata"
// e' l'ordine di partenza dell'ultimo. Un ordine e' un semplice elenco di
// identificativi di disegni: la posizione nell'elenco e' la posizione nella
// griglia, da sinistra a destra e dall'alto in basso.
//
// Tutte le funzioni che usano il caso ricevono "rng" (una funzione che
// restituisce un numero tra 0 e 1): in pagina e' Math.random, nei test e'
// un generatore con il seme, cosi' le prove si possono ripetere uguali.

// Righe e colonne, il piu' quadrate possibile: 4 -> 2x2, 9 -> 3x3, 16 -> 4x4.
// Per numeri "strani" l'ultima riga puo' restare incompleta.
export function dimensioniGriglia(n) {
  let migliore = null;
  for (let r = 1; r * r <= n; r++) {
    if (n % r === 0) migliore = { righe: r, colonne: n / r };
  }
  if (migliore && migliore.colonne / migliore.righe <= 2) return migliore;
  const colonne = Math.ceil(Math.sqrt(n));
  return { righe: Math.ceil(n / colonne), colonne };
}

// Sceglie n disegni diversi tra quelli disponibili.
export function scegliDisegni(idDisponibili, n, rng = Math.random) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Numero di riquadri non valido: ${n}`);
  if (new Set(idDisponibili).size < n) {
    throw new Error(`Servono ${n} disegni diversi, ne ho ${new Set(idDisponibili).size}`);
  }
  const mazzo = [...new Set(idDisponibili)];
  for (let i = mazzo.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [mazzo[i], mazzo[j]] = [mazzo[j], mazzo[i]];
  }
  return mazzo.slice(0, n);
}

export function stessoOrdine(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Rimescola l'ordine: il risultato non e' mai gia' quello giusto (altrimenti
// la prova sarebbe gia' finita). Non garantisce altro.
export function mescola(ordine, rng = Math.random) {
  if (ordine.length < 2) return [...ordine];
  for (let tentativo = 0; tentativo < 50; tentativo++) {
    const copia = [...ordine];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    if (!stessoOrdine(copia, ordine)) return copia;
  }
  // Quasi impossibile arrivarci: scambio i primi due, che garantisce "diverso".
  const sicura = [...ordine];
  [sicura[0], sicura[1]] = [sicura[1], sicura[0]];
  return sicura;
}

// Scambia due riquadri (restituisce un nuovo elenco, l'originale non cambia).
export function scambia(ordine, i, j) {
  const valido = k => Number.isInteger(k) && k >= 0 && k < ordine.length;
  if (!valido(i) || !valido(j)) throw new Error(`Scambio non valido: ${i} <-> ${j}`);
  const copia = [...ordine];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

// Vero solo se i riquadri sono esattamente nell'ordine giusto.
export function ordineCorretto(ordine, soluzione) {
  return Array.isArray(ordine) && Array.isArray(soluzione) && stessoOrdine(ordine, soluzione);
}

// Controlla che un ordine mandato da un telefono sia "plausibile": stessi
// riquadri della soluzione, ognuno una volta sola (niente riquadri inventati
// o duplicati). Una consegna che non lo e' non conta come tentativo.
export function ordineValido(ordine, soluzione) {
  if (!Array.isArray(ordine) || !Array.isArray(soluzione)) return false;
  if (ordine.length !== soluzione.length) return false;
  const attesi = new Set(soluzione);
  const visti = new Set();
  for (const id of ordine) {
    if (!attesi.has(id) || visti.has(id)) return false;
    visti.add(id);
  }
  return true;
}

// Prepara una prova completa per un livello ({ riquadri: n, ... }).
export function creaProva(livello, idDisponibili, rng = Math.random) {
  const tessere = scegliDisegni(idDisponibili, livello.riquadri, rng);
  const { righe, colonne } = dimensioniGriglia(tessere.length);
  return { tessere, mescolata: mescola(tessere, rng), righe, colonne };
}

// Un piccolo generatore di numeri casuali con il seme (per i test).
export function generatoreConSeme(seme) {
  let a = seme | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
