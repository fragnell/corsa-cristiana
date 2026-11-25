// test-introduzione.mjs
// Prove dei testi della presentazione di inizio partita (js/introduzione-testi.js): che ci siano
// tutte le scene, che i numeri delle regole vengano dalla configurazione (normale e veloce) e che
// ogni scena resti abbastanza per leggerla. Si lancia con:  node test-introduzione.mjs

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CONFIG, configPerModalita } from './js/config.js';
import {
  scenePremessa, scenaDomanda, sceneRegole, durataLettura,
  DURATA_MINIMA_MS, DURATA_MASSIMA_MS, DURATA_MASSIMA_CITAZIONE_MS, ATTESA_DOMANDA_MS
} from './js/introduzione-testi.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${e.message}`); }
}

const tuttoIlTesto = scene => scene.map(s => [s.titolo, s.testo, s.citazione, s.riferimento, ...(s.elenco || []).map(v => `${v.titolo} ${v.testo}`)].join(' ')).join(' | ');

prova('premessa: una sola scena con la frase, la citazione testuale e il riferimento', () => {
  const scene = scenePremessa();
  const premessa = scene[0];
  assert.equal(premessa.testo, 'Una piccola premessa: conoscere più cose non significa necessariamente essere più spirituali.');
  assert.equal(premessa.citazione, 'Conoscere la Bibbia non basta per diventare una persona dalla mentalità spirituale. Il re Salomone conosceva bene Geova, e le parole che pronunciò entrarono addirittura a far parte della Bibbia. Ma alla fine non fu una persona spirituale e non rimase fedele a Geova (1 Re 4:29, 30; 11:4-6)');
  assert.ok(/febbraio 2018, p\. 24, par\. 7/.test(premessa.riferimento));
  assert.ok(/Continuiamo a crescere spiritualmente/.test(premessa.riferimento));
  assert.deepEqual(scene.map(s => s.id), ['premessa', 'scopo', 'non-gara']);
  const t = tuttoIlTesto(scene);
  assert.ok(/cose edificanti/.test(t));
  assert.ok(/Non è una gara a chi sa di più/.test(t));
});

prova('la domanda: due scelte e un tempo d\'attesa', () => {
  const d = scenaDomanda();
  assert.equal(d.tipo, 'domanda');
  assert.ok(d.si && d.no);
  assert.equal(d.durataMs, ATTESA_DOMANDA_MS);
});

prova('regole normali: i numeri arrivano da config.js', () => {
  const t = tuttoIlTesto(sceneRegole(configPerModalita(CONFIG, 'normale'), 'normale'));
  assert.ok(t.includes(`avanti di ${CONFIG.conoscenza.bonusRispostaCorretta} caselle`), 'bonus conoscenza');
  assert.ok(t.includes(`indietro di ${Math.abs(CONFIG.imprevisto.malus)} caselle`), 'malus imprevisto');
  assert.ok(t.includes(`${CONFIG.timeout.rispostaMs / 1000} secondi`), 'tempo per rispondere');
  assert.ok(t.includes('casella 62'));
  assert.ok(!/partita veloce/.test(t));
  assert.ok(!/vale anche la casella/.test(t), 'nella normale il salto non attiva la casella');
});

prova('regole veloci: numeri della partita veloce e avviso', () => {
  const t = tuttoIlTesto(sceneRegole(configPerModalita(CONFIG, 'veloce'), 'veloce'));
  assert.ok(t.includes(`avanti di ${CONFIG.veloce.bonusConoscenza} caselle`));
  assert.ok(t.includes(`indietro di ${Math.abs(CONFIG.veloce.malusImprevisto) === 1 ? '1 casella' : Math.abs(CONFIG.veloce.malusImprevisto) + ' caselle'}`));
  assert.ok(/partita veloce/.test(t));
  if (CONFIG.veloce.saltoAttivaCasella) assert.ok(/vale anche la casella/.test(t));
});

prova('COLLABORIAMO!: c\'e\' se e\' attivo, sparisce se e\' spento', () => {
  const acceso = sceneRegole(CONFIG, 'normale');
  assert.ok(acceso.some(s => s.id === 'collaboriamo'));
  const spento = sceneRegole({ ...CONFIG, salmo: { ...CONFIG.salmo, attivo: false } }, 'normale');
  assert.ok(!spento.some(s => s.id === 'collaboriamo'));
});

prova('una casella sola si scrive al singolare', () => {
  const t = tuttoIlTesto(sceneRegole({ ...CONFIG, prova: { bonusSuperata: 1 } }, 'normale'));
  assert.ok(t.includes('avanti di 1 casella.'));
});

prova('configurazione vuota o strana: nessun errore, numeri di base', () => {
  const t = tuttoIlTesto(sceneRegole(undefined));
  assert.ok(t.includes('avanti di 3 caselle'));
  assert.ok(!/NaN|undefined/.test(t));
  assert.ok(!/NaN|undefined/.test(tuttoIlTesto(sceneRegole({ conoscenza: { bonusRispostaCorretta: 'x' } }))));
});

prova('ogni scena dura il tempo di leggerla, entro i limiti', () => {
  for (const s of [...scenePremessa(), ...sceneRegole(CONFIG)]) {
    const massimo = s.citazione ? DURATA_MASSIMA_CITAZIONE_MS : DURATA_MASSIMA_MS;
    assert.ok(s.durataMs >= DURATA_MINIMA_MS && s.durataMs <= massimo, `${s.id}: ${s.durataMs}`);
  }
  assert.ok(scenePremessa()[0].durataMs > DURATA_MASSIMA_MS, "la citazione lunga deve restare piu' delle altre");
  assert.ok(durataLettura({ titolo: 'a', testo: 'b'.repeat(200) }) > durataLettura({ titolo: 'a', testo: 'b' }));
});

prova('le immagini delle caselle esistono davvero', () => {
  for (const s of sceneRegole(CONFIG)) for (const v of s.elenco || []) if (v.immagine) assert.ok(existsSync(v.immagine), v.immagine);
});

console.log(`Introduzione di inizio partita: ${provati - falliti.length}/${provati} ok`);
if (falliti.length) { console.log('❌ Qualche verifica non e\' passata'); process.exit(1); }
console.log('✅ Tutte le verifiche passate');
