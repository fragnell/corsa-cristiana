// introduzione-testi.js
// I testi della presentazione che compare sul tabellone all'inizio di ogni partita (e nella pagina
// "Come si gioca" → Video tutorial). Qui ci sono solo le "scene", come semplici oggetti: chi le
// mostra e le anima e' js/introduzione.js. I numeri delle regole (quante caselle si avanzano, quanti
// secondi per rispondere...) arrivano dalla configurazione della partita: se l'Admin li cambia, o se
// si gioca la partita veloce, la spiegazione dice sempre il vero.
//
// Ogni scena:
//   { id, icona, titolo, testo, riferimento?, elenco?: [{ icona, immagine?, titolo, testo }],
//     animazione?: 'percorso' | 'dado' | 'mosaico', durataMs }
// La scena "domanda" e' speciale: chiede se e' la prima volta che si gioca.
//
// Si prova con test-introduzione.mjs, senza browser.

export const DURATA_MINIMA_MS = 6000;
export const DURATA_MASSIMA_MS = 20000;
// Se nessuno risponde alla domanda "E' la prima volta?", dopo tanto si parte senza spiegazione.
export const ATTESA_DOMANDA_MS = 30000;

// Quanto resta una scena: abbastanza per leggerla con calma ad alta voce.
export function durataLettura(scena) {
  let caratteri = String(scena.titolo || '').length + String(scena.testo || '').length + String(scena.riferimento || '').length;
  let extra = 0;
  for (const voce of scena.elenco || []) {
    caratteri += String(voce.titolo || '').length + String(voce.testo || '').length;
    extra += 900;   // ogni voce dell'elenco entra un po' dopo la precedente
  }
  const ms = 3000 + caratteri * 62 + extra;
  return Math.round(Math.min(DURATA_MASSIMA_MS, Math.max(DURATA_MINIMA_MS, ms)));
}

function conDurata(scena) {
  return { ...scena, durataMs: durataLettura(scena) };
}

function numero(valore, base) {
  const n = Number(valore);
  return Number.isFinite(n) ? n : base;
}

function caselle(n) {
  const v = Math.abs(n);
  return v === 1 ? '1 casella' : `${v} caselle`;
}

// ---------- la premessa (si vede sempre, a meno di saltarla) ----------

export function scenePremessa() {
  return [
    {
      id: 'benvenuto',
      icona: '🏃',
      titolo: 'Prima di cominciare…',
      testo: 'Una piccola premessa: conoscere più cose non significa necessariamente essere più spirituali.'
    },
    {
      id: 'torre',
      icona: '📖',
      titolo: 'Conoscere non basta',
      testo: 'Come ricorda La Torre di Guardia del febbraio 2018, conoscere la Bibbia non basta per sviluppare una mentalità spirituale.',
      riferimento: 'La Torre di Guardia, febbraio 2018, p. 24, par. 7'
    },
    {
      id: 'salomone',
      icona: '👑',
      titolo: 'Pensiamo a Salomone',
      testo: 'Pur avendo una grande conoscenza di Geova, alla fine non rimase fedele a lui.',
      riferimento: '1 Re 4:29, 30; 11:4-6'
    },
    {
      id: 'fiducia',
      icona: '🤲',
      titolo: 'La vera corsa cristiana',
      testo: 'Per portarla a termine non basta conoscere la Parola di Dio: dobbiamo fidarci pienamente di essa e metterla in pratica nella nostra vita.'
    },
    {
      id: 'scopo',
      icona: '🎯',
      titolo: 'Lo scopo di questo gioco',
      testo: '',
      elenco: [
        { icona: '💪', titolo: 'Metterci alla prova', testo: '' },
        { icona: '🔄', titolo: 'Rispolverare', testo: 'informazioni che credevamo di aver dimenticato' },
        { icona: '💡', titolo: 'Riscoprirle', testo: 'attraverso il ragionamento' },
        { icona: '🔍', titolo: 'Incuriosirci', testo: 'su nuovi argomenti' },
        { icona: '👥', titolo: 'E soprattutto…', testo: 'trascorrere del tempo insieme parlando di cose edificanti' }
      ]
    },
    {
      id: 'non-gara',
      icona: '🤝',
      titolo: 'Non è una gara a chi sa di più',
      testo: 'È un\'occasione per ragionare, imparare e rafforzare insieme la nostra fede.'
    }
  ].map(conDurata);
}

export function scenaDomanda() {
  return {
    id: 'domanda',
    tipo: 'domanda',
    icona: '🙋',
    titolo: 'È la prima volta che giocate?',
    testo: 'Allora vi spiego brevemente come funziona.',
    si: '🙋 Sì, spiegaci le regole',
    no: '🏁 No, iniziamo!',
    durataMs: ATTESA_DOMANDA_MS
  };
}

// ---------- le regole (solo se e' la prima volta) ----------

// config: quella della partita (gia' con la modalita' applicata, vedi configPerModalita).
export function sceneRegole(config = {}, modalita = 'normale') {
  const c = config || {};
  const bonusConoscenza = numero(c.conoscenza && c.conoscenza.bonusRispostaCorretta, 3);
  const bonusProva = numero(c.prova && c.prova.bonusSuperata, 1);
  const malusImprevisto = numero(c.imprevisto && c.imprevisto.malus, -5);
  const secondiRisposta = Math.round(numero(c.timeout && c.timeout.rispostaMs, 60000) / 1000);
  const saltoAttiva = !!(c.regole && c.regole.saltoAttivaCasella);
  const salmo = c.salmo || {};
  const veloce = modalita === 'veloce';

  const scene = [
    {
      id: 'obiettivo',
      icona: '🏁',
      titolo: 'L\'obiettivo',
      testo: 'Arrivare per primi alla casella 62. Non serve arrivarci esatti: basta raggiungerla o superarla.'
        + (veloce ? ' ⚡ Oggi si gioca la partita veloce: si avanza di più e si finisce prima.' : ''),
      animazione: 'percorso'
    },
    {
      id: 'turno',
      icona: '📱',
      titolo: 'Il tuo turno',
      testo: 'Quando tocca a te, il tuo telefono te lo dice. Tira il dado dal telefono: la tua pedina avanza da sola qui sul tabellone.',
      animazione: 'dado'
    },
    {
      id: 'caselle',
      icona: '🗺️',
      titolo: 'Le caselle',
      testo: '',
      elenco: [
        { immagine: 'img/icona-conoscenza.png', titolo: 'Conoscenza', testo: `una domanda biblica. Giusta: avanti di ${caselle(bonusConoscenza)}. Sbagliata: resti fermo.` },
        { immagine: 'img/icona-prova.png', titolo: 'Prova', testo: `una prova da fare davvero. Superata: avanti di ${caselle(bonusProva)}.` },
        { immagine: 'img/icona-imprevisto.png', titolo: 'Imprevisto', testo: `si torna indietro di ${caselle(malusImprevisto)}.` },
        { immagine: 'img/icona-salto.png', titolo: 'Salto', testo: saltoAttiva ? 'uno sprint in avanti, e vale anche la casella su cui arrivi!' : 'un\'occasione edificante: uno sprint in avanti!' },
        { immagine: 'img/icona-fermo.png', titolo: 'Scoraggiamento', testo: 'ci si ferma a riprendere le forze: salti il prossimo turno.' }
      ]
    },
    {
      id: 'domande',
      icona: '🧠',
      titolo: 'Le domande',
      testo: `Possono essere a risposta libera, a elenco o a scelta multipla, e hai ${secondiRisposta} secondi per rispondere. Hai sbagliato a scrivere? Dal tabellone si può premere «Correggi», ma solo per gli errori di battitura!`
    },
    {
      id: 'prove',
      icona: '💪',
      titolo: 'Le prove',
      testo: 'Cantare, restare in silenzio, tenere gli occhi chiusi… Le giudica il gruppo, con onestà. Alcune restano in sospeso fino al tuo turno successivo: il tabellone se lo ricorda.'
    }
  ];

  if (salmo.attivo !== false) {
    const bonus = Math.abs(numero(salmo.bonusUltimo, 10));
    const malus = Math.abs(numero(salmo.malusPrimo, -10));
    scene.push({
      id: 'collaboriamo',
      icona: '🤝',
      titolo: 'COLLABORIAMO!',
      testo: `Se qualcuno resta molto indietro, chi è in testa lo aiuta: guarda un'immagine sul suo telefono e la descrive a voce, l'altro la rimette in ordine. Ci riuscite? Chi era indietro avanza di ${caselle(bonus)}. Altrimenti chi era in testa torna indietro di ${caselle(malus)}.`,
      riferimento: 'Salmo 133:1',
      animazione: 'mosaico'
    });
  }

  scene.push(
    {
      id: 'junior',
      icona: '🧒',
      titolo: 'Anche per i più piccoli',
      testo: 'Con la modalità Junior le domande sono a scelta multipla, pensate per la loro età. Un adulto può leggerle e aiutarli a rispondere.'
    },
    {
      id: 'via',
      icona: '🏃',
      titolo: 'Pronti? Buona corsa!',
      testo: '«…corriamo con perseveranza la corsa che ci sta davanti.»',
      riferimento: 'Ebrei 12:1'
    }
  );

  return scene.map(conDurata);
}
