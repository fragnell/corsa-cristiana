// testi.js
// Salmo 133:1 — TUTTE le frasi che compaiono sul tabellone e sui telefoni, in
// un posto solo. Per cambiare una frase basta cambiarla qui: nessun altro file
// contiene testo del Salmo.
//
// Il titolo e il versetto sono scritti esattamente come da Francesco. Le altre
// frasi sono una prima stesura, con tono affettuoso e senza colpe per nessuno
// (in particolare per il primo): si correggono liberamente.

export const TITOLO = 'COLLABORIAMO!';

// Piccole frasi usate dai telefoni.
export const IMMAGINE_GIUSTA = 'Ecco com\'era l\'immagine:';
export const CHIUDI = 'OK';
export const VERSETTO = "Salmo 133:1 - Ecco, com'è buono e com'è piacevole che i fratelli vivano insieme in unità!";

// "1 casella", "10 caselle"
export function caselle(n) {
  const numero = Math.abs(Number(n)) || 0;
  return `${numero} ${numero === 1 ? 'casella' : 'caselle'}`;
}

// "1 secondo", "15 secondi" (i millisecondi si arrotondano al secondo)
export function secondi(ms) {
  const n = Math.max(0, Math.round(Number(ms) / 1000)) || 0;
  return `${n} ${n === 1 ? 'secondo' : 'secondi'}`;
}

function tentativi(n) {
  return `${n} ${n === 1 ? 'tentativo' : 'tentativi'}`;
}

// ---------- sul tabellone ----------

export const tabellone = {
  // targhetta fissa in un angolo, quando restano salvati i valori PER PROVARE
  etichettaProva: '🧪 COLLABORIAMO!: valori per PROVARE',

  // schermata di apertura, mentre i due premono "Sono pronto"
  annuncio(p) {
    const righe = [
      `${p.ultimo} è rimasto un po' indietro nella corsa.`,
      `Ma nessuno corre da solo: ${p.primo} lo aiuterà!`
    ];
    const come = `${p.primo} vedrà per qualche secondo un'immagine fatta di tanti riquadri e poi la descriverà a voce. ${p.ultimo} dovrà rimettere i riquadri al loro posto sul suo telefono.`;
    const sePerde = p.ultimoSalta
      ? `${p.primo} torna indietro di ${caselle(p.malus)} e ${p.ultimo} salta il turno`
      : `${p.primo} torna indietro di ${caselle(p.malus)}`;
    const poste = `Se ci riuscite insieme, ${p.ultimo} avanza di ${caselle(p.bonus)}. Se non ci riuscite, ${sePerde}.`;
    return { righe, come, poste, invito: 'Premete «Sono pronto» sui vostri telefoni' };
  },

  statoPronti(p) {
    return {
      primo: p.primoPronto ? `✅ ${p.primo} è pronto` : `⏳ ${p.primo} non è ancora pronto`,
      ultimo: p.ultimoPronto ? `✅ ${p.ultimo} è pronto` : `⏳ ${p.ultimo} non è ancora pronto`
    };
  },

  anteprima(p) {
    return {
      titolo: `${p.primo} sta memorizzando l'immagine…`,
      sotto: `${p.ultimo}, non guardare lo schermo di ${p.primo}!`
    };
  },

  prova(p) {
    return {
      titolo: `${p.primo} descrive l'immagine, ${p.ultimo} la ricostruisce.`,
      sotto: 'Parlate, ascoltate, provate: il tempo scorre!'
    };
  },

  tentativo(fatti, max) {
    return `Tentativo ${Math.min(fatti + 1, max)} di ${max}`;
  },

  successo(p) {
    return {
      titolo: 'Ce l\'avete fatta! 🎉',
      testo: p.spostamento > 0
        ? `Insieme è più facile. ${p.ultimo} avanza di ${caselle(p.spostamento)}!`
        : 'Insieme è più facile!'
    };
  },

  fallimento(p) {
    const parti = ['Non importa: l\'importante è aver provato insieme.'];
    if (p.spostamento > 0) parti.push(`${p.primo} torna indietro di ${caselle(p.spostamento)}.`);
    if (p.ultimoSalta) parti.push(`${p.ultimo} salta il turno.`);
    return { titolo: 'Stavolta non è andata', testo: parti.join(' ') };
  },

  annullato() {
    return {
      titolo: 'Sarà per un\'altra volta',
      testo: 'Nessuno perde e nessuno guadagna niente. Si riprende a giocare.'
    };
  }
};

// ---------- sul telefono ----------

export const telefono = {
  // chi guarda soltanto (non e' ne' il primo ne' l'ultimo)
  altri: {
    corso(p) {
      return {
        titolo: `${p.primo} aiuta ${p.ultimo}`,
        testo: 'Fate il tifo per loro: insieme è più facile!'
      };
    },
    esito(p) {
      if (p.esito === 'successo') return tabellone.successo(p);
      if (p.esito === 'fallimento') return tabellone.fallimento(p);
      return tabellone.annullato();
    }
  },

  primo: {
    pronti(p) {
      return {
        titolo: `Tocca a te aiutare ${p.ultimo}!`,
        testo: `Tra poco vedrai per ${secondi(p.anteprimaMs)} un'immagine fatta di ${p.riquadri} riquadri. Memorizzala bene, poi descrivila a voce a ${p.ultimo}: dovrà rimetterla in ordine sul suo telefono.`,
        bottone: 'Sono pronto',
        caricamento: 'Preparo l\'immagine…',
        errore: 'Non riesco a caricare l\'immagine. Riprova tra poco.',
        dopo: `Perfetto! Aspetto che ${p.ultimo} sia pronto…`
      };
    },
    anteprima(p) {
      return { titolo: 'Memorizza l\'immagine!', conto: s => `Ancora ${s}s` };
    },
    prova(p) {
      return {
        titolo: `Descrivi l'immagine a ${p.ultimo}!`,
        testo: 'Parla chiaro e aiutalo riquadro per riquadro. Non mostrargli il telefono!',
        sbircia: `👀 Sbircia di nuovo (${secondi(p.sbirciataMs)}, una volta sola)`,
        sbirciando: 'Guarda bene!',
        sbirciataFinita: 'Hai già usato la sbirciata.',
        conto: s => `⏱️ ${s}s`
      };
    },
    esito(p) {
      if (p.esito === 'successo') {
        return { titolo: 'Ce l\'avete fatta! 🎉', testo: `Grazie per l'aiuto: ${p.ultimo} avanza di ${caselle(p.bonus)}!` };
      }
      if (p.esito === 'fallimento') {
        const t = ['Non importa: l\'importante è aver provato insieme.'];
        if (p.spostamento > 0) t.push(`Torni indietro di ${caselle(p.spostamento)}.`);
        return { titolo: 'Stavolta non è andata', testo: t.join(' ') };
      }
      return tabellone.annullato();
    }
  },

  ultimo: {
    pronti(p) {
      return {
        titolo: `${p.primo} ti darà una mano!`,
        testo: `${p.primo} vedrà un'immagine e te la descriverà a voce. Sul tuo telefono troverai i riquadri mescolati: tocca due riquadri per scambiarli. Quando pensi di aver finito premi «Ho finito». Hai ${tentativi(p.tentativiMax)}.`,
        bottone: 'Sono pronto',
        caricamento: 'Preparo i riquadri…',
        errore: 'Non riesco a caricare i riquadri. Riprova tra poco.',
        dopo: `Perfetto! Aspetto che ${p.primo} sia pronto…`
      };
    },
    anteprima(p) {
      return {
        titolo: `Non guardare lo schermo di ${p.primo}!`,
        testo: `${p.primo} sta memorizzando l'immagine.`,
        conto: s => `Si parte tra ${s}s`
      };
    },
    prova(p) {
      return {
        titolo: 'Rimetti i riquadri nell\'ordine giusto!',
        suggerimento: 'Tocca due riquadri per scambiarli.',
        bottone: 'Ho finito',
        controllo: 'Controllo…',
        tentativo: (fatti, max) => `Tentativo ${Math.min(fatti + 1, max)} di ${max}`,
        sbagliato: restano => `Non è ancora giusto. Ti ${restano === 1 ? 'resta 1 tentativo' : `restano ${restano} tentativi`}: continua!`,
        tempoScaduto: 'Tempo scaduto! Consegno quello che hai fatto…',
        conto: s => `⏱️ ${s}s`
      };
    },
    esito(p) {
      if (p.esito === 'successo') {
        return { titolo: 'Ce l\'avete fatta! 🎉', testo: `Avanzi di ${caselle(p.spostamento || p.bonus)}!` };
      }
      if (p.esito === 'fallimento') {
        return {
          titolo: 'Stavolta non è andata',
          testo: 'Non importa: l\'importante è aver provato insieme.' + (p.ultimoSalta ? ' Salti il turno.' : '')
        };
      }
      return tabellone.annullato();
    }
  }
};
