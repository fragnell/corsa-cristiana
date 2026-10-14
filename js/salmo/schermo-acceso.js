// schermo-acceso.js
// Salmo 133:1 — tiene acceso lo schermo del telefono finche' dura COLLABORIAMO!.
//
// Perche': i telefoni spengono lo schermo dopo una trentina di secondi senza
// toccarli, e un telefono con lo schermo spento esce dalla partita. Chi descrive
// il disegno a voce (e chi ascolta prima di cominciare) per un po' non tocca il
// telefono: senza questo accorgimento si spegnerebbe proprio nel mezzo della prova.
//
// Come: la "Screen Wake Lock API" (iPhone con iOS 16.4 o piu' recente; Chrome e
// Samsung Internet su Android). Se il telefono non la conosce, o la rifiuta (ad
// esempio con il risparmio energetico acceso), non succede nulla di grave: la
// prova funziona lo stesso, e il tabellone e' tollerante con i telefoni che si
// addormentano (vedi orchestratore.js).
//
// Non lancia MAI errori verso chi la usa. "ambiente" serve solo ai collaudi
// (navigator e document finti).

export function creaSchermoAcceso(ambiente = {}) {
  const nav = ambiente.navigator !== undefined
    ? ambiente.navigator
    : (typeof navigator !== 'undefined' ? navigator : null);
  const doc = ambiente.document !== undefined
    ? ambiente.document
    : (typeof document !== 'undefined' ? document : null);

  let voluto = false;        // la prova e' aperta: lo schermo deve restare acceso
  let blocco = null;         // il blocco concesso dal telefono, se c'e'
  let inRichiesta = false;   // una richiesta e' gia' in viaggio

  function supportato() {
    try {
      return !!(nav && nav.wakeLock && typeof nav.wakeLock.request === 'function');
    } catch (errore) {
      return false;
    }
  }

  function rilascia(sentinella) {
    if (!sentinella) return;
    try {
      const promessa = sentinella.release();
      if (promessa && typeof promessa.catch === 'function') promessa.catch(() => {});
    } catch (errore) { /* pazienza */ }
  }

  async function richiedi() {
    if (!voluto || inRichiesta || !supportato()) return;
    if (blocco && blocco.released !== true) return;            // lo abbiamo gia'
    if (doc && doc.visibilityState === 'hidden') return;       // si riprova quando la pagina torna visibile
    inRichiesta = true;
    try {
      const nuovo = await nav.wakeLock.request('screen');
      if (!voluto) {                                           // nel frattempo la prova e' finita
        rilascia(nuovo);
        return;
      }
      blocco = nuovo;
      try {
        nuovo.addEventListener('release', () => { if (blocco === nuovo) blocco = null; });
      } catch (errore) { /* pazienza */ }
    } catch (errore) {
      // rifiutato (risparmio energetico, pagina nascosta...): si riprovera' al prossimo tocco
    } finally {
      inRichiesta = false;
    }
  }

  // Quando la pagina torna visibile il telefono ha gia' rilasciato il blocco da solo: lo si richiede.
  function allaVisibilita() {
    try {
      if (voluto && doc && doc.visibilityState === 'visible') richiedi();
    } catch (errore) { /* pazienza */ }
  }

  return {
    // La prova e' aperta su questo telefono: tieni acceso lo schermo.
    accendi() {
      if (voluto) return;
      voluto = true;
      try { if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', allaVisibilita); } catch (errore) { /* pazienza */ }
      richiedi();
    },

    // Un tocco della persona: alcuni telefoni accettano la richiesta solo cosi'.
    riprova() {
      richiedi();
    },

    // La prova e' finita (o chiusa): lascia che lo schermo si spenga come al solito.
    spegni() {
      voluto = false;
      try { if (doc && doc.removeEventListener) doc.removeEventListener('visibilitychange', allaVisibilita); } catch (errore) { /* pazienza */ }
      const vecchio = blocco;
      blocco = null;
      rilascia(vecchio);
    },

    // Solo per i collaudi.
    stato() {
      return { voluto, attivo: !!blocco, inRichiesta };
    }
  };
}
