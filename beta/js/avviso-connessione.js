// avviso-connessione.js
// Un avviso in alto quando questo dispositivo (il telefono o il tabellone) perde il collegamento a Internet.
//
// Perche': senza collegamento il telefono sembra funzionare ma non e' cosi' (si tocca "Tira il dado" e non
// succede niente), e sul tabellone le mosse dei telefoni non arrivano. Con l'avviso si capisce subito che il
// problema e' la connessione, e che basta aspettare: il collegamento si ripristina da solo.
//
// L'avviso compare solo se la connessione manca per qualche secondo (un attimo di interruzione non lo
// fa comparire) e sparisce da solo appena il collegamento torna.
//
// Non lancia MAI errori verso chi la usa. "ambiente" serve solo ai collaudi (timer finti).

export const RITARDO_AVVISO_MS = 4000;
const CLASSE_NASCOSTA = 'nascosta';

// elemento: il riquadro dell'avviso nella pagina (nascosto di partenza)
// ascolta(callback): da sincronizzazione.js (ascoltaConnessione): chiama callback(true|false) a ogni cambiamento
export function avviaAvvisoConnessione({ elemento, ascolta, ritardoMs = RITARDO_AVVISO_MS, ambiente = {} } = {}) {
  const impostaTimer = ambiente.setTimeout || ((f, ms) => setTimeout(f, ms));
  const togliTimer = ambiente.clearTimeout || ((t) => clearTimeout(t));

  let timer = null;
  let visibile = false;
  let fermato = false;
  let smettiDiAscoltare = null;

  function mostra() {
    if (fermato || visibile) return;
    visibile = true;
    try { if (elemento) elemento.classList.remove(CLASSE_NASCOSTA); } catch (errore) { /* pazienza */ }
  }

  function nascondi() {
    visibile = false;
    try { if (elemento) elemento.classList.add(CLASSE_NASCOSTA); } catch (errore) { /* pazienza */ }
  }

  function fermaTimer() {
    if (timer !== null) {
      try { togliTimer(timer); } catch (errore) { /* pazienza */ }
      timer = null;
    }
  }

  function allaConnessione(collegato) {
    if (fermato) return;
    if (collegato === true) {
      fermaTimer();
      nascondi();
    } else if (timer === null && !visibile) {
      timer = impostaTimer(() => { timer = null; mostra(); }, ritardoMs);
    }
  }

  try {
    if (typeof ascolta === 'function') smettiDiAscoltare = ascolta(allaConnessione);
  } catch (errore) {
    console.warn('Avviso di connessione non disponibile', errore);
  }

  return {
    smetti() {
      fermato = true;
      fermaTimer();
      nascondi();
      try { if (typeof smettiDiAscoltare === 'function') smettiDiAscoltare(); } catch (errore) { /* pazienza */ }
    },
    // Solo per i collaudi.
    stato() {
      return { visibile, inAttesa: timer !== null };
    }
  };
}
