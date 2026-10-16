// test-suono-avviso.mjs
// Prove del suono dell'avviso (js/suono-avviso.js): il file del suono e il «din» di riserva (le note e il loro
// volume), lo sblocco dell'audio, l'interruttore «Suono» e la scelta che si ricorda. Si lancia con:
//   node test-suono-avviso.mjs
//
// Niente audio vero: il "contesto audio", lo scaricamento del file, la memoria del browser, l'orologio e la pagina
// sono FINTI.

import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CHIAVE_SUONO, DISEGNI_SUONO, ATTACCO_S, DURATA_NOTA_S, VOLUME_MASSIMO, ATTESA_MASSIMA_MS,
  FILE_SUONO, VOLUME_FILE, PAUSA_TRA_TENTATIVI_MS,
  programmaSuono, creaSuonoAvviso, collegaPulsanteSuono
} from './js/suono-avviso.js';

let provati = 0;
const falliti = [];
async function prova(nome, fn) {
  provati++;
  try { await fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.stack || e.message).split('\n').slice(0, 5).join('\n        ')}`); }
}

// ---- i finti ----------------------------------------------------------------------------------------------

function creaParametro() {
  const chiamate = [];
  return {
    chiamate,
    setValueAtTime(v, t) { chiamate.push(['imposta', v, t]); },
    linearRampToValueAtTime(v, t) { chiamate.push(['sale', v, t]); },
    exponentialRampToValueAtTime(v, t) { chiamate.push(['svanisce', v, t]); }
  };
}

// Un "contesto audio" finto che si ricorda tutto quello che gli viene chiesto.
//  statoIniziale: 'running' (come Chrome dopo un tocco) o 'suspended' (come un iPhone prima del tocco)
//  risveglio: 'subito' (resume() riesce), 'mai' (resume() non finisce mai), 'a-mano' (finisce quando lo decide il collaudo)
//  lettura: come va la lettura del file del suono: 'ok' (come i telefoni nuovi: funzioni di ritorno E promessa),
//           'solo-funzioni' (telefoni vecchi: nessuna promessa), 'errore' (file rovinato), 'lancia' (la funzione stessa
//           va in errore), 'vuoto' (risponde senza niente)
function creaAudioFinto({ statoIniziale = 'running', risveglio = 'subito', lettura = 'ok' } = {}) {
  const registro = { creati: 0, resume: 0, gain: [], oscillatori: [], buffer: 0, sorgenti: [], risolvi: [], tempo: 10, letture: [] };
  class Contesto {
    constructor() {
      registro.creati++;
      this.state = statoIniziale;
      this.destination = { nome: 'uscita' };
      registro.istanza = this;
    }
    get currentTime() { return registro.tempo; }
    resume() {
      registro.resume++;
      if (risveglio === 'subito') { this.state = 'running'; return Promise.resolve(); }
      if (risveglio === 'a-mano') return new Promise((ok) => { registro.risolvi.push(() => { this.state = 'running'; ok(); }); });
      return new Promise(() => {});
    }
    createGain() {
      const g = { gain: creaParametro(), collegato: [], connect(x) { this.collegato.push(x); } };
      registro.gain.push(g);
      return g;
    }
    createOscillator() {
      const o = { type: null, frequency: creaParametro(), collegato: [], inizio: null, fine: null, connect(x) { this.collegato.push(x); }, start(t) { this.inizio = t; }, stop(t) { this.fine = t; } };
      registro.oscillatori.push(o);
      return o;
    }
    createBuffer(canali, lunghezza, frequenza) { registro.buffer++; return { canali, lunghezza, frequenza }; }
    createBufferSource() {
      const s = { buffer: null, collegato: [], partito: false, inizio: null, connect(x) { this.collegato.push(x); }, start(t) { this.partito = true; this.inizio = t; } };
      registro.sorgenti.push(s);
      return s;
    }
    decodeAudioData(dati, ok, no) {
      registro.letture.push(dati);
      if (lettura === 'lancia') throw new Error('non so leggerlo');
      if (lettura === 'errore') {
        const errore = new Error('file rovinato');
        if (no) no(errore);
        return Promise.reject(errore);
      }
      if (lettura === 'vuoto') return Promise.resolve(null);
      const suono = { file: true, dati };
      if (lettura === 'solo-funzioni') { setTimeout(() => ok(suono), 0); return undefined; }
      if (ok) ok(suono);
      return Promise.resolve(suono);
    }
  }
  return { Contesto, registro };
}

// Uno "scaricamento" finto del file del suono: ricorda quante volte e a quale indirizzo e' stato chiesto.
//  esito: 'ok' (arriva), 'errore' (non si scarica), 'lancia' (la funzione stessa va in errore),
//         'a-mano' (arriva, o fallisce, quando lo decide il collaudo)
function creaFileFinto({ esito: esitoIniziale = 'ok' } = {}) {
  const chiamate = [];
  const attese = [];
  const dati = new ArrayBuffer(8);
  const file = {
    chiamate, dati, esito: esitoIniziale,
    scarica(indirizzo) {
      chiamate.push(indirizzo);
      if (file.esito === 'lancia') throw new Error('no');
      if (file.esito === 'errore') return Promise.reject(new Error('404'));
      if (file.esito === 'a-mano') return new Promise((ok, no) => attese.push({ ok: () => ok(dati), no: () => no(new Error('404')) }));
      return Promise.resolve(dati);
    },
    arriva() { attese.splice(0).forEach(a => a.ok()); },
    fallisce() { attese.splice(0).forEach(a => a.no()); }
  };
  return file;
}

// Le sorgenti "vere" suonate (quelle del file), senza il suono muto di sblocco.
const suoniDelFile = (registro) => registro.sorgenti.filter(x => x.buffer && x.buffer.file);

function creaMemoriaFinta(iniziale = {}) {
  const dati = { ...iniziale };
  return { dati, getItem: (k) => (k in dati ? dati[k] : null), setItem: (k, v) => { dati[k] = String(v); } };
}

function creaOrologio(inizio = 1000) {
  let ora = inizio;
  return { adesso: () => ora, passa: (ms) => { ora += ms; } };
}

const nuvola = () => new Promise((ok) => setTimeout(ok, 0));       // lascia girare le "promesse" in sospeso

// ---- le note ------------------------------------------------------------------------------------------------

await prova("«tocca a te»: due note che salgono, ognuna con la sua nota e la sua ottava", () => {
  const { Contesto, registro } = creaAudioFinto();
  const contesto = new Contesto();
  const durata = programmaSuono(contesto, 'dado', 5);
  assert.equal(registro.oscillatori.length, 4, '2 note x 2 voci');
  const [a1, a2, b1, b2] = registro.oscillatori;
  const hz = (o) => o.frequency.chiamate[0][1];
  assert.equal(hz(a2), hz(a1) * 2, 'la seconda voce e\' l\'ottava della prima');
  assert.equal(hz(b2), hz(b1) * 2);
  assert.ok(hz(b1) > hz(a1), 'la seconda nota e\' piu\' acuta della prima: salgono');
  assert.equal(a1.inizio, 5, 'la prima parte subito');
  assert.ok(b1.inizio > a1.inizio && b1.inizio - a1.inizio < 0.3, 'la seconda segue a breve');
  assert.ok(durata > 0 && durata < 1, `dura meno di un secondo (${durata})`);
  assert.ok(a1.type === 'sine' && b1.type === 'sine', 'suono morbido, non ruvido');
});

await prova('«domanda»: un solo din, diverso dai due del dado', () => {
  const { Contesto, registro } = creaAudioFinto();
  programmaSuono(new Contesto(), 'domanda', 0);
  assert.equal(registro.oscillatori.length, 2, '1 nota x 2 voci');
  const domanda = registro.oscillatori[0].frequency.chiamate[0][1];
  assert.ok(!DISEGNI_SUONO.dado.some(n => n.hz === domanda), 'la nota della domanda non e\' una di quelle del dado');
});

await prova('un avviso che non esiste non fa niente', () => {
  const { Contesto, registro } = creaAudioFinto();
  assert.equal(programmaSuono(new Contesto(), 'cavallo', 0), 0);
  assert.equal(registro.oscillatori.length, 0);
  assert.equal(registro.gain.length, 0);
});

await prova('il volume non supera mai quello deciso (e quello deciso e\' gentile)', () => {
  assert.ok(VOLUME_MASSIMO > 0.05 && VOLUME_MASSIMO <= 0.35, `VOLUME_MASSIMO = ${VOLUME_MASSIMO}: si sente, ma non e' invadente`);
  for (const tipo of Object.keys(DISEGNI_SUONO)) {
    const { Contesto, registro } = creaAudioFinto();
    programmaSuono(new Contesto(), tipo, 0);
    // i "volumi" sono i gain collegati all'uscita; i "dosaggi" sono quelli delle due voci
    const volumi = registro.gain.filter(g => g.collegato.some(x => x && x.nome === 'uscita'));
    const dosaggi = registro.gain.filter(g => !volumi.includes(g));
    assert.equal(volumi.length, DISEGNI_SUONO[tipo].length, `un volume per nota (${tipo})`);
    for (const v of volumi) {
      const valori = v.gain.chiamate.map(c => c[1]);
      assert.ok(Math.max(...valori) <= VOLUME_MASSIMO + 1e-9, `${tipo}: il volume non sale oltre ${VOLUME_MASSIMO}`);
    }
    const quote = dosaggi.map(d => d.gain.chiamate[0][1]);
    for (let i = 0; i < quote.length; i += 2) assert.ok(quote[i] + quote[i + 1] <= 1 + 1e-9, 'le due voci insieme non superano il volume della nota');
  }
});

await prova('ogni nota sale in un attimo e poi svanisce nel silenzio: niente "clic"', () => {
  const { Contesto, registro } = creaAudioFinto();
  programmaSuono(new Contesto(), 'dado', 3);
  const volumi = registro.gain.filter(g => g.collegato.some(x => x && x.nome === 'uscita'));
  for (const [i, v] of volumi.entries()) {
    const [inizio, sale, svanisce] = v.gain.chiamate;
    assert.equal(inizio[0], 'imposta'); assert.equal(sale[0], 'sale'); assert.equal(svanisce[0], 'svanisce');
    assert.ok(inizio[1] > 0 && inizio[1] <= 0.002, 'parte da quasi zero, ma non da zero (la curva esponenziale non ama lo zero)');
    assert.ok(sale[1] === VOLUME_MASSIMO, 'sale al massimo');
    assert.ok(Math.abs((sale[2] - inizio[2]) - ATTACCO_S) < 1e-9, 'in pochi millisecondi');
    assert.ok(svanisce[1] <= 0.002, 'finisce nel silenzio');
    assert.ok(Math.abs((svanisce[2] - inizio[2]) - DURATA_NOTA_S) < 1e-9, 'svanisce nel tempo previsto');
    assert.ok(i < 1 || inizio[2] > 3, 'la seconda nota parte dopo la prima');
  }
  // le voci si fermano dopo essere svanite, non prima
  for (const o of registro.oscillatori) assert.ok(o.fine > o.inizio + DURATA_NOTA_S, 'la voce si ferma a suono ormai spento');
});

await prova('le misure del suono sono quelle pensate: attacco di pochi millisecondi, note di meno di un secondo', () => {
  assert.ok(ATTACCO_S >= 0.005 && ATTACCO_S <= 0.05, `attacco ${ATTACCO_S} s: ne' un "clic" ne' un colpo lento`);
  assert.ok(DURATA_NOTA_S >= 0.25 && DURATA_NOTA_S <= 0.8, `nota di ${DURATA_NOTA_S} s: breve ma non secca`);
  assert.ok(ATTESA_MASSIMA_MS >= 500 && ATTESA_MASSIMA_MS <= 3000, 'un avviso piu\' vecchio di qualche secondo non ha piu\' senso');
});

await prova('l\'avviso e\' breve: finisce in meno di un secondo', () => {
  for (const tipo of Object.keys(DISEGNI_SUONO)) {
    const { Contesto } = creaAudioFinto();
    const durata = programmaSuono(new Contesto(), tipo, 0);
    assert.ok(durata > DURATA_NOTA_S && durata < 1, `${tipo}: ${durata} s`);
  }
});

// ---- lo sblocco dell'audio ------------------------------------------------------------------------------------

await prova('audio gia\' pronto (Chrome dopo un tocco): suona subito, senza chiedere altro', () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() });
  assert.equal(s.suona('dado'), true);
  assert.equal(registro.oscillatori.length, 4);
  assert.equal(registro.resume, 0, 'non serve riattivare niente');
  assert.equal(registro.sorgenti.length, 0, 'e nemmeno il suono muto di sblocco');
});

await prova('suona un istante dopo "adesso", non nel passato', () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  registro.tempo = 42;
  creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() }).suona('domanda');
  assert.ok(registro.oscillatori[0].inizio > 42 && registro.oscillatori[0].inizio < 42.1, `parte a ${registro.oscillatori[0].inizio}`);
});

await prova('sblocca(): crea il contesto una volta, fa il suono muto e riattiva', () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'subito' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() });
  assert.equal(registro.creati, 0, 'finche\' non serve non si crea niente');
  assert.equal(s.sblocca(), true);
  assert.equal(registro.creati, 1);
  assert.equal(registro.resume, 1);
  assert.equal(registro.sorgenti.length, 1, 'il suono muto');
  assert.equal(registro.sorgenti[0].partito, true);
  assert.deepEqual(registro.sorgenti[0].collegato.map(x => x.nome), ['uscita']);
  assert.equal(registro.oscillatori.length, 0, 'e non e\' un vero suono: niente note');
  assert.equal(s.stato().contesto, 'running');
});

await prova('tocchi ripetuti: sempre lo stesso contesto, e a audio pronto non si fa piu\' niente', () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'subito' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() });
  for (let i = 0; i < 5; i++) s.sblocca();
  assert.equal(registro.creati, 1, 'un solo contesto');
  assert.equal(registro.resume, 1, 'riattivato una volta sola');
  assert.equal(registro.sorgenti.length, 1);
  s.suona('dado'); s.suona('domanda'); s.suona('dado');
  assert.equal(registro.creati, 1, 'un solo contesto anche dopo piu\' avvisi');
});

await prova('iPhone prima del tocco: l\'audio non si sblocca, nessun suono e nessun errore', () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'mai' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() });
  assert.equal(s.suona('dado'), false);
  assert.equal(registro.oscillatori.length, 0);
  assert.equal(s.sblocca(), false, 'sblocca() dice la verita\': l\'audio non e\' pronto');
  assert.equal(s.stato().contesto, 'suspended');
});

await prova('lo stato "interrupted" (telefonata, blocco schermo) conta come non pronto: lo riattiva', () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'interrupted', risveglio: 'subito' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() });
  s.suona('dado');
  assert.equal(registro.resume, 1);
});

await prova('contesto chiuso dal telefono: se ne crea uno nuovo', () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() });
  s.suona('dado');
  registro.istanza.state = 'closed';
  assert.equal(s.suona('domanda'), true);
  assert.equal(registro.creati, 2);
});

await prova('l\'audio si sblocca "subito dopo": l\'avviso suona appena e\' pronto', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'a-mano' });
  const o = creaOrologio();
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), adesso: o.adesso });
  assert.equal(s.suona('dado'), false, 'sul momento non e\' pronto');
  assert.equal(registro.oscillatori.length, 0);
  o.passa(ATTESA_MASSIMA_MS - 100);
  registro.risolvi.forEach(f => f());
  await nuvola();
  assert.equal(registro.oscillatori.length, 4, 'ora suona');
});

await prova('se l\'audio si sblocca troppo tardi l\'avviso e\' ormai vecchio: non suona', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'a-mano' });
  const o = creaOrologio();
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), adesso: o.adesso });
  s.suona('dado');
  o.passa(ATTESA_MASSIMA_MS + 100);          // la persona tocca lo schermo molto dopo
  registro.risolvi.forEach(f => f());
  await nuvola();
  assert.equal(registro.oscillatori.length, 0);
});

await prova('se nel frattempo la persona spegne il suono, l\'avviso in attesa non parte', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'a-mano' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() });
  s.suona('dado');
  s.imposta(false);
  registro.risolvi.forEach(f => f());
  await nuvola();
  assert.equal(registro.oscillatori.length, 0);
});

// ---- il file del suono (e il «din» di riserva) ---------------------------------------------------------------------------------

// Fuori dal browser non c'e' niente da scaricare: le prove che non danno un loro scaricamento finto non scaricano niente.
globalThis.fetch = undefined;

await prova('il file del suono esiste nel sito, ha un indirizzo come gli altri audio ed e\' leggero', () => {
  assert.equal(FILE_SUONO, 'audio/allert-giocatore.mp3');
  const percorso = fileURLToPath(new URL(`./${FILE_SUONO}`, import.meta.url));
  assert.ok(existsSync(percorso), `manca il file ${FILE_SUONO}`);
  assert.ok(statSync(percorso).size < 200 * 1024, `il file pesa ${Math.round(statSync(percorso).size / 1024)} KB: il telefono lo scarica, deve restare piccolo`);
});

await prova('il volume del file e\' quello deciso (e non e\' muto)', () => {
  assert.ok(VOLUME_FILE > 0.05 && VOLUME_FILE <= 1, `VOLUME_FILE = ${VOLUME_FILE}`);
  assert.ok(PAUSA_TRA_TENTATIVI_MS >= 5000 && PAUSA_TRA_TENTATIVI_MS <= 120000, 'si riprova con calma, non a ogni tocco e non mai');
});

await prova('file pronto: l\'avviso suona il file, al volume deciso, e non il «din»', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  registro.tempo = 42;
  const f = creaFileFinto();
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: f.scarica });
  assert.equal(s.stato().file, 'no', 'all\'inizio non c\'e\' niente');
  s.sblocca();                                   // il primo tocco: parte lo scaricamento
  await nuvola();
  assert.equal(s.stato().file, 'pronto');
  assert.equal(s.suona('dado'), true);
  const suonati = suoniDelFile(registro);
  assert.equal(suonati.length, 1, 'parte il file, una volta');
  assert.equal(suonati[0].partito, true);
  assert.equal(registro.oscillatori.length, 0, 'e non il «din»');
  assert.ok(suonati[0].inizio > 42 && suonati[0].inizio < 42.1, `parte un istante dopo adesso (${suonati[0].inizio})`);
  const volume = suonati[0].collegato[0];
  assert.deepEqual(volume.collegato.map(x => x.nome), ['uscita'], 'passa dal volume e poi esce');
  assert.deepEqual(volume.gain.chiamate, [['imposta', VOLUME_FILE, suonati[0].inizio]], 'al volume deciso, senza salti');
});

await prova('«tocca a te» e «domanda» hanno lo stesso suono: il file', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: creaFileFinto().scarica });
  s.sblocca(); await nuvola();
  assert.equal(s.suona('dado'), true);
  assert.equal(s.suona('domanda'), true);
  assert.equal(suoniDelFile(registro).length, 2, 'un file per avviso');
  assert.equal(registro.oscillatori.length, 0);
  assert.equal(s.suona('cavallo'), false, 'un avviso che non esiste resta senza suono');
  assert.equal(suoniDelFile(registro).length, 2);
});

await prova('il file si scarica una volta sola, all\'indirizzo giusto, gia\' dal primo tocco', async () => {
  const { Contesto } = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'subito' });
  const f = creaFileFinto();
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: f.scarica });
  assert.equal(f.chiamate.length, 0, 'finche\' nessuno tocca niente non si scarica niente');
  s.sblocca();
  assert.deepEqual(f.chiamate, [FILE_SUONO], 'al primo tocco parte lo scaricamento, senza aspettare il primo avviso');
  await nuvola();
  for (let i = 0; i < 4; i++) s.sblocca();
  s.suona('dado'); s.suona('domanda'); s.suona('dado');
  await nuvola();
  assert.equal(f.chiamate.length, 1, 'anche dopo tanti tocchi e tanti avvisi: un solo scaricamento');
});

await prova('il file viene letto una volta sola', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  const f = creaFileFinto();
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: f.scarica });
  s.sblocca(); await nuvola();
  for (let i = 0; i < 4; i++) { s.sblocca(); s.suona('dado'); }
  await nuvola();
  assert.equal(registro.letture.length, 1);
  assert.equal(registro.letture[0], f.dati, 'si legge proprio quello che e\' arrivato');
});

await prova('prima che il file arrivi suona il «din»; appena arriva suona il file', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  const f = creaFileFinto({ esito: 'a-mano' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: f.scarica });
  s.sblocca();
  assert.equal(s.stato().file, 'in-corso');
  assert.equal(s.suona('dado'), true, 'un avviso in questo momento non resta muto');
  assert.equal(registro.oscillatori.length, 4, 'suona il «din»');
  assert.equal(suoniDelFile(registro).length, 0);
  f.arriva(); await nuvola();
  assert.equal(s.stato().file, 'pronto');
  assert.equal(s.suona('dado'), true);
  assert.equal(suoniDelFile(registro).length, 1, 'ora suona il file');
  assert.equal(registro.oscillatori.length, 4, 'e il «din» non si sente piu\'');
});

for (const [nome, opzioniFile, opzioniAudio] of [
  ['il file non si scarica (404 o niente campo)', { esito: 'errore' }, {}],
  ['la funzione che scarica va in errore', { esito: 'lancia' }, {}],
  ['il file e\' rovinato e non si legge', {}, { lettura: 'errore' }],
  ['la lettura del file va in errore', {}, { lettura: 'lancia' }],
  ['la lettura del file non restituisce niente', {}, { lettura: 'vuoto' }]
]) {
  await prova(`${nome}: resta il «din», nessun errore`, async () => {
    const { Contesto, registro } = creaAudioFinto(opzioniAudio);
    const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: creaFileFinto(opzioniFile).scarica });
    assert.doesNotThrow(() => s.sblocca());
    await nuvola();
    assert.equal(s.stato().file, 'no');
    assert.equal(s.suona('dado'), true);
    assert.equal(registro.oscillatori.length, 4, 'suona il «din»');
    assert.equal(suoniDelFile(registro).length, 0);
  });
}

await prova('telefoni vecchi che rispondono solo con le funzioni di ritorno: il file si legge lo stesso', async () => {
  const { Contesto, registro } = creaAudioFinto({ lettura: 'solo-funzioni' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: creaFileFinto().scarica });
  s.sblocca(); await nuvola(); await nuvola();
  assert.equal(s.stato().file, 'pronto');
  s.suona('dado');
  assert.equal(suoniDelFile(registro).length, 1);
});

await prova('se il file non si scarica si riprova con calma: non a ogni tocco, ma piu\' tardi si', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  const o = creaOrologio();
  const f = creaFileFinto({ esito: 'errore' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: f.scarica, adesso: o.adesso });
  s.sblocca(); await nuvola();
  assert.equal(f.chiamate.length, 1);
  for (let i = 0; i < 5; i++) { s.sblocca(); s.suona('dado'); }
  await nuvola();
  assert.equal(f.chiamate.length, 1, 'subito dopo il fallimento: nessun nuovo tentativo, nemmeno con tocchi e avvisi');
  assert.equal(registro.oscillatori.length, 20, 'ma gli avvisi suonano lo stesso con il «din»');
  o.passa(PAUSA_TRA_TENTATIVI_MS - 1000);
  s.suona('domanda'); await nuvola();
  assert.equal(f.chiamate.length, 1, 'ancora troppo presto');
  o.passa(2000);
  f.esito = 'ok';                                  // intanto il campo e' tornato
  s.suona('domanda'); await nuvola();
  assert.equal(f.chiamate.length, 2, 'passata la pausa si riprova');
  assert.equal(s.stato().file, 'pronto');
  s.suona('dado');
  assert.equal(suoniDelFile(registro).length, 1, 'e dal prossimo avviso suona il file');
});

await prova('l\'assaggio aspetta il file che sta arrivando e poi suona quello, non il «din»', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  const f = creaFileFinto({ esito: 'a-mano' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: f.scarica });
  s.sblocca();
  assert.equal(s.stato().file, 'in-corso');
  assert.equal(s.suona('dado', { aspettaIlFile: true }), false, 'sul momento non suona: aspetta');
  assert.equal(registro.oscillatori.length, 0);
  assert.equal(suoniDelFile(registro).length, 0);
  f.arriva(); await nuvola();
  assert.equal(suoniDelFile(registro).length, 1, 'arrivato il file, suona quello');
  assert.equal(registro.oscillatori.length, 0, 'e non il «din»');
});

await prova('l\'assaggio, se il file non arriva, suona il «din»', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  const f = creaFileFinto({ esito: 'a-mano' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: f.scarica });
  s.sblocca();
  s.suona('dado', { aspettaIlFile: true });
  f.fallisce(); await nuvola();
  assert.equal(registro.oscillatori.length, 4);
  assert.equal(suoniDelFile(registro).length, 0);
});

await prova('l\'assaggio, se il file ci mette troppo, non suona piu\' in ritardo; se la persona spegne, nemmeno', async () => {
  for (const cosaSuccede of ['troppo-tardi', 'spento-nel-frattempo']) {
    const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
    const o = creaOrologio();
    const f = creaFileFinto({ esito: 'a-mano' });
    const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: f.scarica, adesso: o.adesso });
    s.sblocca();
    s.suona('dado', { aspettaIlFile: true });
    if (cosaSuccede === 'troppo-tardi') o.passa(ATTESA_MASSIMA_MS + 100); else s.imposta(false);
    f.arriva(); await nuvola();
    assert.equal(suoniDelFile(registro).length + registro.oscillatori.length, 0, cosaSuccede);
  }
});

await prova('l\'assaggio con il file gia\' pronto parte subito; un avviso vero non aspetta mai il file', async () => {
  const pronto = creaAudioFinto({ statoIniziale: 'running' });
  const s1 = creaSuonoAvviso({ AudioContext: pronto.Contesto, memoria: creaMemoriaFinta(), scarica: creaFileFinto().scarica });
  s1.sblocca(); await nuvola();
  assert.equal(s1.suona('dado', { aspettaIlFile: true }), true);
  assert.equal(suoniDelFile(pronto.registro).length, 1);

  const lento = creaAudioFinto({ statoIniziale: 'running' });
  const s2 = creaSuonoAvviso({ AudioContext: lento.Contesto, memoria: creaMemoriaFinta(), scarica: creaFileFinto({ esito: 'a-mano' }).scarica });
  s2.sblocca();
  assert.equal(s2.suona('dado'), true, 'un avviso vero suona subito, con il «din»');
  assert.equal(lento.registro.oscillatori.length, 4);
});

await prova('l\'assaggio dopo aver riacceso il suono (file mai scaricato perche\' era spento) scarica il file e suona quello', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'subito' });
  const f = creaFileFinto();
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta({ [CHIAVE_SUONO]: 'no' }), scarica: f.scarica });
  const p = creaPulsanteFinto();
  collegaPulsanteSuono(p, s);
  s.sblocca(); await nuvola();
  assert.equal(f.chiamate.length, 0, 'spento: niente scaricamento');
  p.tocca();                                    // riaccende
  await nuvola();
  assert.equal(f.chiamate.length, 1);
  assert.equal(suoniDelFile(registro).length, 1, 'l\'assaggio e\' il file, non il «din»');
  assert.equal(registro.oscillatori.length, 0);
});

await prova('con il file gia\' pronto non si riscarica piu\', nemmeno dopo tanto tempo', async () => {
  const { Contesto } = creaAudioFinto({ statoIniziale: 'running' });
  const o = creaOrologio();
  const f = creaFileFinto();
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: f.scarica, adesso: o.adesso });
  s.sblocca(); await nuvola();
  assert.equal(s.stato().file, 'pronto');
  for (let i = 0; i < 4; i++) { o.passa(PAUSA_TRA_TENTATIVI_MS * 2); s.sblocca(); s.suona('dado'); }
  await nuvola();
  assert.equal(f.chiamate.length, 1, 'un solo scaricamento in tutta la partita');
});

await prova('mentre il file si sta scaricando non ne parte un altro, nemmeno se ci mette tanto', async () => {
  const { Contesto } = creaAudioFinto({ statoIniziale: 'running' });
  const o = creaOrologio();
  const f = creaFileFinto({ esito: 'a-mano' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: f.scarica, adesso: o.adesso });
  s.sblocca();
  o.passa(PAUSA_TRA_TENTATIVI_MS * 3);
  s.suona('dado'); s.sblocca();
  assert.equal(f.chiamate.length, 1);
  f.fallisce(); await nuvola();
  assert.equal(s.stato().file, 'no');
  s.suona('dado');                                 // ora si puo' riprovare
  assert.equal(f.chiamate.length, 2);
});

await prova('con il suono spento non si scarica niente; riacceso, si scarica', async () => {
  const { Contesto } = creaAudioFinto({ statoIniziale: 'running' });
  const f = creaFileFinto();
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta({ [CHIAVE_SUONO]: 'no' }), scarica: f.scarica });
  s.sblocca(); s.suona('dado'); await nuvola();
  assert.equal(f.chiamate.length, 0, 'suono spento: niente scaricamento');
  s.imposta(true);
  s.suona('dado'); await nuvola();
  assert.equal(f.chiamate.length, 1, 'riacceso: parte lo scaricamento');
  assert.equal(s.stato().file, 'pronto');
});

await prova('telefono senza Web Audio: il file non si scarica nemmeno', async () => {
  const f = creaFileFinto();
  const s = creaSuonoAvviso({ AudioContext: null, memoria: creaMemoriaFinta(), scarica: f.scarica });
  s.sblocca(); s.suona('dado'); await nuvola();
  assert.equal(f.chiamate.length, 0);
  assert.equal(s.stato().file, 'no');
});

await prova('contesto chiuso dal telefono e ricreato: il file gia\' letto si riusa, senza riscaricarlo', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  const f = creaFileFinto();
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: f.scarica });
  s.sblocca(); await nuvola();
  s.suona('dado');
  registro.istanza.state = 'closed';
  assert.equal(s.suona('domanda'), true);
  assert.equal(registro.creati, 2);
  assert.equal(f.chiamate.length, 1, 'nessun nuovo scaricamento');
  assert.equal(registro.letture.length, 1, 'e nessuna nuova lettura');
  assert.equal(suoniDelFile(registro).length, 2, 'il secondo avviso suona il file anche sul contesto nuovo');
  assert.equal(registro.oscillatori.length, 0);
});

await prova('iPhone: l\'audio si sblocca "subito dopo" e il file e\' gia\' pronto: suona il file, non il «din»', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'a-mano' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: creaFileFinto().scarica });
  s.sblocca();                                     // il primo tocco: l'audio aspetta, il file arriva
  await nuvola();
  assert.equal(s.stato().file, 'pronto');
  assert.equal(s.suona('dado'), false, 'sul momento l\'audio non e\' pronto');
  registro.risolvi.forEach(fn => fn());
  await nuvola();
  assert.equal(suoniDelFile(registro).length, 1, 'ora suona il file');
  assert.equal(registro.oscillatori.length, 0);
});

await prova('il suono muto di sblocco non e\' scambiato per il suono del file', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'subito' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: creaFileFinto().scarica });
  s.sblocca(); await nuvola();
  assert.equal(registro.sorgenti.length, 1, 'solo il suono muto');
  assert.equal(suoniDelFile(registro).length, 0);
  s.suona('dado');
  assert.equal(registro.sorgenti.length, 2);
  assert.equal(suoniDelFile(registro).length, 1);
});

// Lo scaricamento "di serie" (quello che usa il telefono vero) passa dalla funzione fetch della pagina.
async function conFetchFinto(fetchFinto, prova) {
  const prima = globalThis.fetch;
  globalThis.fetch = fetchFinto;
  try { await prova(); } finally { globalThis.fetch = prima; }
}

await prova('lo scaricamento di serie chiede il file alla pagina e lo legge', async () => {
  const richieste = [];
  const dati = new ArrayBuffer(16);
  await conFetchFinto(async (indirizzo) => { richieste.push(indirizzo); return { ok: true, status: 200, arrayBuffer: async () => dati }; }, async () => {
    const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
    const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() });
    s.sblocca(); await nuvola();
    assert.deepEqual(richieste, [FILE_SUONO]);
    assert.equal(registro.letture[0], dati);
    assert.equal(s.stato().file, 'pronto');
  });
});

for (const [nome, fetchFinto] of [
  ['il sito risponde «non trovato»', async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(16) })],
  ['la rete non risponde', async () => { throw new Error('rete assente'); }],
  ['la lettura dei byte non riesce', async () => ({ ok: true, status: 200, arrayBuffer: async () => { throw new Error('interrotto'); } })]
]) {
  await prova(`scaricamento di serie, ${nome}: resta il «din», nessun errore`, async () => {
    await conFetchFinto(fetchFinto, async () => {
      const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
      const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() });
      assert.doesNotThrow(() => s.sblocca());
      await nuvola();
      assert.equal(s.stato().file, 'no');
      assert.equal(registro.letture.length, 0, 'e non si prova nemmeno a leggerlo');
      assert.equal(s.suona('dado'), true);
      assert.equal(registro.oscillatori.length, 4);
    });
  });
}

await prova('se il file non riesce a partire (sorgente rotta) suona il «din» al suo posto', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: creaFileFinto().scarica });
  s.sblocca(); await nuvola();
  Contesto.prototype.createBufferSource = function () { throw new Error('no'); };
  assert.equal(s.suona('dado'), true);
  assert.equal(registro.oscillatori.length, 4);
});

// ---- l'interruttore e la scelta che si ricorda ------------------------------------------------------------------------------

await prova('di serie il suono e\' acceso', () => {
  const { Contesto } = creaAudioFinto();
  assert.equal(creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() }).attivo(), true);
});

await prova('spento: niente suono e non si tocca nemmeno l\'audio del telefono', () => {
  const { Contesto, registro } = creaAudioFinto();
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() });
  s.imposta(false);
  assert.equal(s.attivo(), false);
  assert.equal(s.suona('dado'), false);
  assert.equal(registro.creati, 0);
  assert.equal(registro.oscillatori.length, 0);
});

await prova('la scelta si ricorda: spento resta spento alla prossima apertura, acceso torna acceso', () => {
  const { Contesto } = creaAudioFinto();
  const memoria = creaMemoriaFinta();
  const a = creaSuonoAvviso({ AudioContext: Contesto, memoria });
  a.imposta(false);
  assert.equal(memoria.dati[CHIAVE_SUONO], 'no');
  assert.equal(creaSuonoAvviso({ AudioContext: Contesto, memoria }).attivo(), false);
  a.imposta(true);
  assert.equal(memoria.dati[CHIAVE_SUONO], 'si');
  assert.equal(creaSuonoAvviso({ AudioContext: Contesto, memoria }).attivo(), true);
});

await prova('la chiave della scelta e\' quella della beta', () => {
  assert.equal(CHIAVE_SUONO, 'corsa-cristiana-beta-suono-avviso');
});

await prova('una memoria rotta (navigazione privata) non da\' fastidio: suono acceso, nessun errore', () => {
  const { Contesto } = creaAudioFinto();
  const rotta = { getItem() { throw new Error('vietato'); }, setItem() { throw new Error('vietato'); } };
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: rotta });
  assert.equal(s.attivo(), true);
  assert.doesNotThrow(() => s.imposta(false));
  assert.equal(s.attivo(), false, 'per questa visita vale comunque');
  assert.equal(creaSuonoAvviso({ AudioContext: Contesto, memoria: null }).attivo(), true);
});

// ---- telefoni e casi strani ----------------------------------------------------------------------------------------

await prova('telefono senza Web Audio: nessun suono, nessun errore', () => {
  const s = creaSuonoAvviso({ AudioContext: null, memoria: creaMemoriaFinta() });
  assert.equal(s.stato().supportato, false);
  assert.equal(s.sblocca(), false);
  assert.equal(s.suona('dado'), false);
});

await prova('mai errori verso chi chiama: costruttore, riattivazione e note che lanciano', () => {
  const memoria = creaMemoriaFinta();
  assert.doesNotThrow(() => creaSuonoAvviso({ AudioContext: function () { throw new Error('no'); }, memoria }).suona('dado'));
  assert.equal(creaSuonoAvviso({ AudioContext: function () { throw new Error('no'); }, memoria }).sblocca(), false);

  const a = creaAudioFinto({ statoIniziale: 'suspended' });
  a.Contesto.prototype.resume = function () { throw new Error('no'); };
  const s1 = creaSuonoAvviso({ AudioContext: a.Contesto, memoria });
  assert.doesNotThrow(() => s1.suona('dado'));
  assert.doesNotThrow(() => s1.sblocca());

  const b = creaAudioFinto({ statoIniziale: 'running' });
  b.Contesto.prototype.createOscillator = function () { throw new Error('no'); };
  assert.equal(creaSuonoAvviso({ AudioContext: b.Contesto, memoria }).suona('dado'), false);

  const c = creaAudioFinto({ statoIniziale: 'suspended' });
  c.Contesto.prototype.createBufferSource = function () { throw new Error('no'); };
  assert.doesNotThrow(() => creaSuonoAvviso({ AudioContext: c.Contesto, memoria }).sblocca(), 'il suono muto che non riesce non blocca lo sblocco');
  assert.equal(creaSuonoAvviso({ AudioContext: c.Contesto, memoria }).sblocca(), true);

  const d = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'subito' });
  d.Contesto.prototype.resume = function () { return Promise.reject(new Error('rifiutato')); };
  assert.doesNotThrow(() => creaSuonoAvviso({ AudioContext: d.Contesto, memoria }).suona('dado'));
});

await prova('un tipo di avviso sconosciuto non suona e non crea niente', () => {
  const { Contesto, registro } = creaAudioFinto();
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() });
  assert.equal(s.suona('cavallo'), false);
  assert.equal(s.suona(undefined), false);
  assert.equal(registro.creati, 0);
});

// ---- il pulsante «Suono» ----------------------------------------------------------------------------------------------

function creaPulsanteFinto() {
  const classi = new Set(['nascosta']);
  const attributi = {};
  const ascoltatori = [];
  return {
    textContent: '',
    classList: { add: c => classi.add(c), remove: c => classi.delete(c), contains: c => classi.has(c) },
    setAttribute: (k, v) => { attributi[k] = v; },
    addEventListener: (nome, f) => { ascoltatori.push([nome, f]); },
    classi, attributi, ascoltatori,
    tocca() { ascoltatori.filter(([n]) => n === 'click').forEach(([, f]) => f()); }
  };
}
function creaSuonoSpia(iniziale = true) {
  let attivo = iniziale;
  const suonati = [];
  const opzioni = [];
  return { attivo: () => attivo, imposta: (v) => { attivo = !!v; }, suona: (t, o) => { suonati.push(t); opzioni.push(o); return true; }, suonati, opzioni };
}

await prova('il pulsante mostra lo stato e compare (la parola resta «Suono»: campanella e barra le mette il CSS)', () => {
  const p = creaPulsanteFinto(); const s = creaSuonoSpia(true);
  assert.equal(collegaPulsanteSuono(p, s), true);
  assert.equal(p.textContent, 'Suono');
  assert.equal(p.attributi['aria-pressed'], 'true');
  assert.equal(p.classi.has('nascosta'), false);
  const q = creaPulsanteFinto(); collegaPulsanteSuono(q, creaSuonoSpia(false));
  assert.equal(q.textContent, 'Suono', 'stessa parola da spento: il pulsante non cambia larghezza');
  assert.equal(q.attributi['aria-pressed'], 'false');
  assert.equal(q.classi.has('nascosta'), false);
});

await prova('toccarlo spegne il suono (in silenzio) e ritoccarlo lo riaccende con un assaggio', () => {
  const p = creaPulsanteFinto(); const s = creaSuonoSpia(true);
  collegaPulsanteSuono(p, s);
  p.tocca();
  assert.equal(s.attivo(), false);
  assert.equal(p.textContent, 'Suono');
  assert.equal(p.attributi['aria-pressed'], 'false');
  assert.deepEqual(s.suonati, [], 'spegnendo non suona niente');
  p.tocca();
  assert.equal(s.attivo(), true);
  assert.equal(p.textContent, 'Suono');
  assert.equal(p.attributi['aria-pressed'], 'true');
  assert.deepEqual(s.suonati, ['dado'], 'riaccendendo si sente un assaggio');
  assert.deepEqual(s.opzioni, [{ aspettaIlFile: true }], 'e se il file sta ancora arrivando l\'assaggio lo aspetta: chi riaccende vuole sentire quello vero');
});

await prova('il pulsante con un suono vero (senza file): l\'assaggio parte davvero e la scelta si ricorda', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'subito' });
  const memoria = creaMemoriaFinta();
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria });
  const p = creaPulsanteFinto();
  collegaPulsanteSuono(p, s);
  p.tocca();                                   // spegne
  assert.equal(memoria.dati[CHIAVE_SUONO], 'no');
  p.tocca();                                   // riaccende: assaggio, dentro il tocco
  assert.equal(memoria.dati[CHIAVE_SUONO], 'si');
  await nuvola();                              // il tempo di accorgersi che il file non c'e'
  assert.equal(registro.oscillatori.length, 4, 'senza il file, l\'assaggio e\' il «din»');
});

await prova('il pulsante con il file pronto: l\'assaggio e\' il file', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'running' });
  const s = creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta(), scarica: creaFileFinto().scarica });
  s.sblocca(); await nuvola();
  const p = creaPulsanteFinto();
  collegaPulsanteSuono(p, s);
  p.tocca();                                   // spegne
  assert.equal(suoniDelFile(registro).length, 0, 'spegnendo non suona niente');
  p.tocca();                                   // riaccende: assaggio
  assert.equal(suoniDelFile(registro).length, 1, 'riaccendendo si sente il file');
  assert.equal(registro.oscillatori.length, 0);
});

await prova('telefono che non sa suonare: l\'interruttore resta nascosto', () => {
  const muto = creaSuonoAvviso({ AudioContext: null, memoria: creaMemoriaFinta() });
  const p = creaPulsanteFinto();
  assert.equal(collegaPulsanteSuono(p, muto), false);
  assert.equal(p.classi.has('nascosta'), true, 'non compare');
  assert.equal(p.ascoltatori.length, 0, 'e non ascolta niente');
  const { Contesto } = creaAudioFinto();
  const q = creaPulsanteFinto();
  assert.equal(collegaPulsanteSuono(q, creaSuonoAvviso({ AudioContext: Contesto, memoria: creaMemoriaFinta() })), true);
  assert.equal(q.classi.has('nascosta'), false, 'su un telefono che suona invece compare');
});

await prova('pulsante o suono mancanti, o che lanciano: nessun errore', () => {
  assert.equal(collegaPulsanteSuono(null, creaSuonoSpia()), false);
  assert.equal(collegaPulsanteSuono(creaPulsanteFinto(), null), false);
  const guasto = { attivo() { throw new Error('x'); }, imposta() { throw new Error('x'); }, suona() { throw new Error('x'); } };
  assert.doesNotThrow(() => collegaPulsanteSuono(creaPulsanteFinto(), guasto));
  const p = creaPulsanteFinto();
  const mezzoRotto = { attivo: () => true, imposta() { throw new Error('x'); }, suona() { throw new Error('x'); } };
  collegaPulsanteSuono(p, mezzoRotto);
  assert.doesNotThrow(() => p.tocca());
});

// ---- il suono "della pagina" ---------------------------------------------------------------------------------------------

await prova('suonoDellaPagina: uno solo, e fuori dal browser non da\' errori', async () => {
  const modulo = await import('./js/suono-avviso.js?senza-pagina');
  const a = modulo.suonoDellaPagina();
  assert.equal(modulo.suonoDellaPagina(), a, 'sempre lo stesso');
  assert.equal(a.suona('dado'), false);
  assert.equal(a.attivo(), true);
});

await prova('suonoDellaPagina: ascolta i tocchi della persona e sblocca l\'audio', async () => {
  const { Contesto, registro } = creaAudioFinto({ statoIniziale: 'suspended', risveglio: 'subito' });
  const ascoltatori = [];
  globalThis.AudioContext = Contesto;
  globalThis.document = { addEventListener: (nome, f, opzioni) => ascoltatori.push({ nome, f, opzioni }) };
  try {
    const modulo = await import('./js/suono-avviso.js?con-pagina');
    const s = modulo.suonoDellaPagina();
    assert.deepEqual(ascoltatori.map(a => a.nome).sort(), ['click', 'keydown', 'pointerup', 'touchend']);
    assert.ok(ascoltatori.every(a => a.opzioni && a.opzioni.capture === true && a.opzioni.passive === true), 'in ascolto per primi e senza rallentare lo scorrimento');
    assert.equal(registro.creati, 0, 'finche\' nessuno tocca niente, niente audio');
    ascoltatori.find(a => a.nome === 'click').f();
    assert.equal(registro.creati, 1, 'al primo tocco si sblocca');
    assert.equal(s.stato().contesto, 'running');
    // il telefono ferma l'audio (una telefonata, per esempio): al tocco dopo, con il suono acceso, si riattiva da solo
    registro.istanza.state = 'interrupted';
    ascoltatori.find(a => a.nome === 'pointerup').f();
    assert.equal(registro.resume, 2, 'acceso: un tocco riattiva l\'audio fermato dal telefono');
    assert.equal(s.stato().contesto, 'running');
    // ...ma con il suono spento i tocchi non toccano piu' l'audio
    s.imposta(false);
    registro.istanza.state = 'suspended';
    ascoltatori.find(a => a.nome === 'touchend').f();
    assert.equal(registro.resume, 2, 'spento: i tocchi non toccano piu\' l\'audio');
    assert.equal(s.stato().contesto, 'suspended');
  } finally {
    delete globalThis.AudioContext;
    delete globalThis.document;
  }
});

console.log(`\nSuono dell'avviso: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
