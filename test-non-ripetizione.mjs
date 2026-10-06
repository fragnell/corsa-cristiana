// test-non-ripetizione.mjs
// Prova la pescata "a rotazione" delle domande Conoscenza su tante partite di
// fila, nel modo in cui le vive il tabellone: a ogni partita (cioe' a ogni
// ricarica della pagina) si rilegge la memoria salvata nel browser
// (js/rotazione-domande.js), si costruisce il mazzo (js/mazzi.js), si pesca e
// si segna ogni domanda MOSTRATA, comprese quelle cambiate con "Cambia
// domanda". Prova anche che le domande NUOVE (mai uscite) non arrivino tutte
// insieme: se sono poche escono sparse tra le altre, mai una dopo l'altra.
// Si esegue con:
//   node test-non-ripetizione.mjs
// Usa i veri moduli del progetto, con un finto localStorage tenuto in memoria.
// Termina con errore (codice 1) se anche una sola verifica non passa.

import fs from 'node:fs';
import { creaMazzoARotazione, peschaARotazione } from './js/mazzi.js';
import { leggiMemoriaRotazione, numeroNuovaPartita, segnaDomandaUscita } from './js/rotazione-domande.js';

let fallite = 0;
function verifica(descrizione, vero) {
  console.log(`  ${vero ? '✅' : '❌'} ${descrizione}`);
  if (!vero) fallite++;
}

function creaCarte(quante, prefisso = 'domanda') {
  return Array.from({ length: quante }, (_, i) => ({ _chiave: `${prefisso}-${i + 1}` }));
}

function inComune(a, b) {
  const insiemeB = new Set(b);
  return a.filter(k => insiemeB.has(k));
}

// In che posizione (0 = la prima pescata) sono uscite le domande indicate.
function posizioni(uscite, chiavi) {
  const insieme = new Set(chiavi);
  return uscite.map((k, i) => (insieme.has(k) ? i : -1)).filter(i => i >= 0);
}

// Vero se tra due posizioni vicine ci sono almeno `minimo` posti (3 = in mezzo
// ci sono almeno due altre domande).
function distanziate(posti, minimo = 3) {
  return posti.every((p, i) => i === 0 || p - posti[i - 1] >= minimo);
}

// Un finto localStorage: tiene tutto in una mappa, come quello vero ma in
// memoria. Ogni finto archivio e' "un tabellone" con la sua memoria.
function creaArchivioFinto() {
  const dati = new Map();
  return {
    getItem: (chiave) => (dati.has(chiave) ? dati.get(chiave) : null),
    setItem: (chiave, valore) => { dati.set(chiave, String(valore)); },
    removeItem: (chiave) => { dati.delete(chiave); }
  };
}

// Gioca UNA partita come fanno avvia() e giocaTurno() del tabellone: legge la
// memoria, calcola il numero della partita, costruisce il mazzo e poi pesca
// `pescate` domande, segnando subito ognuna come uscita (anche quelle che
// poi verrebbero cambiate con "Cambia domanda").
// A ogni pescata controlla anche le regole della rotazione, con la memoria
// letta a inizio partita e non con quella interna al mazzo, cosi' e' un
// controllo indipendente:
//  1. si pesca solo tra le domande non ancora uscite in questa partita (o, a
//     mazzo finito, tra tutte);
//  2. tra quelle gia' uscite in passato si va dalla piu' lontana nel tempo:
//     nessun'altra candidata "vecchia" manca da piu' tempo di quella scelta;
//  3. una domanda dell'ultima partita non esce finche' restano da pescare
//     domande nuove (mai uscite).
// Le nuove, invece, possono uscire in qualunque momento: se sono poche vanno
// sparse tra le altre (e questo lo controllano gli scenari piu' sotto).
function giocaPartita(carte, archivio, pescate) {
  const memoriaInizio = leggiMemoriaRotazione(archivio);
  const numero = numeroNuovaPartita(memoriaInizio);
  const ultimaVolta = (carta) => memoriaInizio[carta._chiave] || 0;
  const ultimaPartitaDelMazzo = Math.max(0, ...carte.map(ultimaVolta));

  let mazzo = creaMazzoARotazione(carte, memoriaInizio);
  const uscite = [];
  let sceltaSempreGiusta = true;

  for (let i = 0; i < pescate; i++) {
    const nonViste = mazzo.carte.filter(c => !mazzo.visteInQuestaPartita.has(c._chiave));
    const candidate = nonViste.length > 0 ? nonViste : mazzo.carte;

    const risultato = peschaARotazione(mazzo);
    const scelta = risultato.carta;
    const eVecchia = ultimaVolta(scelta) > 0;
    const regola1 = candidate.includes(scelta);
    const regola2 = !eVecchia || candidate.every(c => ultimaVolta(c) === 0 || ultimaVolta(c) >= ultimaVolta(scelta));
    const regola3 = !eVecchia || ultimaVolta(scelta) !== ultimaPartitaDelMazzo || candidate.every(c => ultimaVolta(c) > 0);
    if (!(regola1 && regola2 && regola3)) sceltaSempreGiusta = false;

    mazzo = risultato.mazzo;
    uscite.push(risultato.carta._chiave);
    segnaDomandaUscita(risultato.carta._chiave, numero, archivio);
  }
  return { uscite, numero, sceltaSempreGiusta };
}

console.log("\n--- La serata di ieri: mazzo sbilanciato, 8 domande appena aggiunte ---");
{
  const carte = creaCarte(114);
  const archivio = creaArchivioFinto();
  // Le 106 domande "vecchie" erano gia' uscite nelle partite precedenti (da
  // 1 a 3 partite fa); le ultime 8 sono nuove, mai uscite.
  carte.slice(0, 106).forEach((c, i) => segnaDomandaUscita(c._chiave, 1 + (i % 3), archivio));
  const nuove = carte.slice(106).map(c => c._chiave);

  // Ieri: ~49 domande mostrate per arrivare a 29 risposte (il resto cambiate).
  const prima = giocaPartita(carte, archivio, 49);
  const seconda = giocaPartita(carte, archivio, 50);
  const memoria = leggiMemoriaRotazione(archivio);

  const postiNuove = posizioni(prima.uscite, nuove);
  verifica("le 8 domande nuove escono tutte nella prima partita (49 domande mostrate)", postiNuove.length === 8);
  verifica("ma non una dopo l'altra: tra due nuove ci sono sempre almeno due altre domande", distanziate(postiNuove));
  verifica("nella seconda partita non esce nessuna domanda della prima (ieri le prime 8 lo erano tutte)", inComune(prima.uscite, seconda.uscite).length === 0);
  verifica("ogni scelta rispetta la rotazione", prima.sceltaSempreGiusta && seconda.sceltaSempreGiusta);
  verifica("la seconda partita ha il numero successivo alla prima", seconda.numero === prima.numero + 1);
  verifica("la memoria ricorda ogni domanda mostrata con il numero della sua partita",
    prima.uscite.every(k => memoria[k] === prima.numero) && seconda.uscite.every(k => memoria[k] === seconda.numero));
}

console.log("\n--- 300 serie casuali di 8 partite di fila (mazzi sbilanciati, Cambia domanda compreso) ---");
{
  let sceltaGiusta = true;
  let nessunaRipetizioneInPartita = true;
  let nessunaDellaPrecedente = true;
  let numeriConsecutivi = true;
  let memoriaCoerente = true;

  for (let prova = 0; prova < 300; prova++) {
    const dimensione = 20 + Math.floor(Math.random() * 131); // da 20 a 150 domande
    const carte = creaCarte(dimensione);
    const archivio = creaArchivioFinto();
    // Storia di partenza sbilanciata: circa meta' delle domande e' gia' uscita in passato.
    carte.forEach(c => {
      if (Math.random() < 0.5) segnaDomandaUscita(c._chiave, 1 + Math.floor(Math.random() * 5), archivio);
    });

    let precedenti = null;
    let numeroPrecedente = null;
    for (let partita = 0; partita < 8; partita++) {
      const pescate = 5 + Math.floor(Math.random() * 56); // da 5 a 60 domande mostrate
      const { uscite, numero, sceltaSempreGiusta } = giocaPartita(carte, archivio, pescate);
      if (!sceltaSempreGiusta) sceltaGiusta = false;
      if (numeroPrecedente !== null && numero !== numeroPrecedente + 1) numeriConsecutivi = false;
      numeroPrecedente = numero;

      const primoGiro = uscite.slice(0, dimensione);
      if (primoGiro.length !== new Set(primoGiro).size) nessunaRipetizioneInPartita = false;

      if (precedenti) {
        const maiUscite = dimensione - precedenti.size;
        if (inComune(uscite.slice(0, maiUscite), [...precedenti]).length > 0) nessunaDellaPrecedente = false;
      }
      precedenti = new Set(uscite);

      const memoria = leggiMemoriaRotazione(archivio);
      if (!uscite.every(k => memoria[k] === numero)) memoriaCoerente = false;
    }
  }
  verifica("ogni scelta rispetta la rotazione", sceltaGiusta);
  verifica("dentro una partita nessuna domanda si ripete prima che sia uscito tutto il mazzo", nessunaRipetizioneInPartita);
  verifica("la partita dopo non riparte da domande della partita prima, finche' ne restano di non uscite in quella", nessunaDellaPrecedente);
  verifica("i numeri delle partite crescono di uno alla volta", numeriConsecutivi);
  verifica("a fine partita la memoria ricorda tutte le domande mostrate", memoriaCoerente);
}

console.log("\n--- Partita piu' lunga del mazzo (35 domande, 70 pescate) ---");
{
  const { uscite, sceltaSempreGiusta } = giocaPartita(creaCarte(35), creaArchivioFinto(), 70);
  const primoGiro = uscite.slice(0, 35);
  const secondoGiro = uscite.slice(35);
  verifica("nelle prime 35 pescate escono tutte le domande, una volta sola", new Set(primoGiro).size === 35);
  verifica("anche nel secondo giro escono tutte, una volta sola", secondoGiro.length === 35 && new Set(secondoGiro).size === 35);
  verifica("la stessa domanda non esce mai due volte di fila, nemmeno al cambio di giro", uscite.every((k, i) => i === 0 || k !== uscite[i - 1]));
  verifica("il secondo giro riparte dalle domande uscite per prime (quelle di piu' tempo fa)", secondoGiro.every((k, i) => k === primoGiro[i]));
  verifica("ogni scelta rispetta la rotazione", sceltaSempreGiusta);
}

console.log("\n--- Domande nuove dopo UNA sola partita: tutte le vecchie sono dell'ultima, non c'e' posto per spargerle ---");
{
  const vecchie = creaCarte(100, 'vecchia');
  const nuove = creaCarte(10, 'nuova');
  const archivio = creaArchivioFinto();
  vecchie.forEach(c => segnaDomandaUscita(c._chiave, 5, archivio));
  // Una domanda cancellata dall'admin lascia solo una traccia nella memoria:
  // non deve dare fastidio.
  segnaDomandaUscita('cancellata', 9, archivio);

  const { uscite, sceltaSempreGiusta } = giocaPartita([...vecchie, ...nuove], archivio, 30);
  const primeDieci = new Set(uscite.slice(0, 10));
  verifica("le 10 domande nuove escono per prime", nuove.every(c => primeDieci.has(c._chiave)));
  verifica("una domanda cancellata, ancora nella memoria, non cambia niente", sceltaSempreGiusta && new Set(uscite).size === 30);
}

console.log("\n--- Cinque domande nuove (una sera di studio su Giona): escono sparse, non una dopo l'altra ---");
{
  // I numeri di questo scenario e del "caso limite" qui sotto dipendono da
  // DISTANZA_NOVITA (6) e DISTANZA_MINIMA_NOVITA (3) in js/mazzi.js: se li
  // cambi, vanno aggiornati anche qui.
  const vecchie = creaCarte(100, 'vecchia');
  const nuove = creaCarte(5, 'giona');
  const chiaviNuove = nuove.map(c => c._chiave);
  const PROVE = 300;
  let tutteInPartita = true;
  let sempreDistanziate = true;
  let vecchieInOrdine = true;
  let nessunaDellUltimaPartita = true;
  let nessunaRipetizione = true;
  let rotazioneRispettata = true;
  const primePosizioni = new Set();

  for (let prova = 0; prova < PROVE; prova++) {
    const archivio = creaArchivioFinto();
    // Le 100 vecchie sono uscite nelle ultime quattro partite, 25 per partita.
    vecchie.forEach((c, i) => segnaDomandaUscita(c._chiave, 1 + Math.floor(i / 25), archivio));
    const memoriaPrima = leggiMemoriaRotazione(archivio);

    const { uscite, sceltaSempreGiusta } = giocaPartita([...vecchie, ...nuove], archivio, 40);
    const posti = posizioni(uscite, chiaviNuove);
    const vecchieUscite = uscite.filter(k => !chiaviNuove.includes(k));

    if (posti.length !== 5) tutteInPartita = false;
    if (!distanziate(posti)) sempreDistanziate = false;
    if (!vecchieUscite.every((k, i) => i === 0 || memoriaPrima[k] >= memoriaPrima[vecchieUscite[i - 1]])) vecchieInOrdine = false;
    if (vecchieUscite.some(k => memoriaPrima[k] === 4)) nessunaDellUltimaPartita = false;
    if (new Set(uscite).size !== uscite.length) nessunaRipetizione = false;
    if (!sceltaSempreGiusta) rotazioneRispettata = false;
    primePosizioni.add(posti[0]);
  }
  verifica("le 5 nuove escono tutte in una partita normale (40 domande)", tutteInPartita);
  verifica("tra due nuove ci sono sempre almeno due altre domande (mai una dopo l'altra)", sempreDistanziate);
  verifica(`la posizione e' a caso: la prima nuova esce in uno dei primi 4 posti, a sorte (${primePosizioni.size} posizioni diverse su ${PROVE} partite)`, primePosizioni.size >= 4 && Math.max(...primePosizioni) <= 3);
  verifica("le vecchie escono comunque dalla piu' lontana nel tempo", vecchieInOrdine);
  verifica("nessuna domanda dell'ultima partita esce in mezzo", nessunaDellUltimaPartita);
  verifica("nessuna ripetizione, e ogni scelta rispetta la rotazione", nessunaRipetizione && rotazioneRispettata);
}

console.log("\n--- Tante domande nuove (browser nuovo, elenco aggiunto in blocco): escono tutte per prime ---");
{
  const vecchie = creaCarte(60, 'vecchia');
  const nuove = creaCarte(40, 'nuova');
  const archivio = creaArchivioFinto();
  vecchie.forEach((c, i) => segnaDomandaUscita(c._chiave, 1 + Math.floor(i / 20), archivio));
  const memoriaPrima = leggiMemoriaRotazione(archivio);

  const { uscite, sceltaSempreGiusta } = giocaPartita([...vecchie, ...nuove], archivio, 60);
  verifica("le 40 nuove escono per prime", nuove.every(c => uscite.slice(0, 40).includes(c._chiave)));
  verifica("poi le vecchie, cominciando dalle piu' lontane nel tempo", uscite.slice(40).every(k => memoriaPrima[k] === 1));
  verifica("ogni scelta rispetta la rotazione", sceltaSempreGiusta);
}

console.log("\n--- Browser nuovo: la prima passata sul mazzo esce completa prima che torni una domanda gia' vista ---");
{
  const carte = creaCarte(114);
  const archivio = creaArchivioFinto();
  const viste = new Set();
  let nessunaRipetuta = true;
  for (let partita = 1; partita <= 3; partita++) {
    const { uscite } = giocaPartita(carte, archivio, 30);
    if (uscite.some(k => viste.has(k))) nessunaRipetuta = false;
    uscite.forEach(k => viste.add(k));
  }
  verifica("le prime tre partite (90 domande su 114) non hanno nessuna ripetizione", nessunaRipetuta && viste.size === 90);

  // Ne restano 24 mai uscite: non sono "novita' da spargere" ma il resto del
  // mazzo, e devono uscire tutte prima che torni una domanda gia' vista.
  const maiUscite = carte.map(c => c._chiave).filter(k => !viste.has(k));
  const quarta = giocaPartita(carte, archivio, 30);
  verifica("restano 24 domande mai uscite", maiUscite.length === 24);
  verifica("la quarta partita comincia con tutte e 24, senza nessuna gia' vista in mezzo", maiUscite.every(k => quarta.uscite.slice(0, 24).includes(k)));
  verifica("poi riprende da quelle della prima partita (le piu' lontane nel tempo)", quarta.uscite.slice(24).every(k => viste.has(k)) && quarta.sceltaSempreGiusta);
}

console.log("\n--- Caso limite: quante nuove si riescono a spargere ---");
{
  // 20 vecchie di una partita lontana + 20 dell'ultima partita (che stanno in fondo).
  function pocoPosto(nVecchieLontane, nNuove) {
    const lontane = creaCarte(nVecchieLontane, 'lontana');
    const ultime = creaCarte(20, 'ultima');
    const nuove = creaCarte(nNuove, 'nuova');
    const archivio = creaArchivioFinto();
    lontane.forEach(c => segnaDomandaUscita(c._chiave, 1, archivio));
    ultime.forEach(c => segnaDomandaUscita(c._chiave, 2, archivio));
    const { uscite } = giocaPartita([...lontane, ...ultime, ...nuove], archivio, nVecchieLontane + nNuove);
    return posizioni(uscite, nuove.map(c => c._chiave));
  }

  // 10 nuove e 20 vecchie lontane: il posto basta giusto, una nuova ogni 3 domande.
  const bastaGiusto = pocoPosto(20, 10);
  verifica("10 nuove con 20 vecchie lontane: spargerle si puo', una ogni 3 domande", bastaGiusto.join() === '0,3,6,9,12,15,18,21,24,27');
  // Con una vecchia in meno non si riesce a tenerle a 3 posti: escono tutte per prime.
  const nonBasta = pocoPosto(19, 10);
  verifica("10 nuove con 19 vecchie lontane: non c'e' posto, escono tutte per prime", nonBasta.join() === '0,1,2,3,4,5,6,7,8,9');

  // Il tetto: fino a 10 nuove si spargono (se c'e' posto), da 11 in su escono tutte per prime.
  const diecicon100 = pocoPosto(100, 10);
  verifica("10 nuove con tante vecchie lontane: si spargono, una ogni 6 circa",
    diecicon100.length === 10 && distanziate(diecicon100) && diecicon100[0] <= 3 && diecicon100[9] >= 54 && diecicon100[9] <= 57);
  const undicicon100 = pocoPosto(100, 11);
  verifica("11 nuove, anche con tante vecchie lontane: troppe per essere delle novita', escono tutte per prime", undicicon100.join() === '0,1,2,3,4,5,6,7,8,9,10');
}

console.log("\n--- La coda e' sempre in ordine: 400 mazzi casuali, anche con memorie strane ---");
{
  let tutteLeCarteUnaVolta = true;
  let vecchieInOrdine = true;
  let nuoveDistanziateOInTesta = true;
  let nuoveAvantiAUltimaPartita = true;
  let rotazioneRispettata = true;
  let provePerTipo = { conSparse: 0, inTesta: 0, senzaNuove: 0 };

  for (let prova = 0; prova < 400; prova++) {
    const dimensione = 1 + Math.floor(Math.random() * 150);
    const carte = creaCarte(dimensione);
    const archivio = creaArchivioFinto();
    const frazioneNuove = [0, 0.02, 0.05, 0.1, 0.2, 0.4, 0.8, 1][Math.floor(Math.random() * 8)];
    const maxPartite = 1 + Math.floor(Math.random() * 8);
    carte.forEach(c => {
      if (Math.random() >= frazioneNuove) segnaDomandaUscita(c._chiave, 1 + Math.floor(Math.random() * maxPartite), archivio);
    });
    if (Math.random() < 0.3) segnaDomandaUscita('cancellata', 50, archivio);
    const memoriaPrima = leggiMemoriaRotazione(archivio);
    const ultimaVolta = (k) => memoriaPrima[k] || 0;

    const { uscite, sceltaSempreGiusta } = giocaPartita(carte, archivio, dimensione);
    const chiavi = carte.map(c => c._chiave);
    const nuove = chiavi.filter(k => ultimaVolta(k) === 0);
    const vecchieUscite = uscite.filter(k => ultimaVolta(k) > 0);
    const posti = posizioni(uscite, nuove);
    const massimo = Math.max(0, ...chiavi.map(ultimaVolta));

    if (uscite.length !== dimensione || new Set(uscite).size !== dimensione || !chiavi.every(k => uscite.includes(k))) tutteLeCarteUnaVolta = false;
    if (!vecchieUscite.every((k, i) => i === 0 || ultimaVolta(k) >= ultimaVolta(vecchieUscite[i - 1]))) vecchieInOrdine = false;
    const inTesta = posti.every((p, i) => p === i);
    if (!inTesta && !distanziate(posti)) nuoveDistanziateOInTesta = false;
    if (massimo > 0 && posti.length > 0) {
      const ultimaNuova = posti[posti.length - 1];
      if (uscite.some((k, i) => ultimaVolta(k) === massimo && i < ultimaNuova)) nuoveAvantiAUltimaPartita = false;
    }
    if (!sceltaSempreGiusta) rotazioneRispettata = false;

    if (posti.length === 0) provePerTipo.senzaNuove++;
    else if (inTesta) provePerTipo.inTesta++;
    else provePerTipo.conSparse++;
  }
  verifica("ogni carta esce una volta sola nel primo giro, nessuna si perde", tutteLeCarteUnaVolta);
  verifica("le domande gia' uscite in passato escono dalla piu' lontana nel tempo", vecchieInOrdine);
  verifica(`le nuove escono tutte per prime oppure sparse a 3 posti almeno (provati ${provePerTipo.conSparse} mazzi con nuove sparse, ${provePerTipo.inTesta} con nuove in testa, ${provePerTipo.senzaNuove} senza nuove)`, nuoveDistanziateOInTesta);
  verifica("le nuove escono sempre prima delle domande dell'ultima partita", nuoveAvantiAUltimaPartita);
  verifica("ogni scelta rispetta la rotazione", rotazioneRispettata);
  verifica("i tre casi sono stati provati tutti", provePerTipo.conSparse > 20 && provePerTipo.inTesta > 20 && provePerTipo.senzaNuove > 20);

  // Una memoria con valori strani (a mano, o rovinata) non deve far sparire carte.
  const carte = creaCarte(8);
  const stranezze = { 'domanda-1': -5, 'domanda-2': 'testo', 'domanda-3': NaN, 'domanda-4': null, 'domanda-5': undefined, 'domanda-6': 3, 'domanda-7': 0 };
  const coda = creaMazzoARotazione(carte, stranezze).carte.map(c => c._chiave);
  verifica("con una memoria dai valori strani nessuna carta sparisce o si duplica", coda.length === 8 && new Set(coda).size === 8);
}

console.log("\n--- Prima partita in assoluto (nessuna memoria) e quella subito dopo ---");
{
  const carte = creaCarte(114);
  const archivio = creaArchivioFinto();
  const prima = giocaPartita(carte, archivio, 40);
  const seconda = giocaPartita(carte, archivio, 40);
  verifica("la prima partita ha il numero 1", prima.numero === 1);
  verifica("la prima partita non ripete nessuna domanda", new Set(prima.uscite).size === 40);
  verifica("la seconda partita ha il numero 2", seconda.numero === 2);
  verifica("la seconda non ne ripropone nessuna della prima", inComune(prima.uscite, seconda.uscite).length === 0);

  // Senza memoria tutte le domande sono pari: decide il caso. Partendo ogni
  // volta da zero non deve uscire sempre la stessa domanda per prima.
  const primeUscite = new Set();
  for (let i = 0; i < 30; i++) primeUscite.add(giocaPartita(carte, creaArchivioFinto(), 1).uscite[0]);
  verifica(`senza memoria l'ordine e' casuale (${primeUscite.size} domande diverse come prima, su 30 partite nuove)`, primeUscite.size >= 15);
}

console.log("\n--- Un altro tabellone, con le sue partite, non disturba ---");
{
  const carte = creaCarte(114);
  const miaMemoria = creaArchivioFinto();
  const memoriaDegliAltri = creaArchivioFinto();

  const mia1 = giocaPartita(carte, miaMemoria, 40);
  for (let i = 0; i < 3; i++) giocaPartita(carte, memoriaDegliAltri, 40);
  const mia2 = giocaPartita(carte, miaMemoria, 40);

  verifica("le partite degli altri non fanno avanzare il mio numero di partita", mia2.numero === 2);
  verifica("la mia seconda partita non ripropone nessuna domanda della mia prima", inComune(mia1.uscite, mia2.uscite).length === 0);
}

console.log("\n--- Il tabellone si ricarica a meta' partita ---");
{
  const carte = creaCarte(114);
  const archivio = creaArchivioFinto();

  // Prima meta': 20 domande mostrate; una ogni tre viene cambiata con
  // "Cambia domanda", quindi mostrata ma non risposta.
  const memoria1 = leggiMemoriaRotazione(archivio);
  const numero1 = numeroNuovaPartita(memoria1);
  let mazzo1 = creaMazzoARotazione(carte, memoria1);
  const mostrate1 = [];
  const risposte1 = [];
  for (let i = 0; i < 20; i++) {
    const pescata = peschaARotazione(mazzo1);
    mazzo1 = pescata.mazzo;
    mostrate1.push(pescata.carta._chiave);
    segnaDomandaUscita(pescata.carta._chiave, numero1, archivio);
    if (i % 3 !== 2) risposte1.push(pescata.carta._chiave);
  }

  // Ricarica della pagina: come avvia() e riprendiPartitaEsistente(), si
  // rilegge la memoria, si ricostruisce il mazzo e si rimettono tra le
  // domande viste quelle gia' risposte (le teneva lo stato della partita).
  const memoria2 = leggiMemoriaRotazione(archivio);
  const numero2 = numeroNuovaPartita(memoria2);
  let mazzo2 = creaMazzoARotazione(carte, memoria2);
  mazzo2 = { ...mazzo2, visteInQuestaPartita: new Set([...mazzo2.visteInQuestaPartita, ...risposte1]) };
  const mostrate2 = [];
  for (let i = 0; i < 20; i++) {
    const pescata = peschaARotazione(mazzo2);
    mazzo2 = pescata.mazzo;
    mostrate2.push(pescata.carta._chiave);
    segnaDomandaUscita(pescata.carta._chiave, numero2, archivio);
  }

  verifica("dopo la ricarica non esce nessuna domanda gia' risposta", inComune(risposte1, mostrate2).length === 0);
  verifica("dopo la ricarica non tornano nemmeno quelle cambiate prima, finche' ce ne sono di mai viste", inComune(mostrate1, mostrate2).length === 0);
  verifica("le domande dopo la ricarica risultano piu' recenti di quelle di prima", numero2 > numero1);

  const dopo = giocaPartita(carte, archivio, 40);
  verifica("la partita successiva non riparte da nessuna delle 40 domande delle due meta'", inComune([...mostrate1, ...mostrate2], dopo.uscite).length === 0);
}

console.log("\n--- Il tabellone si ricarica a meta' partita, con 5 domande nuove in mezzo ---");
{
  const vecchie = creaCarte(100, 'vecchia');
  const nuove = creaCarte(5, 'nuova');
  const chiaviNuove = nuove.map(c => c._chiave);
  const carte = [...vecchie, ...nuove];
  const archivio = creaArchivioFinto();
  vecchie.forEach((c, i) => segnaDomandaUscita(c._chiave, 1 + Math.floor(i / 25), archivio));

  // Prima meta': 15 domande, tutte risposte.
  const memoria1 = leggiMemoriaRotazione(archivio);
  const numero1 = numeroNuovaPartita(memoria1);
  let mazzo1 = creaMazzoARotazione(carte, memoria1);
  const mostrate1 = [];
  for (let i = 0; i < 15; i++) {
    const pescata = peschaARotazione(mazzo1);
    mazzo1 = pescata.mazzo;
    mostrate1.push(pescata.carta._chiave);
    segnaDomandaUscita(pescata.carta._chiave, numero1, archivio);
  }

  // Ricarica della pagina, come nello scenario di prima.
  const memoria2 = leggiMemoriaRotazione(archivio);
  const numero2 = numeroNuovaPartita(memoria2);
  let mazzo2 = creaMazzoARotazione(carte, memoria2);
  mazzo2 = { ...mazzo2, visteInQuestaPartita: new Set([...mazzo2.visteInQuestaPartita, ...mostrate1]) };
  const mostrate2 = [];
  for (let i = 0; i < 30; i++) {
    const pescata = peschaARotazione(mazzo2);
    mazzo2 = pescata.mazzo;
    mostrate2.push(pescata.carta._chiave);
    segnaDomandaUscita(pescata.carta._chiave, numero2, archivio);
  }

  verifica("dopo la ricarica non esce nessuna domanda gia' uscita prima", inComune(mostrate1, mostrate2).length === 0);
  verifica("le nuove non ancora uscite prima della ricarica escono dopo: in tutto le 5 nuove sono uscite una volta sola",
    chiaviNuove.every(k => [...mostrate1, ...mostrate2].filter(x => x === k).length === 1));
  const nuoveDopo = posizioni(mostrate2, chiaviNuove);
  verifica("prima della ricarica ne escono almeno 2, dopo almeno altre 2 (le nuove non sono tutte da una parte)",
    posizioni(mostrate1, chiaviNuove).length >= 2 && nuoveDopo.length >= 2);
  verifica("dopo la ricarica le nuove restanti sono ancora distanziate tra loro", distanziate(nuoveDopo));

  const dopo = giocaPartita(carte, archivio, 40);
  verifica("la partita successiva non riparte da nessuna delle 45 domande delle due meta'", inComune([...mostrate1, ...mostrate2], dopo.uscite).length === 0);
}

console.log("\n--- Mazzo normale e mazzo junior insieme, con la stessa memoria ---");
{
  const normali = creaCarte(114, 'normale');
  const junior = creaCarte(35, 'junior');
  const archivio = creaArchivioFinto();

  // Una partita con tutti e due i mazzi, come quando ci sono bambini: 13
  // domande junior e 30 normali, tutte segnate nella stessa memoria.
  function giocaConDueMazzi() {
    const memoria = leggiMemoriaRotazione(archivio);
    const numero = numeroNuovaPartita(memoria);
    let mazzoNormale = creaMazzoARotazione(normali, memoria);
    let mazzoJunior = creaMazzoARotazione(junior, memoria);
    const usciteNormali = [];
    const usciteJunior = [];
    for (let i = 0; i < 13; i++) {
      const pescata = peschaARotazione(mazzoJunior);
      mazzoJunior = pescata.mazzo;
      usciteJunior.push(pescata.carta._chiave);
      segnaDomandaUscita(pescata.carta._chiave, numero, archivio);
    }
    for (let i = 0; i < 30; i++) {
      const pescata = peschaARotazione(mazzoNormale);
      mazzoNormale = pescata.mazzo;
      usciteNormali.push(pescata.carta._chiave);
      segnaDomandaUscita(pescata.carta._chiave, numero, archivio);
    }
    return { usciteNormali, usciteJunior };
  }

  const g1 = giocaConDueMazzi();
  const g2 = giocaConDueMazzi();
  const g3 = giocaConDueMazzi();

  verifica("normali: tre partite di fila (90 domande su 114) senza nessuna ripetizione",
    new Set([...g1.usciteNormali, ...g2.usciteNormali, ...g3.usciteNormali]).size === 90);
  verifica("junior: le prime due partite non hanno domande in comune", inComune(g1.usciteJunior, g2.usciteJunior).length === 0);
  verifica("junior: la terza partita finisce prima le 9 mai uscite (35 - 26)", g3.usciteJunior.slice(0, 9).every(k => !g1.usciteJunior.includes(k) && !g2.usciteJunior.includes(k)));
  verifica("junior: poi ripesca da quelle di piu' tempo fa (la prima partita), non dalla seconda", g3.usciteJunior.slice(9).every(k => g1.usciteJunior.includes(k)));
}

console.log("\n--- La memoria nel browser: letta e scritta senza mai dare errore ---");
{
  const conTesto = (testo) => ({ getItem: () => testo, setItem: () => {} });
  const vuota = (memoria) => Object.keys(memoria).length === 0;
  function nonSollevaErrori(funzione) {
    try { funzione(); return true; } catch (errore) { return false; }
  }

  verifica("memoria mai salvata: elenco vuoto", vuota(leggiMemoriaRotazione(creaArchivioFinto())));
  verifica("testo che non e' un JSON: elenco vuoto", vuota(leggiMemoriaRotazione(conTesto('non e un json {'))));
  verifica("al posto dell'elenco c'e' una lista: elenco vuoto", vuota(leggiMemoriaRotazione(conTesto('[1,2,3]'))));
  verifica("al posto dell'elenco c'e' null, un testo o un numero: elenco vuoto",
    vuota(leggiMemoriaRotazione(conTesto('null'))) && vuota(leggiMemoriaRotazione(conTesto('"testo"'))) && vuota(leggiMemoriaRotazione(conTesto('42'))));

  const mista = leggiMemoriaRotazione(conTesto('{"a":3,"b":"x","c":null,"d":7,"e":{"x":1},"f":true,"g":-2,"h":2.5,"i":1e300}'));
  verifica("valori che non sono numeri di partita (testi, null, decimali, negativi, enormi...) vengono ignorati, gli altri restano",
    Object.keys(mista).length === 2 && mista.a === 3 && mista.d === 7);
  verifica("un numero enorme nella memoria non blocca il conteggio delle partite",
    numeroNuovaPartita(leggiMemoriaRotazione(conTesto('{"a":1e300,"b":4}'))) === 5);

  const archivioBloccato = {
    getItem() { throw new Error('archivio bloccato'); },
    setItem() { throw new Error('archivio bloccato'); }
  };
  verifica("archivio che da' errore in lettura: elenco vuoto, nessun errore", nonSollevaErrori(() => leggiMemoriaRotazione(archivioBloccato)) && vuota(leggiMemoriaRotazione(archivioBloccato)));
  verifica("archivio che da' errore in scrittura (spazio finito): nessun errore", nonSollevaErrori(() => segnaDomandaUscita('x', 1, archivioBloccato)));
  verifica("nessun archivio (null): nessun errore in lettura e in scrittura",
    nonSollevaErrori(() => leggiMemoriaRotazione(null)) && nonSollevaErrori(() => segnaDomandaUscita('x', 1, null)));

  // Browser che blocca i dati dei siti: gia' solo nominare localStorage da' errore.
  const originale = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let senzaArchivioNonSollevaErrori = null;
  try {
    Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('SecurityError'); }, configurable: true });
    senzaArchivioNonSollevaErrori = nonSollevaErrori(() => {
      leggiMemoriaRotazione();
      segnaDomandaUscita('x', 1);
    });
  } catch (errore) {
    senzaArchivioNonSollevaErrori = null; // non si puo' simulare in questo ambiente
  } finally {
    if (originale) Object.defineProperty(globalThis, 'localStorage', originale);
    else delete globalThis.localStorage;
  }
  if (senzaArchivioNonSollevaErrori !== null) {
    verifica("browser che blocca localStorage: nessun errore, il gioco parte lo stesso", senzaArchivioNonSollevaErrori);
  }

  verifica("numero della prima partita (memoria vuota) = 1", numeroNuovaPartita({}) === 1);
  verifica("numero della partita dopo = uno piu' del piu' alto gia' visto", numeroNuovaPartita({ a: 3, b: 7 }) === 8);

  const archivio = creaArchivioFinto();
  segnaDomandaUscita('x', 4, archivio);
  segnaDomandaUscita('y', 6, archivio);
  segnaDomandaUscita('x', 7, archivio);
  const memoria = leggiMemoriaRotazione(archivio);
  verifica("segnare una domanda tiene anche le altre e aggiorna quella gia' presente", Object.keys(memoria).length === 2 && memoria.x === 7 && memoria.y === 6);

  // Se la memoria non funziona si gioca lo stesso: il "gia' uscita in questa
  // partita" sta nel mazzo, non nella memoria.
  const senzaMemoria = giocaPartita(creaCarte(114), archivioBloccato, 40);
  verifica("con la memoria che non funziona si gioca lo stesso, senza ripetizioni dentro la partita", senzaMemoria.numero === 1 && new Set(senzaMemoria.uscite).size === 40);
}

console.log("\n--- Il tabellone usa davvero la rotazione (controllo sul testo di js/tabellone-ui.js) ---");
{
  // Un controllo "sul testo": se dopo una modifica a tabellone-ui.js uno di
  // questi si rompe, vuol dire che la rotazione e' stata scollegata dal gioco
  // vero, e le domande tornerebbero a ripetersi da una partita all'altra.
  const testo = fs.readFileSync(new URL('./js/tabellone-ui.js', import.meta.url), 'utf8');
  const inizio = testo.indexOf('const pescaProssimaCarta = () => {');
  const finePrimaChiamata = testo.indexOf('pescaProssimaCarta();', inizio);
  const corpoPescata = inizio >= 0 && finePrimaChiamata > inizio ? testo.slice(inizio, finePrimaChiamata) : '';

  verifica("ogni domanda mostrata, anche quella poi cambiata con Cambia domanda, viene segnata subito",
    /segnaDomandaUscita\(\s*carta\._chiave\s*,\s*numeroPartita\s*\)/.test(corpoPescata));
  verifica("la pescata della Conoscenza (normale e junior) usa la rotazione",
    /peschaARotazione\(\s*mazzoConoscenza\s*\)/.test(corpoPescata) && /peschaARotazione\(\s*mazzoConoscenzaJunior\s*\)/.test(corpoPescata));
  verifica("a inizio partita la memoria viene letta dal browser", /memoriaRotazione\s*=\s*leggiMemoriaRotazione\(\s*\)/.test(testo));
  verifica("a inizio partita si calcola il numero della nuova partita", /numeroPartita\s*=\s*numeroNuovaPartita\(\s*memoriaRotazione\s*\)/.test(testo));
  verifica("il mazzo normale parte dalla memoria", /creaMazzoARotazione\(\s*carteConoscenzaNormali\s*,\s*memoriaRotazione\s*\)/.test(testo));
  verifica("il mazzo junior parte dalla memoria", /creaMazzoARotazione\(\s*carteConoscenzaJunior\s*,\s*memoriaRotazione\s*\)/.test(testo));
  verifica("la ripresa dopo un riavvio tiene il mazzo normale intero e vi aggiunge le domande gia' chieste",
    /mazzoConoscenza\s*=\s*\{\s*\.\.\.mazzoConoscenza\s*,\s*visteInQuestaPartita\s*:\s*new Set\(\[\s*\.\.\.mazzoConoscenza\.visteInQuestaPartita\s*,\s*\.\.\.conoscenzaGiaChieste\s*\]\)/.test(testo));
  verifica("la ripresa dopo un riavvio tiene il mazzo junior intero e vi aggiunge le domande gia' chieste",
    /mazzoConoscenzaJunior\s*=\s*\{\s*\.\.\.mazzoConoscenzaJunior\s*,\s*visteInQuestaPartita\s*:\s*new Set\(\[\s*\.\.\.mazzoConoscenzaJunior\.visteInQuestaPartita\s*,\s*\.\.\.conoscenzaGiaChieste\s*\]\)/.test(testo));
}

if (fallite > 0) {
  console.log(`\n❌ ${fallite} verifiche non passate`);
  process.exitCode = 1;
} else {
  console.log("\n✅ Tutte le verifiche passate");
}
