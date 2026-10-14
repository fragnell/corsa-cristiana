// admin-salmo.js
// Il blocco COLLABORIAMO! (Salmo 133:1) della scheda "Regole" del pannello Admin:
// riempie i campi, li legge e li controlla, e collega i due pulsanti
// "valori per provare" e "valori di base".
// I controlli veri (limiti, secondi/millisecondi, valori di prova) stanno in
// salmo/admin-valori.js, che non conosce la pagina.

import { CONFIG } from './config.js';
import {
  RIQUADRI_CONSIGLIATI, campiDaConfig, configDaCampi, conValoriDiProva, sembranoValoriDiProva
} from './salmo/admin-valori.js';

// Nome del campo -> [id nella pagina, tipo]. Il tipo e' 'numero' (se non scritto),
// 'spunta' (casella da spuntare) oppure 'elenco' (menu a tendina dei riquadri).
const CAMPI = {
  attivo: ['regole-salmo-attivo', 'spunta'],
  giocatoriMinimi: ['regole-salmo-giocatori-minimi'],
  distacco4: ['regole-salmo-distacco-4'],
  distacco6: ['regole-salmo-distacco-6'],
  distacco8: ['regole-salmo-distacco-8'],
  distacco10: ['regole-salmo-distacco-10'],
  distacco12: ['regole-salmo-distacco-12'],
  primoMassimo: ['regole-salmo-primo-massimo'],
  giriDiPausa: ['regole-salmo-giri-pausa'],
  maxPerPartita: ['regole-salmo-max-partita'],
  bonusUltimo: ['regole-salmo-bonus'],
  malusPrimo: ['regole-salmo-malus'],
  ultimoSaltaSeFallisce: ['regole-salmo-salta-fallisce', 'spunta'],
  ultimoTiraDopoSuccesso: ['regole-salmo-tira-successo', 'spunta'],
  tentativi: ['regole-salmo-tentativi'],
  prontoS: ['regole-salmo-pronto'],
  sbirciataS: ['regole-salmo-sbirciata'],
  esitoS: ['regole-salmo-esito'],
  normaleRiquadri: ['regole-salmo-normale-riquadri', 'elenco'],
  normaleProvaS: ['regole-salmo-normale-prova'],
  normaleAnteprimaS: ['regole-salmo-normale-anteprima'],
  bambiniRiquadri: ['regole-salmo-bambini-riquadri', 'elenco'],
  bambiniProvaS: ['regole-salmo-bambini-prova'],
  bambiniAnteprimaS: ['regole-salmo-bambini-anteprima']
};

const TESTO_AVVISO = '⚠️ Qui ci sono i valori PER PROVARE: COLLABORIAMO! scatterebbe con pochi giocatori e con pochissime caselle di distacco. ' +
  'Per una serata vera premi «Valori di base di COLLABORIAMO!» e poi «Salva regole».';

function elemento(id) {
  return document.getElementById(id);
}

// Il menu dei riquadri contiene i numeri che riempiono bene una griglia; se nella
// configurazione c'e' un numero diverso, lo aggiunge (cosi' non si perde in silenzio).
function preparaElenco(menu, valore) {
  const proposti = [...RIQUADRI_CONSIGLIATI];
  const numero = Number(valore);
  if (Number.isInteger(numero) && !proposti.includes(numero)) proposti.push(numero);
  proposti.sort((a, b) => a - b);
  menu.textContent = '';
  for (const n of proposti) {
    const voce = document.createElement('option');
    voce.value = String(n);
    voce.textContent = String(n);
    menu.appendChild(voce);
  }
}

// Scrive i campi nella pagina (quelli che nella pagina non ci sono si saltano).
function scriviCampi(campi) {
  for (const [nome, [id, tipo]] of Object.entries(CAMPI)) {
    const el = elemento(id);
    if (!el || !(nome in campi)) continue;
    if (tipo === 'spunta') {
      el.checked = campi[nome] === true;
    } else {
      if (tipo === 'elenco') preparaElenco(el, campi[nome]);
      el.value = String(campi[nome]);
    }
  }
}

// Legge i campi dalla pagina, cosi' come sono scritti (ancora da controllare).
export function leggiCampiSalmo() {
  const campi = {};
  for (const [nome, [id, tipo]] of Object.entries(CAMPI)) {
    const el = elemento(id);
    if (!el) continue;
    campi[nome] = tipo === 'spunta' ? el.checked : el.value;
  }
  return campi;
}

// Mostra o nasconde l'avviso "sono valori per provare".
function aggiornaAvviso() {
  const avviso = elemento('regole-salmo-avviso');
  if (!avviso) return;
  const daProvare = sembranoValoriDiProva(leggiCampiSalmo());
  avviso.textContent = daProvare ? TESTO_AVVISO : '';
  avviso.classList.toggle('nascosta', !daProvare);
}

// Riempie il blocco con la configurazione del Salmo (gia' unita ai valori di base).
export function riempiFormSalmo(salmo) {
  scriviCampi(campiDaConfig(salmo));
  aggiornaAvviso();
}

// Legge e controlla il blocco: { valori, errori }. Se errori non e' vuoto non si salva.
export function leggiFormSalmo() {
  return configDaCampi(leggiCampiSalmo());
}

function messaggio(testo) {
  const risultato = elemento('regole-risultato');
  if (risultato) risultato.textContent = testo;
}

// Collega i due pulsanti e l'avviso. Da chiamare una volta sola, a pagina pronta.
export function collegaBottoniSalmo() {
  const prova = elemento('regole-salmo-btn-prova');
  const base = elemento('regole-salmo-btn-base');
  const blocco = elemento('regole-salmo');

  if (prova) {
    prova.addEventListener('click', () => {
      scriviCampi(conValoriDiProva(leggiCampiSalmo()));
      aggiornaAvviso();
      messaggio('🧪 Valori per provare inseriti nei campi. Premi «Salva regole» per renderli validi.');
    });
  }
  if (base) {
    base.addEventListener('click', () => {
      scriviCampi(campiDaConfig(CONFIG.salmo));
      aggiornaAvviso();
      messaggio('↺ Valori di base di COLLABORIAMO! inseriti nei campi. Premi «Salva regole» per salvarli.');
    });
  }
  if (blocco) {
    blocco.addEventListener('input', aggiornaAvviso);
    blocco.addEventListener('change', aggiornaAvviso);
  }
}
