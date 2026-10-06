// mazzi.js
// Mescola, pesca, scarta e rimescola un mazzo di carte.
// Funziona per qualunque mazzo (Conoscenza, Imprevisto, Prova):
// basta dargli l'elenco di carte giusto.

// Mescola un array senza modificare l'originale (algoritmo di Fisher-Yates:
// scorre l'array dalla fine e scambia ogni carta con una scelta a caso
// tra quelle non ancora sistemate).
export function mescola(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Crea un mazzo pronto all'uso, già mescolato.
export function creaMazzo(carte) {
  if (!carte || carte.length === 0) {
    throw new Error('Non si può creare un mazzo vuoto.');
  }
  return {
    pescabili: mescola(carte),
    scarti: []
  };
}

// Pesca la prima carta disponibile. Se il mazzo è finito, rimescola gli
// scarti e riparte da lì — così una carta non si ripete mai finché non
// sono uscite tutte le altre.
export function pesca(mazzo) {
  let pescabili = mazzo.pescabili;
  let scarti = mazzo.scarti;

  if (pescabili.length === 0) {
    if (scarti.length === 0) {
      throw new Error('Il mazzo è completamente vuoto: nessuna carta da pescare.');
    }
    const ultimaScartata = scarti[scarti.length - 1];
    pescabili = mescola(scarti);
    // Evita che il nuovo giro riproponga subito, come prima carta,
    // quella appena uscita: se càpita per caso, la scambiamo con
    // un'altra posizione pescata a caso nel mazzo.
    if (pescabili.length > 1 && pescabili[0] === ultimaScartata) {
      const scambio = 1 + Math.floor(Math.random() * (pescabili.length - 1));
      [pescabili[0], pescabili[scambio]] = [pescabili[scambio], pescabili[0]];
    }
    scarti = [];
  }

  const [carta, ...restanti] = pescabili;

  const nuovoMazzo = {
    pescabili: restanti,
    scarti: [...scarti, carta]
  };

  return { mazzo: nuovoMazzo, carta };
}


// --- Pescata "a rotazione", pensata per Conoscenza ---
// A differenza di mescola/creaMazzo/pesca (che restano invariate per
// Imprevisto e Prova), qui non si mescola e basta: ogni domanda ricorda
// in quale partita e' uscita l'ultima volta (numero progressivo, salvato
// nel browser del tabellone: vedi rotazione-domande.js) e le domande che
// mancano da piu' tempo escono per prime. E' una vera rotazione: una
// domanda gia' uscita non torna finche' non sono uscite le altre, e vale
// sia dentro la stessa partita sia tra una partita e la successiva, con lo
// stesso identico meccanismo (l'unica eccezione e' qualche domanda nuova
// che slitta di qualche posto: vedi il punto 2 qui sotto).
//
// Prima si contava quante volte era uscita ciascuna ("meno usata per
// prima"), ma quel numero misura l'equita' totale, non la freschezza: con
// un mazzo sbilanciato (domande appena aggiunte, statistiche azzerate,
// domande cambiate con "Cambia domanda" che non venivano contate) le
// domande appena uscite restavano le meno usate, e la partita dopo
// ricominciava proprio da quelle.
//
// Come funziona: a inizio partita si prepara UNA VOLTA l'ordine in cui
// usciranno le domande (la "coda"); poi si pesca sempre la prima domanda
// della coda che in questa partita non e' ancora uscita. L'ordine della
// coda e' questo:
//  1. per prime le domande che mancano da piu' tempo; a parita' decide il
//     caso (il mescolamento iniziale);
//  2. le domande NUOVE, cioe' mai uscite su questo tabellone, se sono
//     poche (al massimo MASSIMO_NOVITA_SPARSE) non escono tutte insieme in
//     testa ma sparse tra le prime: circa una ogni DISTANZA_NOVITA domande
//     e mai a meno di DISTANZA_MINIMA_NOVITA posti l'una dall'altra. Cosi',
//     se in una sera di studio aggiungi 5 domande su Giona, in gioco non
//     arrivano una dopo l'altra. Se la partita finisce prima, le nuove
//     rimaste restano "mai uscite" e ricompaiono tra le prime della partita
//     dopo. Se invece sono tante (le prime partite con un browser nuovo, un
//     elenco aggiunto in blocco) non sono "novita'" ma il resto del mazzo
//     ancora da vedere, e deve uscire prima che torni una domanda gia'
//     vista: escono tutte per prime, come prima;
//  3. le domande uscite nell'ULTIMA partita stanno sempre in fondo, anche
//     dietro alle nuove: una domanda appena vista non torna prima delle
//     altre.

// Una domanda nuova ogni DISTANZA_NOVITA domande circa, e mai a meno di
// DISTANZA_MINIMA_NOVITA posti da un'altra nuova (3 = in mezzo ce ne sono
// almeno due vecchie). DISTANZA_NOVITA non deve scendere sotto
// DISTANZA_MINIMA_NOVITA, altrimenti non si sparge piu' niente.
// Oltre MASSIMO_NOVITA_SPARSE domande nuove non si sparge piu': escono
// tutte per prime.
const DISTANZA_NOVITA = 6;
const DISTANZA_MINIMA_NOVITA = 3;
const MASSIMO_NOVITA_SPARSE = 10;

// ultimaPartitaPerChiave: { chiaveDomanda: numeroDellaUltimaPartita }
// Restituisce il mazzo: `carte` e' la coda, cioe' le carte nell'ordine in
// cui usciranno; `visteInQuestaPartita` sono quelle gia' uscite in questa
// partita (all'inizio nessuna).
export function creaMazzoARotazione(carte, ultimaPartitaPerChiave) {
  const ultimaPartita = {};
  carte.forEach(c => {
    ultimaPartita[c._chiave] = ultimaPartitaPerChiave[c._chiave] || 0;
  });
  return {
    carte: mettiInOrdineDiUscita(mescola(carte), ultimaPartita),
    visteInQuestaPartita: new Set()
  };
}

// Prepara la coda. Le carte arrivano gia' mescolate: l'ordinamento e'
// stabile, quindi a parita' di numero di partita resta quell'ordine a caso.
function mettiInOrdineDiUscita(mescolate, ultimaPartita) {
  const nuove = mescolate.filter(c => !(ultimaPartita[c._chiave] > 0));
  const vecchie = mescolate
    .filter(c => ultimaPartita[c._chiave] > 0)
    .sort((a, b) => ultimaPartita[a._chiave] - ultimaPartita[b._chiave]);

  if (nuove.length === 0 || vecchie.length === 0) return [...nuove, ...vecchie];

  // Troppe nuove per essere delle "novita'": sono il resto del mazzo che
  // questo browser non ha ancora mai mostrato (le prime partite con un
  // browser nuovo, un elenco aggiunto in blocco). Prima di far tornare una
  // domanda gia' vista devono uscire tutte: niente spargimento.
  if (nuove.length > MASSIMO_NOVITA_SPARSE) return [...nuove, ...vecchie];

  // Le domande dell'ultima partita (il numero piu' alto) restano in fondo.
  const numeroUltimaPartita = ultimaPartita[vecchie[vecchie.length - 1]._chiave];
  const dellUltimaPartita = vecchie.filter(c => ultimaPartita[c._chiave] === numeroUltimaPartita);
  const dellePartitePrecedenti = vecchie.filter(c => ultimaPartita[c._chiave] !== numeroUltimaPartita);

  // Ogni nuova vuole i suoi posti: se le vecchie (senza quelle dell'ultima
  // partita) non bastano a tenere le nuove abbastanza lontane, si rinuncia a
  // spargerle e escono tutte per prime.
  const distanza = Math.min(DISTANZA_NOVITA, Math.floor((dellePartitePrecedenti.length + nuove.length) / nuove.length));
  if (distanza < DISTANZA_MINIMA_NOVITA) return [...nuove, ...vecchie];

  // La prima nuova va in uno dei primi posti, la seconda in uno dei posti
  // della fascia dopo, e cosi' via: ogni fascia e' lunga `distanza` e la
  // nuova ne occupa uno a caso, tranne gli ultimi che lascerebbero meno di
  // DISTANZA_MINIMA_NOVITA posti alla nuova successiva.
  const postiADisposizione = distanza - DISTANZA_MINIMA_NOVITA + 1;
  const conLeNuove = [...dellePartitePrecedenti];
  nuove.forEach((carta, i) => {
    const posto = i * distanza + Math.floor(Math.random() * postiADisposizione);
    conLeNuove.splice(posto, 0, carta);
  });
  return [...conLeNuove, ...dellUltimaPartita];
}

export function peschaARotazione(mazzo) {
  let nonAncoraViste = mazzo.carte.filter(c => !mazzo.visteInQuestaPartita.has(c._chiave));
  let baseViste = mazzo.visteInQuestaPartita;

  if (nonAncoraViste.length === 0) {
    // Tutto il mazzo è già uscito in questa partita: si ricomincia un
    // giro pulito dall'inizio della coda (senza rimescolare: stesso ordine
    // del primo giro).
    baseViste = new Set();
    nonAncoraViste = mazzo.carte;
  }

  const carta = nonAncoraViste[0];

  const nuoveViste = new Set(baseViste);
  nuoveViste.add(carta._chiave);

  return {
    mazzo: { ...mazzo, visteInQuestaPartita: nuoveViste },
    carta
  };
}
