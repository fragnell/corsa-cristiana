// test-admin-conoscenza.mjs
// Prove dei filtri dell'elenco delle domande Conoscenza nell'Admin (js/filtri-carte.js):
// ricerca (anche senza accenti, anche nelle risposte), livello normali/junior, tipo, link Approfondisci,
// ordinamenti, conteggi, e che nessun dato strano di Firebase possa far rompere l'elenco.
// Si lancia con:  node test-admin-conoscenza.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  FILTRI_INIZIALI, normalizzaTesto, livelloDi, tipoDi, statoLink, risposteDi, descriviRisposta, testoDiRicerca,
  corrisponde, ordinaCarte, filtraCarte, filtriAttivi, contaCarte, proteggiHtml
} from './js/filtri-carte.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.message).split('\n').join('\n        ')}`); }
}

const LINK_BUONO = 'https://www.jw.org/finder?wtlocale=I&docid=1102014618&srctype=wol&srcid=share&par=2';
const LINK_CATTIVO = 'http://www.example.com/pagina';

// Un piccolo mazzo che copre tutte le combinazioni (l'ordine e' quello "di inserimento")
const MAZZO = [
  { _chiave: 'k01', tipo: 'scelta', domanda: 'Dove vivevano inizialmente Adamo ed Eva?', opzioni: ["Nel giardino dell'Eden", "Nell'Arca di Noè", 'Sul Monte Carmelo'], rispostaCorretta: "Nel giardino dell'Eden", junior: true },
  { _chiave: 'k02', tipo: 'scelta', domanda: 'Quale fu il primo miracolo compiuto da Gesù?', opzioni: ['Risuscitò Lazzaro', 'Trasformò l\'acqua in vino', 'Sfamò una folla'], rispostaCorretta: 'Trasformò l\'acqua in vino', linkApprofondimento: LINK_BUONO },
  { _chiave: 'k03', tipo: 'diretta', domanda: 'Chi costruì l\'arca?', risposta: 'Noè', linkApprofondimento: LINK_BUONO },
  { _chiave: 'k04', tipo: 'diretta', domanda: 'Chi fu il più forte tra i giudici d\'Israele?', risposta: ['Sansone', 'Sanson'] },
  { _chiave: 'k05', tipo: 'elenco', domanda: 'Cita almeno 3 parabole usate da Gesù.', minimoRichiesto: 3, rispostePossibili: ['Il seminatore', 'Il buon samaritano', 'I talenti', 'Il figliol prodigo'], linkApprofondimento: LINK_CATTIVO },
  { _chiave: 'k06', tipo: 'scelta', domanda: 'Chi era il padre di Davide?', opzioni: ['Iesse', 'Saul', 'Natan'], rispostaCorretta: 'Iesse', junior: true, linkApprofondimento: LINK_BUONO },
  { _chiave: 'k07', tipo: 'scelta', domanda: 'Quanti furono i discepoli scelti da Gesù come apostoli?', opzioni: ['7', '12', '70'], rispostaCorretta: '12' },
  { _chiave: 'k08', tipo: 'diretta', domanda: 'In che città nacque Gesù?', risposta: 'Betlemme', linkApprofondimento: '' },
  { _chiave: 'k09', tipo: 'scelta', domanda: 'Quale animale parlò a Balaam?', opzioni: ['Un asino', 'Un cavallo', 'Un cammello'], rispostaCorretta: 'Un asino', junior: true },
  { _chiave: 'k10', tipo: 'diretta', domanda: 'Come si chiamava la moglie di Abraamo?', risposta: 'Sara' }
];

const chiavi = carte => carte.map(c => c._chiave);
const trova = filtri => chiavi(filtraCarte(MAZZO, filtri));

// ================= i pezzetti =================

prova('normalizzaTesto: minuscolo, senza accenti, apostrofi uguali, spazi singoli', () => {
  assert.equal(normalizzaTesto('  ÈSODO   e   Età  '), 'esodo e eta');
  assert.equal(normalizzaTesto('dell’Eden'), "dell'eden");
  assert.equal(normalizzaTesto("L`arca"), "l'arca");
});

prova('normalizzaTesto: undefined, null e numeri non rompono niente', () => {
  assert.equal(normalizzaTesto(undefined), '');
  assert.equal(normalizzaTesto(null), '');
  assert.equal(normalizzaTesto(12), '12');
});

prova('livelloDi: junior solo se la carta lo dice', () => {
  assert.equal(livelloDi(MAZZO[0]), 'junior');
  assert.equal(livelloDi(MAZZO[1]), 'normale');
  assert.equal(livelloDi({ junior: false }), 'normale');
  assert.equal(livelloDi(undefined), 'normale');
});

prova('tipoDi: un tipo sconosciuto si tratta come "diretta"', () => {
  assert.equal(tipoDi({ tipo: 'elenco' }), 'elenco');
  assert.equal(tipoDi({ tipo: 'scelta' }), 'scelta');
  assert.equal(tipoDi({ tipo: 'strano' }), 'diretta');
  assert.equal(tipoDi({}), 'diretta');
  assert.equal(tipoDi(null), 'diretta');
});

prova('statoLink: con (link buono), nonvalido (scritto male), senza (niente)', () => {
  assert.equal(statoLink({ linkApprofondimento: LINK_BUONO }), 'con');
  assert.equal(statoLink({ linkApprofondimento: LINK_CATTIVO }), 'nonvalido');
  assert.equal(statoLink({ linkApprofondimento: 'ciao' }), 'nonvalido');
  assert.equal(statoLink({}), 'senza');
  assert.equal(statoLink({ linkApprofondimento: '' }), 'senza');
  assert.equal(statoLink({ linkApprofondimento: '   ' }), 'senza');
  assert.equal(statoLink({ linkApprofondimento: null }), 'senza');
  assert.equal(statoLink(null), 'senza');
});

prova('risposteDi: raccoglie risposte, possibili, opzioni e corretta (anche i dati strani di Firebase)', () => {
  assert.deepEqual(risposteDi({ risposta: 'Noè' }), ['Noè']);
  assert.deepEqual(risposteDi({ risposta: ['Sansone', 'Sanson'] }), ['Sansone', 'Sanson']);
  assert.deepEqual(risposteDi({ risposta: { 0: 'a', 2: 'b' } }), ['a', 'b'], 'un array "bucato" torna come oggetto');
  assert.deepEqual(risposteDi({ rispostePossibili: ['x', 'y'] }), ['x', 'y']);
  assert.deepEqual(risposteDi({ opzioni: ['1', '2'], rispostaCorretta: '2' }), ['1', '2', '2']);
  assert.deepEqual(risposteDi({ risposta: ['', '  ', 'ok'] }), ['ok']);
  assert.deepEqual(risposteDi({}), []);
  assert.deepEqual(risposteDi(null), []);
});

prova('descriviRisposta: una riga breve con la risposta giusta, per ogni tipo', () => {
  assert.equal(descriviRisposta(MAZZO[0]), "✔ Nel giardino dell'Eden");
  assert.equal(descriviRisposta(MAZZO[2]), 'Noè');
  assert.equal(descriviRisposta(MAZZO[3]), 'Sansone · Sanson');
  assert.equal(descriviRisposta(MAZZO[4]), 'almeno 3 tra 4 risposte possibili');
  assert.equal(descriviRisposta({ tipo: 'scelta', opzioni: ['a', 'b'] }), '');
  assert.equal(descriviRisposta({ tipo: 'diretta' }), '');
  assert.equal(descriviRisposta(null), '');
});

prova('testoDiRicerca: contiene la domanda e tutte le risposte, normalizzate', () => {
  const t = testoDiRicerca(MAZZO[0]);
  assert.ok(t.includes('adamo') && t.includes("giardino dell'eden") && t.includes('sul monte carmelo'));
  assert.ok(testoDiRicerca(MAZZO[1]).includes('trasformo'), 'senza accenti');
});

// ================= i filtri, uno alla volta =================

prova('senza filtri passano tutte, nell\'ordine in cui sono arrivate', () => {
  assert.deepEqual(trova({}), ['k01', 'k02', 'k03', 'k04', 'k05', 'k06', 'k07', 'k08', 'k09', 'k10']);
  assert.deepEqual(trova(FILTRI_INIZIALI), trova({}));
  assert.deepEqual(trova(undefined), trova({}));
  assert.deepEqual(chiavi(filtraCarte(undefined, {})), []);
});

prova('livello junior: solo le domande junior', () => {
  assert.deepEqual(trova({ livello: 'junior' }), ['k01', 'k06', 'k09']);
});

prova('livello normali: tutte tranne le junior', () => {
  assert.deepEqual(trova({ livello: 'normali' }), ['k02', 'k03', 'k04', 'k05', 'k07', 'k08', 'k10']);
});

prova('tipo: diretta / elenco / scelta', () => {
  assert.deepEqual(trova({ tipo: 'diretta' }), ['k03', 'k04', 'k08', 'k10']);
  assert.deepEqual(trova({ tipo: 'elenco' }), ['k05']);
  assert.deepEqual(trova({ tipo: 'scelta' }), ['k01', 'k02', 'k06', 'k07', 'k09']);
});

prova('link: con, senza, nonvalido', () => {
  assert.deepEqual(trova({ link: 'con' }), ['k02', 'k03', 'k06']);
  assert.deepEqual(trova({ link: 'nonvalido' }), ['k05']);
  assert.deepEqual(trova({ link: 'senza' }), ['k01', 'k04', 'k07', 'k08', 'k09', 'k10']);
});

prova('un valore di filtro sconosciuto non nasconde niente (e non rompe)', () => {
  assert.equal(trova({ livello: 'boh', tipo: 'boh', link: 'boh' }).length, MAZZO.length);
});

// ================= la ricerca =================

prova('ricerca nel testo della domanda', () => {
  assert.deepEqual(trova({ testo: 'davide' }), ['k06']);
  assert.deepEqual(trova({ testo: 'DAVIDE' }), ['k06']);
});

prova('ricerca senza accenti: "Noe" trova "Noè" e "Gesu" trova "Gesù"', () => {
  assert.ok(trova({ testo: 'noe' }).includes('k01'), 'Nell\'Arca di Noè (nelle opzioni)');
  assert.deepEqual(trova({ testo: 'gesu' }), ['k02', 'k05', 'k07', 'k08']);
});

prova('ricerca nelle risposte e nelle opzioni, non solo nella domanda', () => {
  assert.deepEqual(trova({ testo: 'betlemme' }), ['k08']);
  assert.deepEqual(trova({ testo: 'sansone' }), ['k04']);
  assert.deepEqual(trova({ testo: 'asino' }), ['k09']);
  assert.deepEqual(trova({ testo: 'seminatore' }), ['k05']);
});

prova('ricerca con piu\' parole: devono esserci tutte (in qualunque ordine)', () => {
  assert.deepEqual(trova({ testo: 'gesu nacque' }), ['k08']);
  assert.deepEqual(trova({ testo: 'nacque gesu' }), ['k08']);
  assert.deepEqual(trova({ testo: 'gesu zzzz' }), []);
});

prova('ricerca con l\'apostrofo scritto in modi diversi', () => {
  assert.deepEqual(trova({ testo: 'dell’eden' }), ['k01']);
  assert.deepEqual(trova({ testo: "dell'eden" }), ['k01']);
});

prova('ricerca vuota o fatta di soli spazi: non filtra', () => {
  assert.equal(trova({ testo: '' }).length, 10);
  assert.equal(trova({ testo: '    ' }).length, 10);
});

prova('ricerca con caratteri speciali: niente errori (non e\' una "espressione regolare")', () => {
  assert.doesNotThrow(() => trova({ testo: '(((' }));
  assert.doesNotThrow(() => trova({ testo: '.*[' }));
  assert.deepEqual(trova({ testo: '.*' }), []);
});

// ================= i filtri insieme =================

prova('junior + scelta + con link', () => {
  assert.deepEqual(trova({ livello: 'junior', tipo: 'scelta', link: 'con' }), ['k06']);
});

prova('normali + scelta: le domande a scelta multipla non junior', () => {
  assert.deepEqual(trova({ livello: 'normali', tipo: 'scelta' }), ['k02', 'k07']);
});

prova('junior + ricerca', () => {
  assert.deepEqual(trova({ livello: 'junior', testo: 'asino' }), ['k09']);
  assert.deepEqual(trova({ livello: 'junior', testo: 'betlemme' }), []);
});

prova('combinazione senza risultati: elenco vuoto, non un errore', () => {
  assert.deepEqual(trova({ livello: 'junior', tipo: 'elenco' }), []);
});

prova('corrisponde: stessa risposta di filtraCarte, carta per carta', () => {
  const f = { livello: 'normali', tipo: 'diretta', link: 'con' };
  const viaCorrisponde = MAZZO.filter(c => corrisponde(c, f)).map(c => c._chiave);
  assert.deepEqual(viaCorrisponde, trova(f));
  assert.deepEqual(viaCorrisponde, ['k03']);
});

// ================= gli ordinamenti =================

prova('ordine "recenti": le ultime inserite per prime', () => {
  assert.deepEqual(trova({ ordine: 'recenti' }), ['k10', 'k09', 'k08', 'k07', 'k06', 'k05', 'k04', 'k03', 'k02', 'k01']);
});

prova('ordine "az": alfabetico sulla domanda', () => {
  const ordinate = filtraCarte(MAZZO, { ordine: 'az' }).map(c => c.domanda);
  const attese = [...ordinate].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
  assert.deepEqual(ordinate, attese);
  assert.equal(ordinate[0], 'Chi costruì l\'arca?');
});

prova('ordine "az": una domanda mancante non rompe l\'ordinamento', () => {
  const r = ordinaCarte([{ _chiave: 'x' }, { _chiave: 'y', domanda: 'A' }], 'az');
  assert.equal(r.length, 2);
});

prova('ordine "senzalink": prima senza link, poi link non valido, poi con link (a parita\' resta l\'ordine di arrivo)', () => {
  assert.deepEqual(trova({ ordine: 'senzalink' }), ['k01', 'k04', 'k07', 'k08', 'k09', 'k10', 'k05', 'k02', 'k03', 'k06']);
});

prova('ordine sconosciuto = ordine di arrivo', () => {
  assert.deepEqual(trova({ ordine: 'boh' }), trova({}));
});

prova('ordine + filtro insieme', () => {
  assert.deepEqual(trova({ livello: 'junior', ordine: 'recenti' }), ['k09', 'k06', 'k01']);
});

prova('ordinaCarte e filtraCarte non modificano mai l\'elenco ricevuto', () => {
  const copia = JSON.stringify(MAZZO);
  ordinaCarte(MAZZO, 'recenti'); ordinaCarte(MAZZO, 'az'); ordinaCarte(MAZZO, 'senzalink');
  filtraCarte(MAZZO, { livello: 'junior', ordine: 'az' });
  assert.equal(JSON.stringify(MAZZO), copia);
});

// ================= i conteggi =================

prova('contaCarte: i numeri accanto ai pulsanti', () => {
  const c = contaCarte(MAZZO);
  assert.equal(c.totale, 10);
  assert.deepEqual(c.livello, { normali: 7, junior: 3 });
  assert.deepEqual(c.tipo, { diretta: 4, elenco: 1, scelta: 5 });
  assert.deepEqual(c.link, { con: 3, senza: 6, nonvalido: 1 });
});

prova('contaCarte: le somme tornano sempre al totale', () => {
  const c = contaCarte(MAZZO);
  assert.equal(c.livello.normali + c.livello.junior, c.totale);
  assert.equal(c.tipo.diretta + c.tipo.elenco + c.tipo.scelta, c.totale);
  assert.equal(c.link.con + c.link.senza + c.link.nonvalido, c.totale);
});

prova('contaCarte: elenco vuoto, mancante o con dati sporchi', () => {
  assert.equal(contaCarte([]).totale, 0);
  assert.equal(contaCarte(undefined).totale, 0);
  const c = contaCarte([{}, { tipo: 'boh', junior: true }, null]);
  assert.equal(c.totale, 3);
  assert.equal(c.tipo.diretta, 3);
});

prova('filtriAttivi: conta quanti filtri sono accesi (la ricerca vuota non conta, l\'ordine nemmeno)', () => {
  assert.equal(filtriAttivi({}), 0);
  assert.equal(filtriAttivi({ ordine: 'az' }), 0);
  assert.equal(filtriAttivi({ testo: '   ' }), 0);
  assert.equal(filtriAttivi({ testo: 'x' }), 1);
  assert.equal(filtriAttivi({ livello: 'junior', tipo: 'scelta', link: 'con', testo: 'x' }), 4);
});

// ================= dati strani =================

prova('carte con campi mancanti o strani non rompono i filtri', () => {
  const sporco = [{}, { domanda: null }, { domanda: 42, tipo: 'boh' }, { domanda: 'ok', risposta: { 0: 'x' } }, null, undefined];
  assert.doesNotThrow(() => filtraCarte(sporco.filter(Boolean), { testo: 'ok', livello: 'normali', tipo: 'diretta', link: 'senza', ordine: 'az' }));
  assert.deepEqual(filtraCarte(sporco.filter(Boolean), { testo: 'x' }).map(c => c.domanda), ['ok']);
});

prova('proteggiHtml: una domanda con < > & " \' non diventa un pezzo di pagina', () => {
  assert.equal(proteggiHtml('<b>"A" & \'B\'</b>'), '&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;');
  assert.equal(proteggiHtml(undefined), '');
  assert.equal(proteggiHtml(null), '');
  assert.equal(proteggiHtml(7), '7');
});

// ================= con le domande vere del progetto =================

const cartella = path.dirname(fileURLToPath(import.meta.url));

prova('con le domande di esempio del progetto (dati/carte-conoscenza.json) i filtri funzionano', () => {
  const carte = JSON.parse(readFileSync(path.join(cartella, 'dati', 'carte-conoscenza.json'), 'utf-8')).carte;
  assert.ok(carte.length >= 10);
  const c = contaCarte(carte);
  assert.equal(c.totale, carte.length);
  assert.equal(filtraCarte(carte, {}).length, carte.length);
  assert.equal(filtraCarte(carte, { tipo: 'elenco' }).length, c.tipo.elenco);
  assert.equal(filtraCarte(carte, { livello: 'junior' }).length, c.livello.junior);
  assert.ok(filtraCarte(carte, { testo: 'parabole' }).length >= 1);
});

// ================= tante domande =================

prova('con 3000 domande i filtri restano veloci (meno di 2 secondi per 20 filtraggi)', () => {
  const tante = Array.from({ length: 3000 }, (_, i) => ({
    _chiave: 'k' + i, tipo: ['diretta', 'elenco', 'scelta'][i % 3], domanda: `Domanda numero ${i} su Mosè e Davide`,
    risposta: 'x' + i, ...(i % 4 === 0 ? { junior: true } : {}), ...(i % 5 === 0 ? { linkApprofondimento: LINK_BUONO } : {})
  }));
  const inizio = Date.now();
  let totale = 0;
  for (let k = 0; k < 20; k++) totale += filtraCarte(tante, { testo: 'mose davide', livello: k % 2 ? 'junior' : 'tutte', ordine: 'az' }).length;
  const ms = Date.now() - inizio;
  assert.ok(totale > 0);
  assert.ok(ms < 2000, `${ms} ms`);
});

// ================= esito =================

console.log(`\nFiltri delle domande Conoscenza: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
