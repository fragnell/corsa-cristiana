// test-regole.js
// Verifica regole.js: un turno passo passo, poi una partita intera in automatico.

import fs from 'node:fs';
import { creaStatoIniziale, giocatoreDiTurno, partitaFinita } from './js/stato.js';
import { tiraDado, muoviGiocatore, applicaRispostaConoscenza, applicaEsitoProva, passaTurno } from './js/regole.js';

const percorso = JSON.parse(fs.readFileSync('./dati/percorso.json', 'utf-8')).celle;

console.log('=== TEST 1: un turno passo passo ===');

let stato = creaStatoIniziale([
  { nome: 'Marco', colore: 'rosso' },
  { nome: 'Giulia', colore: 'blu' },
  { nome: 'Luca', colore: 'verde' },
  { nome: 'Sara', colore: 'giallo' }
]);

const dado = tiraDado();
console.log(`Tocca a ${giocatoreDiTurno(stato).nome} - tira ${dado}`);

let r = muoviGiocatore(stato, percorso, dado);
stato = r.stato;
console.log('Nuova posizione:', giocatoreDiTurno(stato).posizione, '- evento:', r.evento);

if (r.evento.tipo === 'IN_ATTESA' && r.evento.casella === 'CONOSCENZA') {
  r = applicaRispostaConoscenza(stato, percorso, true);
  stato = r.stato;
  console.log('Dopo risposta corretta, posizione:', giocatoreDiTurno(stato).posizione);
}
if (r.evento.tipo === 'IN_ATTESA' && r.evento.casella === 'PROVA') {
  r = applicaEsitoProva(stato, percorso, true);
  stato = r.stato;
  console.log('Dopo prova superata, posizione:', giocatoreDiTurno(stato).posizione);
}

stato = passaTurno(stato);
console.log('Ora tocca a:', giocatoreDiTurno(stato).nome);

console.log('\n=== TEST 2: partita intera in automatico (6 giocatori) ===');

let s = creaStatoIniziale([
  { nome: 'G1', colore: 'a' }, { nome: 'G2', colore: 'b' }, { nome: 'G3', colore: 'c' },
  { nome: 'G4', colore: 'd' }, { nome: 'G5', colore: 'e' }, { nome: 'G6', colore: 'f' }
]);

let turni = 0;
const MAX_TURNI = 5000;

while (!partitaFinita(s) && turni < MAX_TURNI) {
  turni++;
  let ris = muoviGiocatore(s, percorso, tiraDado());
  s = ris.stato;

  if (ris.evento.tipo === 'IN_ATTESA') {
    if (ris.evento.casella === 'CONOSCENZA') {
      ris = applicaRispostaConoscenza(s, percorso, Math.random() < 0.72);
      s = ris.stato;
    } else if (ris.evento.casella === 'PROVA') {
      ris = applicaEsitoProva(s, percorso, Math.random() < 0.80);
      s = ris.stato;
    }
  }
  if (!partitaFinita(s)) s = passaTurno(s);
}

if (partitaFinita(s)) {
  const vincitore = s.giocatori[s.vincitore];
  console.log(`Vince ${vincitore.nome} dopo ${turni} tiri totali (~${(turni / s.giocatori.length).toFixed(1)} a testa).`);
  console.log('Posizioni finali:', s.giocatori.map(g => `${g.nome}:${g.posizione}`).join('  '));
} else {
  console.log('ATTENZIONE: nessun vincitore dopo', MAX_TURNI, 'tiri — probabile bug.');
}