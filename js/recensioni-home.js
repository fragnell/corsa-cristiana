// recensioni-home.js
// "Alcune recensioni" nella pagina principale: le recensioni che l'amministratore ha messo in
// evidenza (stellina nella scheda Recensioni dell'Admin) scorrono piano in un nastro, con le
// stelline, il commento, la firma e la data.
//
// Si carica "a parte" da index-ui.js, dopo che la pagina e' gia' pronta: se Firebase non risponde o
// non c'e' nessuna recensione in evidenza, la sezione resta semplicemente nascosta.
// Tutto il testo arriva dai telefoni dei giocatori: entra SEMPRE come testo semplice (textContent).

import { leggiRecensioniInEvidenza } from './sincronizzazione.js';
import { elencoPerHome, dataBreve, stelline } from './recensioni-evidenza.js';

// Sotto questo numero le schede stanno ferme (non c'e' niente da far scorrere).
const MINIMO_PER_SCORRERE = 2;
// Velocita' del nastro: secondi per ogni scheda.
const SECONDI_PER_SCHEDA = 7;

function crea(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo !== undefined) el.textContent = testo;
  return el;
}

function creaScheda(r, copia) {
  const scheda = crea('figure', r.commento ? 'recensione-home' : 'recensione-home recensione-home-solo-voto');
  if (copia) scheda.setAttribute('aria-hidden', 'true');   // la seconda copia serve solo a far girare il nastro
  scheda.appendChild(crea('div', 'recensione-home-stelle', stelline(r.stelle)));
  if (r.commento) scheda.appendChild(crea('blockquote', 'recensione-home-testo', `“${r.commento}”`));
  const piede = crea('figcaption', 'recensione-home-piede');
  piede.appendChild(crea('span', 'recensione-home-nome', r.nome ? `— ${r.nome}` : '— Un giocatore'));
  const data = dataBreve(r.creataIl);
  if (data) piede.appendChild(crea('span', 'recensione-home-data', data));
  scheda.appendChild(piede);
  return scheda;
}

export async function avviaRecensioniHome() {
  const sezione = document.getElementById('recensioni-home');
  const nastro = document.getElementById('recensioni-home-nastro');
  if (!sezione || !nastro) return;

  let elenco = [];
  try {
    elenco = elencoPerHome(await leggiRecensioniInEvidenza());
  } catch (errore) {
    console.warn('Recensioni in home non disponibili (la pagina funziona lo stesso)', errore);
    return;
  }
  disegnaRecensioniHome(elenco);
}

// Disegna il nastro con un elenco gia' pronto (vedi elencoPerHome). Elenco vuoto: sezione nascosta.
export function disegnaRecensioniHome(elenco) {
  const sezione = document.getElementById('recensioni-home');
  const nastro = document.getElementById('recensioni-home-nastro');
  if (!sezione || !nastro) return;
  nastro.textContent = '';
  nastro.classList.remove('recensioni-home-scorre');
  if (!Array.isArray(elenco) || elenco.length === 0) { sezione.classList.add('nascosta'); return; }

  elenco.forEach(r => nastro.appendChild(creaScheda(r, false)));
  if (elenco.length >= MINIMO_PER_SCORRERE) {
    // Il nastro contiene due volte le stesse schede: quando la prima meta' e' passata tutta,
    // l'animazione ricomincia da capo e non si vede nessuno "scatto".
    elenco.forEach(r => nastro.appendChild(creaScheda(r, true)));
    nastro.style.setProperty('--durata-nastro', `${elenco.length * SECONDI_PER_SCHEDA}s`);
    nastro.classList.add('recensioni-home-scorre');
  }
  sezione.classList.remove('nascosta');
}
