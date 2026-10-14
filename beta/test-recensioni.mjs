// test-recensioni.mjs
// Prove delle recensioni di fine partita:
//  - lato telefono (js/recensioni-logica.js): la memoria delle partite fatte, chi viene richiesto e quando,
//    la pulizia del commento, il pacchetto che va a Firebase, gli errori di invio;
//  - lato Admin (js/filtri-recensioni.js): riepilogo, filtri, ordinamenti, righe del file Excel;
//  - che i due file restino "puri" (niente pagina, niente Firebase) e leggeri.
// Si lancia con:  node test-recensioni.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  CHIAVE_ARCHIVIO, MAX_CARATTERI_COMMENTO, MAX_CARATTERI_NOME, STESSA_PARTITA_ENTRO_MS,
  sistemaConfigRecensioni, archivioVuoto, leggiArchivio, scriviArchivio, registraFinePartita, segnaChiesta, segnaInviata,
  decidiRichiesta, pulisciCommento, pulisciNome, testoRiservatezza, stelleValide, costruisciRecensione, tipoErroreInvio, versioneDalPercorso
} from './js/recensioni-logica.js';
import {
  FILTRI_RECENSIONI_INIZIALI, votoDi, commentoDi, nomeDi, modalitaDi, versioneDi, dataDi, etichettaStelle, dataEOra,
  riassumi, contaRecensioni, corrisponde, ordinaRecensioni, filtraRecensioni, filtriAttivi, righeExcel
} from './js/filtri-recensioni.js';
import { CONFIG, unisciConfig } from './js/config.js';

let provati = 0;
const falliti = [];
function prova(nome, fn) {
  provati++;
  try { fn(); } catch (e) { falliti.push({ nome, e }); console.log(`  FAIL  ${nome}\n        ${String(e.message).split('\n').join('\n        ')}`); }
}

const ORA = 1760000000000;               // un istante qualsiasi
const ORE = n => n * 60 * 60 * 1000;
const CONFIG_BASE = { attiva: true, soloNuovi: true, primePartite: 3, conNome: true };

// ================= le impostazioni =================

prova('config.js: le recensioni sono accese per le prime 3 partite, firmate con il soprannome', () => {
  assert.deepEqual(CONFIG.recensioni, { attiva: true, soloNuovi: true, primePartite: 3, conNome: true });
});

prova('unisciConfig: i valori salvati nell\'Admin sostituiscono quelli di base, il resto resta', () => {
  const c = unisciConfig(CONFIG, { recensioni: { primePartite: 5 } });
  assert.deepEqual(c.recensioni, { attiva: true, soloNuovi: true, primePartite: 5, conNome: true });
  assert.deepEqual(unisciConfig(CONFIG, { recensioni: { conNome: false } }).recensioni, { attiva: true, soloNuovi: true, primePartite: 3, conNome: false });
  assert.deepEqual(unisciConfig(CONFIG, {}).recensioni, CONFIG.recensioni);
});

prova('sistemaConfigRecensioni: valori di base se non c\'e\' niente o se sono strani', () => {
  assert.deepEqual(sistemaConfigRecensioni(undefined), CONFIG_BASE);
  assert.deepEqual(sistemaConfigRecensioni(null), CONFIG_BASE);
  assert.deepEqual(sistemaConfigRecensioni('ciao'), CONFIG_BASE);
  assert.deepEqual(sistemaConfigRecensioni({}), CONFIG_BASE);
  for (const strano of [0, -2, 51, 2.5, 'tre', NaN, null, undefined, {}, []]) {
    assert.equal(sistemaConfigRecensioni({ primePartite: strano }).primePartite, 3, `primePartite ${String(strano)}`);
  }
});

prova('sistemaConfigRecensioni: i valori buoni passano; solo "false" spegne', () => {
  assert.deepEqual(sistemaConfigRecensioni({ attiva: false, soloNuovi: false, primePartite: 7, conNome: false }), { attiva: false, soloNuovi: false, primePartite: 7, conNome: false });
  assert.equal(sistemaConfigRecensioni({ attiva: 0 }).attiva, true);
  assert.equal(sistemaConfigRecensioni({ attiva: 'no' }).attiva, true);
  assert.equal(sistemaConfigRecensioni({ primePartite: '4' }).primePartite, 4);
  assert.equal(sistemaConfigRecensioni({ primePartite: 50 }).primePartite, 50);
  assert.equal(sistemaConfigRecensioni({ primePartite: 1 }).primePartite, 1);
});

prova('sistemaConfigRecensioni: il soprannome e\' acceso se non c\'e\' scritto niente; una cosa strana lo SPEGNE (si sta dalla parte della riservatezza)', () => {
  assert.equal(sistemaConfigRecensioni({}).conNome, true);
  assert.equal(sistemaConfigRecensioni({ conNome: undefined }).conNome, true);
  assert.equal(sistemaConfigRecensioni(undefined).conNome, true);
  assert.equal(sistemaConfigRecensioni({ conNome: true }).conNome, true);
  assert.equal(sistemaConfigRecensioni({ conNome: false }).conNome, false);
  for (const strano of [0, 1, 'true', 'si', 'no', 'false', null, [], {}, NaN]) {
    assert.equal(sistemaConfigRecensioni({ conNome: strano }).conNome, false, `conNome ${JSON.stringify(strano)}`);
  }
});

// ================= la memoria del telefono =================

prova('leggiArchivio: niente o roba rotta = memoria vuota', () => {
  const vuoto = archivioVuoto();
  assert.deepEqual(vuoto, { partite: 0, inviata: false, ultimaPartita: null });
  for (const brutto of [null, undefined, '', '{', 'ciao', '[]', '[1,2]', '5', 'null', 'true', '"testo"']) {
    assert.deepEqual(leggiArchivio(brutto), vuoto, `testo: ${String(brutto)}`);
  }
});

prova('leggiArchivio: scrittura e lettura tornano uguali', () => {
  const a = { partite: 2, inviata: true, ultimaPartita: { codice: 'ABCD', quando: ORA, chiesta: true } };
  assert.deepEqual(leggiArchivio(scriviArchivio(a)), a);
});

prova('leggiArchivio: campi con tipo sbagliato vengono scartati uno per uno', () => {
  assert.equal(leggiArchivio('{"partite":"3"}').partite, 0);
  assert.equal(leggiArchivio('{"partite":-1}').partite, 0);
  assert.equal(leggiArchivio('{"partite":2.5}').partite, 0);
  assert.equal(leggiArchivio('{"partite":999999}').partite, 0);
  assert.equal(leggiArchivio('{"partite":4}').partite, 4);
  assert.equal(leggiArchivio('{"inviata":"true"}').inviata, false);
  assert.equal(leggiArchivio('{"inviata":1}').inviata, false);
  assert.equal(leggiArchivio('{"inviata":true}').inviata, true);
  const senzaUltima = leggiArchivio('{"partite":2,"ultimaPartita":{"codice":"ABCD"}}');
  assert.equal(senzaUltima.ultimaPartita, null);
  assert.equal(senzaUltima.partite, 2);
  assert.equal(leggiArchivio('{"ultimaPartita":{"codice":"","quando":5}}').ultimaPartita, null);
  assert.equal(leggiArchivio(`{"ultimaPartita":{"codice":"${'X'.repeat(21)}","quando":5}}`).ultimaPartita, null);
  assert.equal(leggiArchivio('{"ultimaPartita":{"codice":"ABCD","quando":"ieri"}}').ultimaPartita, null);
  assert.equal(leggiArchivio('{"ultimaPartita":"ABCD"}').ultimaPartita, null);
  assert.deepEqual(leggiArchivio('{"ultimaPartita":{"codice":"ABCD","quando":7}}').ultimaPartita, { codice: 'ABCD', quando: 7, chiesta: false });
});

prova('la chiave della memoria e\' una sola e non e\' quella delle partite in corso', () => {
  assert.equal(CHIAVE_ARCHIVIO, 'corsa-cristiana-recensioni');
  assert.ok(!/partita-attiva/.test(CHIAVE_ARCHIVIO));
});

prova('registraFinePartita: la prima partita conta uno', () => {
  const r = registraFinePartita(archivioVuoto(), 'ABCD', ORA);
  assert.equal(r.nuova, true);
  assert.equal(r.archivio.partite, 1);
  assert.deepEqual(r.archivio.ultimaPartita, { codice: 'ABCD', quando: ORA, chiesta: false });
});

prova('registraFinePartita: la stessa partita (pagina ricaricata) non conta due volte', () => {
  const uno = registraFinePartita(archivioVuoto(), 'ABCD', ORA).archivio;
  const due = registraFinePartita(uno, 'ABCD', ORA + 60 * 1000);
  assert.equal(due.nuova, false);
  assert.equal(due.archivio.partite, 1);
  const tre = registraFinePartita(uno, 'ABCD', ORA + ORE(11));
  assert.equal(tre.nuova, false);
});

prova('registraFinePartita: un altro codice, o lo stesso codice molto tempo dopo, e\' una partita nuova', () => {
  const uno = registraFinePartita(archivioVuoto(), 'ABCD', ORA).archivio;
  const altroCodice = registraFinePartita(uno, 'WXYZ', ORA + 1000);
  assert.equal(altroCodice.nuova, true);
  assert.equal(altroCodice.archivio.partite, 2);
  const stessoMaDopo = registraFinePartita(uno, 'ABCD', ORA + STESSA_PARTITA_ENTRO_MS + 1);
  assert.equal(stessoMaDopo.nuova, true);
  assert.equal(stessoMaDopo.archivio.partite, 2);
});

prova('registraFinePartita: l\'orologio del telefono che va indietro non crea partite false', () => {
  const uno = registraFinePartita(archivioVuoto(), 'ABCD', ORA).archivio;
  assert.equal(registraFinePartita(uno, 'ABCD', ORA - 5000).nuova, false);
});

prova('registraFinePartita: non modifica la memoria che riceve', () => {
  const originale = archivioVuoto();
  const copia = JSON.stringify(originale);
  registraFinePartita(originale, 'ABCD', ORA);
  assert.equal(JSON.stringify(originale), copia);
});

prova('segnaChiesta e segnaInviata: cambiano solo il loro campo', () => {
  const a = registraFinePartita(archivioVuoto(), 'ABCD', ORA).archivio;
  const b = segnaChiesta(a);
  assert.equal(b.ultimaPartita.chiesta, true);
  assert.equal(a.ultimaPartita.chiesta, false);
  assert.equal(b.partite, 1);
  assert.equal(segnaInviata(b).inviata, true);
  assert.equal(b.inviata, false);
  assert.deepEqual(segnaChiesta(archivioVuoto()), archivioVuoto());   // senza partita registrata non si inventa niente
});

// ================= chiedere o no? =================

// Simula le partite di un telefono: a ogni fine partita registra, decide, e la persona fa quello che dice "gesto".
function simula(config, gesti, { primaOra = ORA } = {}) {
  let archivio = archivioVuoto();
  const chiesto = [];
  gesti.forEach((gesto, i) => {
    const conto = registraFinePartita(archivio, 'P' + i, primaOra + i * ORE(24));
    archivio = conto.archivio;
    const d = decidiRichiesta({ config, archivio, nuova: conto.nuova });
    chiesto.push(d.chiedere);
    if (d.chiedere) {
      archivio = segnaChiesta(archivio);
      if (gesto === 'invia') archivio = segnaInviata(archivio);
    }
  });
  return chiesto;
}

prova('decidiRichiesta: chi non risponde mai viene richiesto solo nelle prime 3 partite', () => {
  assert.deepEqual(simula(CONFIG_BASE, ['salta', 'salta', 'salta', 'salta', 'salta']), [true, true, true, false, false]);
});

prova('decidiRichiesta: chi manda la recensione non viene piu\' disturbato', () => {
  assert.deepEqual(simula(CONFIG_BASE, ['invia', 'salta', 'salta']), [true, false, false]);
  assert.deepEqual(simula(CONFIG_BASE, ['salta', 'invia', 'salta', 'salta']), [true, true, false, false]);
});

prova('decidiRichiesta: "primePartite" decide quante volte', () => {
  assert.deepEqual(simula({ ...CONFIG_BASE, primePartite: 1 }, ['salta', 'salta']), [true, false]);
  assert.deepEqual(simula({ ...CONFIG_BASE, primePartite: 5 }, Array(7).fill('salta')), [true, true, true, true, true, false, false]);
});

prova('decidiRichiesta: senza "solo nuovi" si chiede sempre, finche\' non arriva la recensione', () => {
  const c = { ...CONFIG_BASE, soloNuovi: false };
  assert.deepEqual(simula(c, Array(6).fill('salta')), [true, true, true, true, true, true]);
  assert.deepEqual(simula(c, ['salta', 'salta', 'invia', 'salta']), [true, true, true, false]);
});

prova('decidiRichiesta: spenta = mai', () => {
  assert.deepEqual(simula({ ...CONFIG_BASE, attiva: false }, ['salta', 'salta']), [false, false]);
  assert.deepEqual(simula({ ...CONFIG_BASE, attiva: false, soloNuovi: false }, ['salta']), [false]);
});

prova('decidiRichiesta: la stessa partita (pagina ricaricata) non viene richiesta due volte', () => {
  let a = registraFinePartita(archivioVuoto(), 'ABCD', ORA).archivio;
  assert.equal(decidiRichiesta({ config: CONFIG_BASE, archivio: a, nuova: true }).chiedere, true);
  a = segnaChiesta(a);
  const ricaricata = registraFinePartita(a, 'ABCD', ORA + 30000);
  const d = decidiRichiesta({ config: CONFIG_BASE, archivio: ricaricata.archivio, nuova: ricaricata.nuova });
  assert.equal(d.chiedere, false);
  assert.equal(d.motivo, 'gia-chiesta');
});

prova('decidiRichiesta: se la pagina si ricarica PRIMA che la richiesta sia comparsa, la richiesta compare', () => {
  const a = registraFinePartita(archivioVuoto(), 'ABCD', ORA).archivio;       // contata ma mai mostrata
  const ricaricata = registraFinePartita(a, 'ABCD', ORA + 2000);
  assert.equal(ricaricata.nuova, false);
  assert.equal(decidiRichiesta({ config: CONFIG_BASE, archivio: ricaricata.archivio, nuova: false }).chiedere, true);
});

prova('decidiRichiesta: l\'interruttore di prova chiede sempre, anche a chi ha gia\' risposto o con tutto spento', () => {
  const inviata = segnaInviata(registraFinePartita(archivioVuoto(), 'ABCD', ORA).archivio);
  assert.equal(decidiRichiesta({ config: { ...CONFIG_BASE, attiva: false }, archivio: inviata, nuova: false, forzata: true }).chiedere, true);
  assert.equal(decidiRichiesta({ config: CONFIG_BASE, archivio: inviata, nuova: false, forzata: false }).chiedere, false);
});

prova('decidiRichiesta: impostazioni mancanti o strane = valori di base, non un errore', () => {
  const a = registraFinePartita(archivioVuoto(), 'ABCD', ORA).archivio;
  assert.equal(decidiRichiesta({ config: undefined, archivio: a, nuova: true }).chiedere, true);
  assert.equal(decidiRichiesta({ config: 'boh', archivio: a, nuova: true }).chiedere, true);
});

// ================= il commento =================

prova('pulisciCommento: spazi e righe vuote in ordine', () => {
  assert.equal(pulisciCommento('   Bello   il   gioco   '), 'Bello il gioco');
  assert.equal(pulisciCommento('uno\r\ndue\rtre'), 'uno\ndue\ntre');
  assert.equal(pulisciCommento('a\n\n\n\n\nb'), 'a\n\nb');
  assert.equal(pulisciCommento('riga  \n   riga'), 'riga\nriga');
  assert.equal(pulisciCommento('\n\n  ciao  \n\n'), 'ciao');
  assert.equal(pulisciCommento('tab\t\tdue'), 'tab due');
});

prova('pulisciCommento: niente, null, undefined e numeri non rompono', () => {
  assert.equal(pulisciCommento(''), '');
  assert.equal(pulisciCommento(undefined), '');
  assert.equal(pulisciCommento(null), '');
  assert.equal(pulisciCommento('   \n  '), '');
  assert.equal(pulisciCommento(42), '42');
});

prova('pulisciCommento: toglie i caratteri di controllo, invisibili e quelli che girano la scrittura', () => {
  assert.equal(pulisciCommento('a\u0000b\u0007c\u001Bd\u007Fe\u0085f'), 'abcdef');
  assert.equal(pulisciCommento('a​b﻿c'), 'abc');
  assert.equal(pulisciCommento('ciao‮olleh‬'), 'ciaoolleh');
  assert.equal(pulisciCommento('x⁦y⁩z'), 'xyz');
  assert.equal(pulisciCommento('mezza\uD83Dcoppia'), 'mezzacoppia');
});

prova('pulisciCommento: gli emoji (anche quelli composti) restano interi', () => {
  assert.equal(pulisciCommento('Bello 😀 👨‍👩‍👧 👍🏽 🙏'), 'Bello 😀 👨‍👩‍👧 👍🏽 🙏');
  assert.equal(pulisciCommento('è andata così, perché sì — “ok”'), 'è andata così, perché sì — “ok”');
});

prova('pulisciCommento: oltre il limite si accorcia senza spezzare un emoji', () => {
  const lungo = 'a'.repeat(MAX_CARATTERI_COMMENTO + 50);
  assert.equal(Array.from(pulisciCommento(lungo)).length, MAX_CARATTERI_COMMENTO);
  const conEmoji = '😀'.repeat(MAX_CARATTERI_COMMENTO + 5);
  const corto = pulisciCommento(conEmoji);
  assert.equal(Array.from(corto).length, MAX_CARATTERI_COMMENTO);
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(corto), 'niente mezzi emoji');
  assert.equal(pulisciCommento('b'.repeat(MAX_CARATTERI_COMMENTO)).length, MAX_CARATTERI_COMMENTO);
});

prova('pulisciCommento: un commento pieno di caratteri speciali di pagina resta solo testo (la pagina lo mostra come testo)', () => {
  const t = '<script>alert("x")</script> & "virgolette" \'apici\'';
  assert.equal(pulisciCommento(t), t);
});

// ================= da quale versione arriva =================

prova('versioneDalPercorso: la cartella /beta/ e\' la copia di prova, il resto e\' il gioco ufficiale', () => {
  assert.equal(versioneDalPercorso('/corsa-cristiana/beta/giocatore.html'), 'beta');
  assert.equal(versioneDalPercorso('/beta/giocatore.html'), 'beta');
  assert.equal(versioneDalPercorso('/corsa-cristiana/giocatore.html'), 'ufficiale');
  assert.equal(versioneDalPercorso('/giocatore.html'), 'ufficiale');
  assert.equal(versioneDalPercorso('/'), 'ufficiale');
  assert.equal(versioneDalPercorso('/corsa-cristiana/betatest/giocatore.html'), 'ufficiale');
  assert.equal(versioneDalPercorso(''), 'ufficiale');
  assert.equal(versioneDalPercorso(undefined), 'ufficiale');
  assert.equal(versioneDalPercorso(null), 'ufficiale');
});

// ================= il soprannome =================

prova('pulisciNome: un nome normale resta com\'e\' (accenti, apostrofi, emoji)', () => {
  assert.equal(pulisciNome('Anna'), 'Anna');
  assert.equal(pulisciNome('Niccolò'), 'Niccolò');
  assert.equal(pulisciNome("Mario D'Angelo"), "Mario D'Angelo");
  assert.equal(pulisciNome('Gigi 😀'), 'Gigi 😀');
});

prova('pulisciNome: spazi in piu\', a capo e tabulazioni diventano uno spazio solo, e si tolgono i bordi', () => {
  assert.equal(pulisciNome('  Anna   Maria  '), 'Anna Maria');
  assert.equal(pulisciNome('Anna\nMaria'), 'Anna Maria');
  assert.equal(pulisciNome('Anna\r\n\r\nMaria\tRossi'), 'Anna Maria Rossi');
});

prova('pulisciNome: via i caratteri invisibili, di controllo e quelli che girano il verso della scrittura', () => {
  assert.equal(pulisciNome('An\u200bna'), 'Anna');
  assert.equal(pulisciNome('\u202eAnna'), 'Anna');
  assert.equal(pulisciNome('An\u0000na\u0007'), 'Anna');
  assert.equal(pulisciNome('\ufeffAnna'), 'Anna');
  assert.equal(pulisciNome('\u200b\u200b'), '');
});

prova('pulisciNome: al massimo ' + MAX_CARATTERI_NOME + ' caratteri, senza spezzare le emoji', () => {
  assert.equal(MAX_CARATTERI_NOME, 30);
  assert.equal(Array.from(pulisciNome('a'.repeat(500))).length, MAX_CARATTERI_NOME);
  const emoji = pulisciNome('😀'.repeat(100));
  assert.equal(Array.from(emoji).length, MAX_CARATTERI_NOME);
  assert.ok(!/[\ud800-\udfff]/.test(emoji.replace(/[\ud800-\udbff][\udc00-\udfff]/g, '')), 'nessuna meta\' di emoji rimasta sola');
  assert.equal(pulisciNome('x'.repeat(29) + '😀😀'), 'x'.repeat(29) + '😀');
  assert.equal(pulisciNome('a'.repeat(29) + ' ' + 'b'.repeat(10)), 'a'.repeat(29));    // il taglio non lascia spazi in fondo
});

prova('pulisciNome: quello che non e\' un testo vale come "niente"', () => {
  for (const strano of [undefined, null, 5, NaN, true, {}, [], ['Anna'], () => 'Anna', '', '   ', '\n\t']) {
    assert.equal(pulisciNome(strano), '', String(strano));
  }
});

prova('pulisciNome: un nome con codice HTML resta testo (verra\' mostrato come testo)', () => {
  assert.equal(pulisciNome('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>'.slice(0, 30));
});

prova('testoRiservatezza: col soprannome lo scrive per intero; senza dice che e\' anonima', () => {
  const con = testoRiservatezza('Anna');
  assert.ok(con.includes('«Anna»'));
  assert.ok(/firmata/.test(con) && /soprannome/.test(con));
  assert.ok(!/anonima/.test(con));
  for (const niente of [undefined, null, '', '   ', 5, '\u200b']) {
    const senza = testoRiservatezza(niente);
    assert.ok(/anonima/.test(senza), String(niente));
    assert.ok(!/soprannome/.test(senza), String(niente));
  }
});

prova('testoRiservatezza: mostra il nome come l\'ha pulito la recensione (stesso taglio, stessa pulizia)', () => {
  const lungo = 'z'.repeat(80);
  assert.ok(testoRiservatezza(lungo).includes('«' + 'z'.repeat(MAX_CARATTERI_NOME) + '»'));
  assert.ok(testoRiservatezza('  Anna   Maria ').includes('«Anna Maria»'));
});

// ================= il pacchetto da spedire =================

const BASE = { stelle: 4, commento: ' Bello! ', adesso: ORA, versione: 'beta', modalita: 'veloce', giocatori: 4, junior: true, partite: 2 };

prova('stelleValide: solo interi da 1 a 5', () => {
  for (const s of [1, 2, 3, 4, 5]) assert.equal(stelleValide(s), true);
  for (const s of [0, 6, -1, 3.5, '4', NaN, Infinity, null, undefined, [], {}]) assert.equal(stelleValide(s), false, String(s));
});

prova('costruisciRecensione: il pacchetto completo', () => {
  const r = costruisciRecensione(BASE);
  assert.equal(r.ok, true);
  assert.deepEqual(r.recensione, {
    stelle: 4, creataIl: ORA, commento: 'Bello!', versione: 'beta', modalita: 'veloce', giocatori: 4, junior: true, partite: 2
  });
});

prova('costruisciRecensione: senza commento il campo non c\'e\' proprio', () => {
  for (const vuoto of ['', '   ', '\n\n', undefined, null]) {
    const r = costruisciRecensione({ ...BASE, commento: vuoto });
    assert.equal(r.ok, true);
    assert.ok(!('commento' in r.recensione), `commento ${JSON.stringify(vuoto)}`);
  }
});

prova('costruisciRecensione: senza stelle valide non parte nulla', () => {
  for (const s of [0, 6, 3.5, '4', NaN, undefined, null, -2]) {
    const r = costruisciRecensione({ ...BASE, stelle: s });
    assert.equal(r.ok, false);
    assert.equal(r.errore, 'stelle');
  }
});

prova('costruisciRecensione: senza un\'ora valida non parte nulla', () => {
  assert.equal(costruisciRecensione({ ...BASE, adesso: NaN }).errore, 'ora');
  assert.equal(costruisciRecensione({ ...BASE, adesso: undefined }).errore, 'ora');
});

prova('costruisciRecensione: versione e modalita\' sono solo quelle conosciute', () => {
  assert.equal(costruisciRecensione({ ...BASE, versione: 'beta' }).recensione.versione, 'beta');
  assert.equal(costruisciRecensione({ ...BASE, versione: 'ufficiale' }).recensione.versione, 'ufficiale');
  assert.equal(costruisciRecensione({ ...BASE, versione: 'boh' }).recensione.versione, 'ufficiale');
  assert.equal(costruisciRecensione({ ...BASE, versione: undefined }).recensione.versione, 'ufficiale');
  assert.equal(costruisciRecensione({ ...BASE, modalita: 'veloce' }).recensione.modalita, 'veloce');
  assert.equal(costruisciRecensione({ ...BASE, modalita: 'normale' }).recensione.modalita, 'normale');
  assert.equal(costruisciRecensione({ ...BASE, modalita: undefined }).recensione.modalita, 'normale');
  assert.equal(costruisciRecensione({ ...BASE, modalita: 'lenta' }).recensione.modalita, 'normale');
});

prova('costruisciRecensione: giocatori, junior e partite si scrivono solo se sensati', () => {
  const r1 = costruisciRecensione({ ...BASE, giocatori: 0, junior: false, partite: -1 }).recensione;
  assert.ok(!('giocatori' in r1) && !('junior' in r1) && !('partite' in r1));
  const r2 = costruisciRecensione({ ...BASE, giocatori: 100, junior: 'si', partite: 1.5 }).recensione;
  assert.ok(!('giocatori' in r2) && !('junior' in r2) && !('partite' in r2));
  const r3 = costruisciRecensione({ ...BASE, giocatori: undefined, junior: undefined, partite: undefined }).recensione;
  assert.ok(!('giocatori' in r3) && !('junior' in r3) && !('partite' in r3));
  assert.equal(costruisciRecensione({ ...BASE, partite: 0 }).recensione.partite, 0);
  assert.equal(costruisciRecensione({ ...BASE, giocatori: 12 }).recensione.giocatori, 12);
});

prova('costruisciRecensione: Firebase non accetta "undefined": nessun valore e\' undefined, tutto passa da JSON', () => {
  for (const variante of [BASE, { ...BASE, commento: undefined, giocatori: undefined, junior: undefined, partite: undefined }]) {
    const r = costruisciRecensione(variante).recensione;
    for (const [k, v] of Object.entries(r)) assert.notEqual(v, undefined, k);
    assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
  }
});

prova('costruisciRecensione: l\'ora si arrotonda (Firebase vuole numeri interi per le date)', () => {
  assert.equal(costruisciRecensione({ ...BASE, adesso: ORA + 0.6 }).recensione.creataIl, ORA + 1);
});

prova('costruisciRecensione: senza soprannome la recensione e\' anonima (nessun nome, nessun codice partita) e ha solo i campi previsti', () => {
  const campi = Object.keys(costruisciRecensione(BASE).recensione).sort();
  assert.deepEqual(campi, ['commento', 'creataIl', 'giocatori', 'junior', 'modalita', 'partite', 'stelle', 'versione']);
  assert.ok(!('nome' in costruisciRecensione({ ...BASE, nome: undefined }).recensione));
});

prova('costruisciRecensione: col soprannome c\'e\' un solo campo in piu\' ("nome"), ripulito; nient\'altro di personale', () => {
  const r = costruisciRecensione({ ...BASE, nome: '  Anna  ' });
  assert.equal(r.ok, true);
  assert.equal(r.recensione.nome, 'Anna');
  assert.deepEqual(Object.keys(r.recensione).sort(), ['commento', 'creataIl', 'giocatori', 'junior', 'modalita', 'nome', 'partite', 'stelle', 'versione']);
  assert.deepEqual(JSON.parse(JSON.stringify(r.recensione)), r.recensione);
});

prova('costruisciRecensione: un soprannome vuoto, strano o non testuale non produce il campo', () => {
  for (const niente of ['', '   ', '\n', '\u200b', undefined, null, 5, {}, [], true]) {
    const r = costruisciRecensione({ ...BASE, nome: niente });
    assert.equal(r.ok, true);
    assert.ok(!('nome' in r.recensione), `nome ${JSON.stringify(niente)}`);
  }
});

prova('costruisciRecensione: il soprannome lungo viene accorciato (il campo del nome in lobby non ha limiti)', () => {
  const r = costruisciRecensione({ ...BASE, nome: 'k'.repeat(5000) }).recensione;
  assert.equal(Array.from(r.nome).length, MAX_CARATTERI_NOME);
});

prova('costruisciRecensione: il soprannome non cambia gli altri campi', () => {
  const senza = costruisciRecensione(BASE).recensione;
  const con = costruisciRecensione({ ...BASE, nome: 'Anna' }).recensione;
  const { nome, ...resto } = con;
  assert.equal(nome, 'Anna');
  assert.deepEqual(resto, senza);
});

prova('costruisciRecensione: il commento viene pulito e accorciato', () => {
  const r = costruisciRecensione({ ...BASE, commento: 'x'.repeat(2000) }).recensione;
  assert.equal(Array.from(r.commento).length, MAX_CARATTERI_COMMENTO);
});

// ================= quando l'invio non riesce =================

prova('tipoErroreInvio: riconosce "permesso negato", "rete" e il resto', () => {
  assert.equal(tipoErroreInvio({ code: 'PERMISSION_DENIED', message: 'Permission denied' }), 'permessi');
  assert.equal(tipoErroreInvio(new Error('PERMISSION_DENIED: Permission denied')), 'permessi');
  assert.equal(tipoErroreInvio({ code: 'permission-denied' }), 'permessi');
  assert.equal(tipoErroreInvio('permission denied'), 'permessi');
  assert.equal(tipoErroreInvio(new Error('Client is offline')), 'rete');
  assert.equal(tipoErroreInvio({ code: 'unavailable' }), 'rete');
  assert.equal(tipoErroreInvio({ code: 'network-request-failed' }), 'rete');
  assert.equal(tipoErroreInvio(new Error('boh')), 'altro');
  assert.equal(tipoErroreInvio(undefined), 'altro');
  assert.equal(tipoErroreInvio(null), 'altro');
  assert.equal(tipoErroreInvio({}), 'altro');
});

// ================= Admin: leggere una recensione =================

const R = (stelle, extra = {}) => ({ _chiave: 'k' + Math.random().toString(36).slice(2, 7), stelle, creataIl: ORA, versione: 'beta', modalita: 'normale', ...extra });

prova('votoDi: un intero da 1 a 5, altrimenti 0', () => {
  assert.equal(votoDi({ stelle: 3 }), 3);
  assert.equal(votoDi({ stelle: '4' }), 4);
  for (const strano of [0, 6, -1, 2.5, 'boh', null, undefined, NaN, {}, []]) assert.equal(votoDi({ stelle: strano }), 0, String(strano));
  assert.equal(votoDi(null), 0);
  assert.equal(votoDi(undefined), 0);
  assert.equal(votoDi({}), 0);
});

prova('nomeDi: il soprannome della recensione, oppure niente', () => {
  assert.equal(nomeDi({ nome: 'Anna' }), 'Anna');
  assert.equal(nomeDi({ nome: '  Anna ' }), 'Anna');
  for (const strano of [5, null, undefined, {}, [], true]) assert.equal(nomeDi({ nome: strano }), '', String(strano));
  assert.equal(nomeDi({}), '');
  assert.equal(nomeDi(null), '');
  assert.equal(nomeDi(undefined), '');
});

prova('commentoDi, modalitaDi, versioneDi, dataDi: tollerano i dati strani', () => {
  assert.equal(commentoDi({ commento: '  ciao ' }), 'ciao');
  assert.equal(commentoDi({ commento: 5 }), '');
  assert.equal(commentoDi({}), '');
  assert.equal(commentoDi(null), '');
  assert.equal(modalitaDi({ modalita: 'veloce' }), 'veloce');
  assert.equal(modalitaDi({ modalita: 'altro' }), 'normale');
  assert.equal(modalitaDi({}), 'normale');
  assert.equal(versioneDi({ versione: 'beta' }), 'beta');
  assert.equal(versioneDi({ versione: 'ufficiale' }), 'ufficiale');
  assert.equal(versioneDi({ versione: 'x' }), 'sconosciuta');
  assert.equal(versioneDi(undefined), 'sconosciuta');
  assert.equal(dataDi({ creataIl: 5 }), 5);
  assert.equal(dataDi({ creataIl: 'ieri' }), 0);
  assert.equal(dataDi({}), 0);
});

prova('etichettaStelle: 5 simboli, pieni fino al voto', () => {
  assert.equal(etichettaStelle(4), '★★★★☆');
  assert.equal(etichettaStelle(5), '★★★★★');
  assert.equal(etichettaStelle(1), '★☆☆☆☆');
  assert.equal(etichettaStelle(0), '☆☆☆☆☆');
  assert.equal(etichettaStelle(9), '★★★★★');
  assert.equal(etichettaStelle(undefined), '☆☆☆☆☆');
});

prova('dataEOra: data e ora con l\'orologio di chi guarda; vuote se la data manca', () => {
  const quando = new Date(2026, 9, 14, 10, 32, 5).getTime();   // 14 ottobre 2026, 10:32 (ora locale)
  assert.deepEqual(dataEOra(quando), { data: '2026-10-14', ora: '10:32' });
  const presto = new Date(2026, 0, 3, 7, 5).getTime();
  assert.deepEqual(dataEOra(presto), { data: '2026-01-03', ora: '07:05' });
  for (const brutto of [0, -1, NaN, undefined, null, 'ieri']) assert.deepEqual(dataEOra(brutto), { data: '', ora: '' }, String(brutto));
});

// ================= Admin: riepilogo =================

prova('riassumi: nessuna recensione', () => {
  const r = riassumi([]);
  assert.equal(r.totale, 0);
  assert.equal(r.votate, 0);
  assert.equal(r.media, null);
  assert.equal(r.conCommento, 0);
  assert.equal(r.ultima, null);
  assert.deepEqual(r.distribuzione, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  assert.equal(riassumi(undefined).totale, 0);
  assert.equal(riassumi(null).totale, 0);
});

prova('riassumi: media con un decimale, distribuzione, commenti, ultima', () => {
  const r = riassumi([R(5, { creataIl: 100, commento: 'Ottimo' }), R(4, { creataIl: 300 }), R(4, { creataIl: 200, commento: 'Bello' }), R(1, { creataIl: 50 })]);
  assert.equal(r.totale, 4);
  assert.equal(r.votate, 4);
  assert.equal(r.media, 3.5);        // (5+4+4+1)/4
  assert.deepEqual(r.distribuzione, { 1: 1, 2: 0, 3: 0, 4: 2, 5: 1 });
  assert.equal(r.conCommento, 2);
  assert.equal(r.ultima, 300);
});

prova('riassumi: arrotonda a un decimale', () => {
  assert.equal(riassumi([R(5), R(4), R(4), R(4)]).media, 4.3);     // 4,25 -> 4,3
  assert.equal(riassumi([R(5), R(5), R(4)]).media, 4.7);           // 4,666 -> 4,7
  assert.equal(riassumi([R(1), R(2)]).media, 1.5);
});

prova('riassumi: i dati strani contano nel totale ma non sporcano la media', () => {
  const r = riassumi([R(5), { _chiave: 'x', stelle: 'boh' }, { _chiave: 'y' }, R(3, { commento: 5 })]);
  assert.equal(r.totale, 4);
  assert.equal(r.votate, 2);
  assert.equal(r.media, 4);
  assert.equal(r.conCommento, 0);
});

prova('contaRecensioni: i numeri accanto ai pulsanti', () => {
  const lista = [
    R(5, { modalita: 'veloce', commento: 'a' }), R(5), R(3, { versione: 'ufficiale', modalita: 'veloce' }), R(1, { versione: 'ufficiale' }),
    { _chiave: 'strana', stelle: 9, versione: 'boh' }
  ];
  const c = contaRecensioni(lista);
  assert.equal(c.totale, 5);
  assert.equal(c.conCommento, 1);
  assert.deepEqual(c.stelle, { 1: 1, 2: 0, 3: 1, 4: 0, 5: 2 });
  assert.deepEqual(c.modalita, { normale: 3, veloce: 2 });
  assert.deepEqual(c.versione, { beta: 2, ufficiale: 2 });     // quella di versione sconosciuta non si conta
});

// ================= Admin: filtri =================

const LISTA = [
  R(5, { _chiave: 'a', creataIl: 1000, commento: 'Bellissimo, mi è piaciuta la modalità veloce!', modalita: 'veloce', giocatori: 4, partite: 1 }),
  R(2, { _chiave: 'b', creataIl: 2000, commento: 'Troppo lunga. Proporrei più domande per i bambini.', giocatori: 6, junior: true, partite: 2 }),
  R(4, { _chiave: 'c', creataIl: 3000, versione: 'ufficiale', giocatori: 3, nome: 'Marta' }),
  R(5, { _chiave: 'd', creataIl: 4000, commento: "L'Eden è la mia domanda preferita", versione: 'ufficiale', modalita: 'veloce' }),
  R(3, { _chiave: 'e', creataIl: 5000, commento: 'Così così', nome: 'Zaccaria' }),
  R(1, { _chiave: 'f', creataIl: 6000, commento: 'Non ho capito le regole' })
];
const chiavi = lista => lista.map(r => r._chiave);
const trova = filtri => chiavi(filtraRecensioni(LISTA, filtri));

prova('filtraRecensioni: senza filtri ci sono tutte, le piu\' recenti per prime', () => {
  assert.deepEqual(trova({}), ['f', 'e', 'd', 'c', 'b', 'a']);
  assert.deepEqual(trova(undefined), ['f', 'e', 'd', 'c', 'b', 'a']);
  assert.deepEqual(trova(FILTRI_RECENSIONI_INIZIALI), ['f', 'e', 'd', 'c', 'b', 'a']);
});

prova('filtraRecensioni: per stelle', () => {
  assert.deepEqual(trova({ stelle: '5' }), ['d', 'a']);
  assert.deepEqual(trova({ stelle: 5 }), ['d', 'a']);
  assert.deepEqual(trova({ stelle: '1' }), ['f']);
  assert.deepEqual(trova({ stelle: '3' }), ['e']);
  assert.deepEqual(trova({ stelle: 'tutte' }), ['f', 'e', 'd', 'c', 'b', 'a']);
});

prova('filtraRecensioni: solo con commento', () => {
  assert.deepEqual(trova({ commento: 'con' }), ['f', 'e', 'd', 'b', 'a']);
});

prova('filtraRecensioni: per modalita\' e per versione', () => {
  assert.deepEqual(trova({ modalita: 'veloce' }), ['d', 'a']);
  assert.deepEqual(trova({ modalita: 'normale' }), ['f', 'e', 'c', 'b']);
  assert.deepEqual(trova({ versione: 'ufficiale' }), ['d', 'c']);
  assert.deepEqual(trova({ versione: 'beta' }), ['f', 'e', 'b', 'a']);
});

prova('filtraRecensioni: la ricerca trova anche il soprannome (anche in minuscolo, con parti del nome)', () => {
  assert.deepEqual(trova({ testo: 'marta' }), ['c']);
  assert.deepEqual(trova({ testo: 'MARTA' }), ['c']);
  assert.deepEqual(trova({ testo: 'zacc' }), ['e']);
  assert.deepEqual(trova({ testo: 'zaccaria cosi' }), ['e']);           // soprannome e commento insieme
  assert.deepEqual(trova({ testo: 'zaccaria bambini' }), []);           // tutte le parole devono esserci
  assert.deepEqual(trova({ testo: 'marta', commento: 'con' }), []);     // Marta non ha scritto il commento
  assert.deepEqual(trova({ testo: 'marta', stelle: '4' }), ['c']);
  assert.deepEqual(trova({ testo: 'anonimo' }), []);
});

prova('filtraRecensioni: la ricerca trova nel commento, anche senza accenti e con le maiuscole', () => {
  assert.deepEqual(trova({ testo: 'bambini' }), ['b']);
  assert.deepEqual(trova({ testo: 'MODALITA veloce' }), ['a']);
  assert.deepEqual(trova({ testo: 'piaciuta' }), ['a']);
  assert.deepEqual(trova({ testo: "l’eden" }), ['d']);       // apostrofo diverso
  assert.deepEqual(trova({ testo: 'cosi' }), ['e']);
  assert.deepEqual(trova({ testo: 'regole domande' }), []);  // tutte le parole devono esserci
  assert.deepEqual(trova({ testo: '   ' }), ['f', 'e', 'd', 'c', 'b', 'a']);
});

prova('filtraRecensioni: i filtri si combinano', () => {
  assert.deepEqual(trova({ stelle: '5', modalita: 'veloce' }), ['d', 'a']);
  assert.deepEqual(trova({ stelle: '5', versione: 'ufficiale' }), ['d']);
  assert.deepEqual(trova({ stelle: '4', commento: 'con' }), []);
  assert.deepEqual(trova({ versione: 'beta', commento: 'con', testo: 'regole' }), ['f']);
});

prova('filtraRecensioni: un valore di filtro sconosciuto non nasconde niente', () => {
  assert.deepEqual(trova({ stelle: '9', commento: 'boh', modalita: 'lenta', versione: 'x' }), ['f', 'e', 'd', 'c', 'b', 'a']);
});

prova('filtriAttivi: conta i filtri accesi', () => {
  assert.equal(filtriAttivi({}), 0);
  assert.equal(filtriAttivi({ ordine: 'basse' }), 0);
  assert.equal(filtriAttivi({ testo: 'ciao' }), 1);
  assert.equal(filtriAttivi({ testo: '   ' }), 0);
  assert.equal(filtriAttivi({ stelle: '5', commento: 'con', modalita: 'veloce', versione: 'beta', testo: 'x' }), 5);
  assert.equal(filtriAttivi({ stelle: '9', modalita: 'lenta' }), 0);
});

prova('corrisponde: regge dati strani', () => {
  assert.equal(corrisponde({}, {}), true);
  assert.equal(corrisponde(null, {}), true);
  assert.equal(corrisponde(undefined, { stelle: '5' }), false);
  assert.equal(corrisponde({ stelle: 'boh' }, { stelle: '5' }), false);
  assert.equal(corrisponde({ commento: 12 }, { testo: 'x' }), false);
});

// ================= Admin: ordine =================

const ordine = (nome) => chiavi(ordinaRecensioni(LISTA, nome));

prova('ordinaRecensioni: recenti, vecchie, voti piu\' bassi o piu\' alti per primi', () => {
  assert.deepEqual(ordine('recenti'), ['f', 'e', 'd', 'c', 'b', 'a']);
  assert.deepEqual(ordine('vecchie'), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(ordine('basse'), ['f', 'b', 'e', 'c', 'd', 'a']);     // 1,2,3,4,5,5 (a parita' prima la piu' recente)
  assert.deepEqual(ordine('alte'), ['d', 'a', 'c', 'e', 'b', 'f']);      // 5,5,4,3,2,1
  assert.deepEqual(ordine('boh'), ['f', 'e', 'd', 'c', 'b', 'a']);
  assert.deepEqual(ordine(undefined), ['f', 'e', 'd', 'c', 'b', 'a']);
});

prova('ordinaRecensioni: chi non ha un voto buono va sempre in fondo e non si modifica l\'elenco ricevuto', () => {
  const con = [R(3, { _chiave: 'v1', creataIl: 1 }), { _chiave: 'strana', creataIl: 9 }, R(1, { _chiave: 'v2', creataIl: 2 })];
  const prima = JSON.stringify(con);
  assert.deepEqual(chiavi(ordinaRecensioni(con, 'basse')), ['v2', 'v1', 'strana']);
  assert.deepEqual(chiavi(ordinaRecensioni(con, 'alte')), ['v1', 'v2', 'strana']);
  assert.equal(JSON.stringify(con), prima);
});

prova('filtraRecensioni: filtra e poi ordina', () => {
  assert.deepEqual(chiavi(filtraRecensioni(LISTA, { commento: 'con', ordine: 'basse' })), ['f', 'b', 'e', 'd', 'a']);
  assert.deepEqual(chiavi(filtraRecensioni(LISTA, { stelle: '5', ordine: 'vecchie' })), ['a', 'd']);
});

// ================= Admin: Excel =================

prova('righeExcel: una riga per recensione, dalla piu\' vecchia, con le colonne in italiano', () => {
  const quando = new Date(2026, 9, 14, 10, 32).getTime();
  const righe = righeExcel([
    R(4, { _chiave: 'x', creataIl: quando + 60000, commento: 'Bello', nome: 'Anna', modalita: 'veloce', giocatori: 5, junior: true, partite: 2, versione: 'beta' }),
    R(2, { _chiave: 'y', creataIl: quando, versione: 'ufficiale' })
  ]);
  assert.equal(righe.length, 2);
  assert.deepEqual(Object.keys(righe[0]), ['Data', 'Ora', 'Soprannome', 'Stelle', 'Commento', 'Modalità', 'Giocatori', 'Junior', 'Versione', 'Partite fatte']);
  assert.deepEqual(righe[0], { 'Data': '2026-10-14', 'Ora': '10:32', 'Soprannome': '', 'Stelle': 2, 'Commento': '', 'Modalità': 'Normale', 'Giocatori': '', 'Junior': '', 'Versione': 'ufficiale', 'Partite fatte': '' });
  assert.deepEqual(righe[1], { 'Data': '2026-10-14', 'Ora': '10:33', 'Soprannome': 'Anna', 'Stelle': 4, 'Commento': 'Bello', 'Modalità': 'Veloce', 'Giocatori': 5, 'Junior': 'sì', 'Versione': 'beta', 'Partite fatte': 2 });
});

prova('righeExcel: elenco vuoto o dati strani non rompono', () => {
  assert.deepEqual(righeExcel([]), []);
  assert.deepEqual(righeExcel(undefined), []);
  const strana = righeExcel([{ _chiave: 'z' }]);
  assert.equal(strana.length, 1);
  assert.equal(strana[0]['Stelle'], '');
  assert.equal(strana[0]['Data'], '');
  assert.equal(strana[0]['Soprannome'], '');
});

// ================= i due file restano "puri" =================

const cartella = path.dirname(fileURLToPath(import.meta.url));
const leggi = nome => readFileSync(path.join(cartella, 'js', nome), 'utf-8');

prova('recensioni-logica.js non importa niente (e\' leggero da caricare sul telefono)', () => {
  assert.ok(!/^\s*import\s/m.test(leggi('recensioni-logica.js')));
});

prova('i file della logica non toccano la pagina, il telefono o Firebase', () => {
  for (const nome of ['recensioni-logica.js', 'filtri-recensioni.js']) {
    const sorgente = leggi(nome).replace(/\/\/.*$/gm, '');
    assert.ok(!/\b(document|window|localStorage|sessionStorage|navigator|location|fetch)\b/.test(sorgente), nome);
    assert.ok(!/sincronizzazione|rete\.js|firebase/i.test(sorgente), nome);
  }
});

// ================= tante recensioni =================

prova('con 5000 recensioni filtri e riepilogo restano veloci', () => {
  const tante = Array.from({ length: 5000 }, (_, i) => R((i % 5) + 1, { _chiave: 'k' + i, creataIl: ORA + i, commento: i % 3 ? `Commento numero ${i} sul gioco` : undefined }));
  const inizio = Date.now();
  let totale = 0;
  for (let k = 0; k < 20; k++) {
    totale += filtraRecensioni(tante, { testo: 'gioco', stelle: k % 2 ? '5' : 'tutte', ordine: 'basse' }).length;
    riassumi(tante);
    contaRecensioni(tante);
  }
  const ms = Date.now() - inizio;
  assert.ok(totale > 0);
  assert.ok(ms < 3000, `${ms} ms`);
});

// ================= esito =================

console.log(`\nRecensioni di fine partita: ${provati - falliti.length}/${provati} ok${falliti.length ? `, ${falliti.length} FALLITI` : ''}`);
if (falliti.length) process.exit(1);
console.log('✅ Tutte le verifiche passate');
