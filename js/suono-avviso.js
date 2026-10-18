// suono-avviso.js
// Un suono breve sul telefono, insieme al lampeggio e alla vibrazione, quando tocca a te (hai il dado da tirare)
// o quando devi rispondere a una domanda. Serve a chi tiene il telefono sul tavolo e guarda il tabellone: la
// vibrazione non c'e' su tutti i telefoni (su iPhone non esiste, e alcuni Android non la concedono alle pagine
// web), il suono si.
//
// Il suono e' il file audio/allert-giocatore.mp3, scelto da Francesco. Il telefono lo scarica UNA volta (sono 77 KB),
// appena la persona tocca la pagina per la prima volta, e poi lo suona dalla memoria: niente di nuovo da scaricare a
// ogni avviso. Se il file non c'e', non si scarica o non si riesce a leggere, il telefono "disegna" da solo un breve
// «din» (Web Audio) al suo posto: l'avviso c'e' sempre.
//
// Una regola dei browser: finche' la persona non ha toccato la pagina, nessun suono puo' partire. Per questo
// il telefono "sblocca" l'audio a ogni tocco (lo fa suonoDellaPagina(), da solo): dopo il primo tocco il suono
// e' pronto. Se il telefono e' in silenzioso (iPhone) o ha il volume dei contenuti a zero non si sente niente:
// pazienza, c'e' sempre il lampeggio.
//
// Chi non vuole il suono lo spegne con l'interruttore «Suono» accanto al codice della partita (si ricorda).
// Con il suono spento non si scarica niente e non si tocca l'audio del telefono.
//
// Non lancia MAI errori verso chi la usa. "ambiente" serve solo ai collaudi (AudioContext, memoria, orologio e
// scaricamento del file finti).

// BETA: chiave diversa da quella del gioco vero, cosi' i due non si scambiano la scelta.
export const CHIAVE_SUONO = 'corsa-cristiana-beta-suono-avviso';

// Le note di ogni avviso: frequenza in Hz e quando partono (secondi dall'inizio dell'avviso).
export const DISEGNI_SUONO = {
  dado: [{ hz: 784, quando: 0 }, { hz: 1047, quando: 0.16 }],   // sol e do: due "din" che salgono ("tocca a te!")
  domanda: [{ hz: 659, quando: 0 }]                             // mi: un solo "din" ("rispondi")
};

export const ATTACCO_S = 0.012;      // il suono sale in un attimo, ma non di colpo (altrimenti si sente un "clic")
export const DURATA_NOTA_S = 0.45;   // poi svanisce piano in questo tempo
export const VOLUME_MASSIMO = 0.3;   // 1 sarebbe il massimo possibile: questo e' meno di un terzo, si sente ma non spaventa
const VOLUME_FINALE = 0.001;         // il punto in cui il suono e' ormai silenzio
const ANTICIPO_S = 0.02;             // un soffio di anticipo, per dare al browser il tempo di preparare il suono
const CODA_S = 0.05;                 // le note si fermano appena dopo essere svanite

// Se il telefono ci mette piu' di cosi' a sbloccare l'audio, l'avviso e' ormai vecchio: non suona piu'.
export const ATTESA_MASSIMA_MS = 1500;

// Il file del suono, con l'indirizzo che si usa per tutti gli audio del sito (relativo alla pagina).
export const FILE_SUONO = 'audio/allert-giocatore.mp3';
export const VOLUME_FILE = 1;                    // il file si suona com'e': il volume l'ha deciso chi l'ha scelto
// Se il file non si scarica (campo debole...), non si ritenta a ogni tocco ma al massimo una volta ogni tanto.
export const PAUSA_TRA_TENTATIVI_MS = 20000;

// Mette in programma le note di un avviso sul "contesto audio" dato, a partire dall'istante "inizio" (secondi).
// Restituisce quanto dura in tutto (secondi), o 0 se l'avviso non esiste. Non sa niente di pagine e telefoni:
// per questo si puo' provare anche "fuori dal telefono" (vedi test-suono-avviso.mjs).
export function programmaSuono(contesto, tipo, inizio) {
  const note = DISEGNI_SUONO[tipo];
  if (!note) return 0;
  let fine = inizio;
  for (const nota of note) {
    const t0 = inizio + nota.quando;
    const t1 = t0 + DURATA_NOTA_S;

    // Il "volume" della nota: parte da quasi zero, sale al massimo, svanisce.
    const volume = contesto.createGain();
    volume.gain.setValueAtTime(VOLUME_FINALE, t0);
    volume.gain.linearRampToValueAtTime(VOLUME_MASSIMO, t0 + ATTACCO_S);
    volume.gain.exponentialRampToValueAtTime(VOLUME_FINALE, t1);
    volume.connect(contesto.destination);

    // Ogni "din" ha due voci: la nota vera e la sua ottava, piu' leggera, che gli da' il suono da campanello.
    for (const [moltiplicatore, quota] of [[1, 0.8], [2, 0.2]]) {
      const voce = contesto.createOscillator();
      voce.type = 'sine';
      voce.frequency.setValueAtTime(nota.hz * moltiplicatore, t0);
      const dosaggio = contesto.createGain();
      dosaggio.gain.setValueAtTime(quota, t0);
      voce.connect(dosaggio);
      dosaggio.connect(volume);
      voce.start(t0);
      voce.stop(t1 + CODA_S);
    }
    fine = Math.max(fine, t1 + CODA_S);
  }
  return fine - inizio;
}

function audioDellaPagina() {
  try {
    if (typeof globalThis.AudioContext === 'function') return globalThis.AudioContext;
    if (typeof globalThis.webkitAudioContext === 'function') return globalThis.webkitAudioContext;
  } catch (errore) { /* pazienza */ }
  return null;
}

function memoriaDellaPagina() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (errore) {
    return null;                       // alcuni browser vietano la memoria (navigazione privata...)
  }
}

function leggiPreferenza(memoria) {
  try {
    return !memoria || memoria.getItem(CHIAVE_SUONO) !== 'no';     // di serie e' acceso
  } catch (errore) {
    return true;
  }
}

// Un suono muto di un istante: su alcuni telefoni l'audio si sblocca solo se, durante il tocco, qualcosa viene "avviato".
function suonoMuto(contesto) {
  try {
    const sorgente = contesto.createBufferSource();
    sorgente.buffer = contesto.createBuffer(1, 1, 22050);
    sorgente.connect(contesto.destination);
    sorgente.start(0);
  } catch (errore) { /* pazienza */ }
}

// Scarica il file del suono dalla pagina. Restituisce la "promessa" dei suoi byte (o un errore se non si riesce).
function scaricaDallaPagina(indirizzo) {
  if (typeof fetch !== 'function') return Promise.reject(new Error('questo telefono non sa scaricare file'));
  return fetch(indirizzo).then((risposta) => {
    if (!risposta.ok) throw new Error(`file del suono non disponibile (${risposta.status})`);
    return risposta.arrayBuffer();
  });
}

// Trasforma i byte del file in un suono pronto da suonare. I telefoni piu' vecchi rispondono solo con le funzioni
// "di ritorno", quelli nuovi con la promessa: si usano entrambe (la seconda risposta e' innocua).
function leggiIlFile(contesto, dati) {
  return new Promise((risolvi, rifiuta) => {
    try {
      const promessa = contesto.decodeAudioData(dati, risolvi, rifiuta);
      if (promessa && typeof promessa.then === 'function') promessa.then(risolvi, rifiuta);
    } catch (errore) {
      rifiuta(errore);
    }
  });
}

export function creaSuonoAvviso(ambiente = {}) {
  const Costruttore = ambiente.AudioContext !== undefined ? ambiente.AudioContext : audioDellaPagina();
  const memoria = ambiente.memoria !== undefined ? ambiente.memoria : memoriaDellaPagina();
  const adesso = typeof ambiente.adesso === 'function' ? ambiente.adesso : () => Date.now();
  const scarica = typeof ambiente.scarica === 'function' ? ambiente.scarica : scaricaDallaPagina;

  let contesto = null;
  let attivo = leggiPreferenza(memoria);

  // Il suono del file: finche' non e' pronto (o se non si riesce ad averlo) si usa il "din" disegnato qui sotto.
  let registrazione = null;            // il suono gia' letto, pronto da suonare
  let inCaricamento = false;
  let caricamento = null;              // lo scaricamento in corso: una "promessa" che finisce sempre, bene o male
  let ultimoTentativo = null;

  // Comincia a scaricare e leggere il file, se serve: una volta sola, e solo con il suono acceso. Non aspetta niente
  // e non lancia errori: se qualcosa va storto resta il "din" e si riprova (con calma) al prossimo avviso.
  function preparaIlFile() {
    try {
      if (!attivo || registrazione || inCaricamento || !contesto) return;
      const ora = adesso();
      if (ultimoTentativo !== null && ora - ultimoTentativo < PAUSA_TRA_TENTATIVI_MS) return;
      ultimoTentativo = ora;
      inCaricamento = true;
      let scaricamento;
      try { scaricamento = Promise.resolve(scarica(FILE_SUONO)); } catch (errore) { scaricamento = Promise.reject(errore); }
      caricamento = scaricamento
        .then((dati) => leggiIlFile(contesto, dati))
        .then((suono) => { if (suono) registrazione = suono; })
        .catch(() => { /* resta il "din" */ })
        .then(() => { inCaricamento = false; });
    } catch (errore) {
      inCaricamento = false;
    }
  }

  // Crea il contesto audio (una volta sola) e prova a riattivarlo. Restituisce la "promessa" del risveglio, se c'e'.
  function risveglia() {
    if (!Costruttore) return null;
    if (contesto && contesto.state === 'closed') contesto = null;
    if (!contesto) contesto = new Costruttore();
    preparaIlFile();
    if (contesto.state === 'running') return null;
    suonoMuto(contesto);
    const promessa = contesto.resume();
    return promessa && typeof promessa.then === 'function' ? promessa : null;
  }

  // Suona il file. Restituisce false se non c'e' (ancora) o se non parte: allora tocca al "din".
  function suonaIlFile(inizio) {
    try {
      if (!registrazione) return false;
      const sorgente = contesto.createBufferSource();
      sorgente.buffer = registrazione;
      const volume = contesto.createGain();
      volume.gain.setValueAtTime(VOLUME_FILE, inizio);
      sorgente.connect(volume);
      volume.connect(contesto.destination);
      sorgente.start(inizio);
      return true;
    } catch (errore) {
      return false;
    }
  }

  function suonaOra(tipo) {
    try {
      const inizio = contesto.currentTime + ANTICIPO_S;
      if (!suonaIlFile(inizio)) programmaSuono(contesto, tipo, inizio);
      return true;
    } catch (errore) {
      return false;
    }
  }

  return {
    // Da chiamare dentro un tocco della persona. Restituisce true se l'audio e' pronto.
    sblocca() {
      try {
        const promessa = risveglia();
        if (promessa) promessa.then(() => {}, () => {});
        return !!contesto && contesto.state === 'running';
      } catch (errore) {
        return false;
      }
    },

    // Suona l'avviso 'dado' o 'domanda' (il suono e' lo stesso: il file; se non c'e', il «din»). Restituisce true se
    // parte subito; false se non c'e' audio, se la persona l'ha spento, o se l'audio non e' (ancora) pronto (in quel
    // caso, se lo diventa entro un attimo, suona dopo).
    // Con { aspettaIlFile: true } (l'assaggio dell'interruttore) se il file sta ancora arrivando lo si aspetta un
    // attimo, perche' chi riaccende il suono vuole sentire quello vero e non il «din». Gli avvisi veri non aspettano mai.
    suona(tipo, opzioni) {
      try {
        if (!attivo || !DISEGNI_SUONO[tipo]) return false;
        const promessa = risveglia();
        if (!contesto) return false;
        const attesaFile = opzioni && opzioni.aspettaIlFile && inCaricamento ? caricamento : null;
        if (contesto.state === 'running' && !attesaFile) return suonaOra(tipo);
        const attese = [promessa, attesaFile].filter(Boolean);
        if (attese.length) {
          const richiesto = adesso();
          Promise.all(attese.map((p) => p.then(() => {}, () => {}))).then(() => {
            if (attivo && contesto && contesto.state === 'running' && adesso() - richiesto <= ATTESA_MASSIMA_MS) suonaOra(tipo);
          });
        }
        return false;
      } catch (errore) {
        return false;
      }
    },

    attivo() {
      return attivo;
    },

    // La persona accende o spegne il suono; la scelta si ricorda.
    imposta(valore) {
      attivo = !!valore;
      try {
        if (memoria) memoria.setItem(CHIAVE_SUONO, attivo ? 'si' : 'no');
      } catch (errore) { /* pazienza */ }
    },

    // Solo per i collaudi.
    stato() {
      return { attivo, contesto: contesto ? contesto.state : null, supportato: !!Costruttore, file: registrazione ? 'pronto' : (inCaricamento ? 'in-corso' : 'no') };
    }
  };
}

// Il suono "della pagina": uno solo, creato la prima volta che serve. Si sblocca da solo ai tocchi della persona
// (si ascoltano per tutta la durata della pagina: costa niente, e serve a riaccendere l'audio se il telefono lo
// ferma, per esempio dopo una telefonata).
let suonoUnico = null;
export function suonoDellaPagina() {
  if (suonoUnico) return suonoUnico;
  suonoUnico = creaSuonoAvviso();
  try {
    if (typeof document !== 'undefined' && document.addEventListener) {
      const alTocco = () => {
        try { if (suonoUnico.attivo()) suonoUnico.sblocca(); } catch (errore) { /* pazienza */ }
      };
      for (const evento of ['touchend', 'pointerup', 'click', 'keydown']) {
        document.addEventListener(evento, alTocco, { capture: true, passive: true });
      }
    }
  } catch (errore) { /* pazienza */ }
  return suonoUnico;
}

// L'interruttore «Suono» sulla pagina del telefono: mostra se il suono e' acceso, lo cambia al tocco e, quando lo
// si accende, fa sentire un assaggio. Il pulsante nasce nascosto (vedi giocatore.html) e si mostra solo se tutto funziona.
export function collegaPulsanteSuono(pulsante, suono) {
  try {
    if (!pulsante || !suono) return false;
    // Un telefono che non sa suonare non ha niente da accendere o spegnere: l'interruttore resta nascosto.
    if (typeof suono.stato === 'function' && suono.stato().supportato === false) return false;
    const mostra = () => {
      // La parola resta sempre «Suono» (cosi' il pulsante non cambia larghezza): quando e' spento il CSS cambia la
      // campanella e barra la parola (vedi css/giocatore.css); per chi usa uno screen reader c'e' aria-pressed.
      pulsante.textContent = 'Suono';
      pulsante.setAttribute('aria-pressed', suono.attivo() ? 'true' : 'false');
    };
    mostra();
    pulsante.addEventListener('click', () => {
      try {
        suono.imposta(!suono.attivo());
        mostra();
        if (suono.attivo()) suono.suona('dado', { aspettaIlFile: true });
      } catch (errore) { /* pazienza */ }
    });
    pulsante.classList.remove('nascosta');
    return true;
  } catch (errore) {
    return false;
  }
}
