// admin-regole.js
// La scheda "Regole": mostra i valori che oggi vivono solo in config.js,
// e permette di sovrascriverli salvandoli su Firebase. Se non tocchi
// nulla, il gioco continua a usare i valori di sempre.

import { CONFIG, unisciConfig } from './config.js';
import { leggiConfigDaFirebase, salvaConfigDaFirebase, eliminaConfigDaFirebase } from './sincronizzazione.js';

// Il blocco COLLABORIAMO! (Salmo 133:1) si carica "a parte": se non si carica, le
// regole di sempre funzionano lo stesso e salvarle NON cancella quello che il Salmo
// aveva salvato (Firebase sostituisce tutto il blocco "configurazione" in una volta).
let salmoAdmin = null;
let salmoSalvato = null;   // l'ultima sezione "salmo" letta da Firebase

// Le sezioni che questa scheda mostra e salva. Tutte le altre sezioni che si trovassero su
// Firebase (per esempio "dado" o "timeout") restano come sono: salvando le regole non si cancellano.
// "regole" e' nella lista anche se questa scheda non la scrive piu' (il Salto della partita normale non
// si sceglie piu': non scatta mai): cosi' al primo salvataggio i suoi vecchi valori spariscono da Firebase.
const SEZIONI_DELLA_SCHEDA = ['conoscenza', 'imprevisto', 'prova', 'regole', 'giocatori', 'veloce', 'recensioni', 'salmo'];
let configSalvata = {};    // l'ultima configurazione letta da Firebase, tale e quale
let valoriAttuali = unisciConfig(CONFIG, {});   // quella stessa, completata con i valori di base: serve se nella pagina manca un campo

export async function avviaSezioneRegole() {
  try {
    salmoAdmin = await import('./admin-salmo.js');
  } catch (errore) {
    console.warn("Blocco COLLABORIAMO! dell'Admin non disponibile", errore);
    salmoAdmin = null;
  }
  await caricaValoriNelForm();
  document.getElementById('regole-btn-salva').addEventListener('click', salva);
  document.getElementById('regole-btn-ripristina').addEventListener('click', ripristina);
  if (salmoAdmin) {
    try {
      salmoAdmin.collegaBottoniSalmo();
    } catch (errore) {
      console.warn('COLLABORIAMO! Admin: pulsanti non collegati', errore);
    }
  }
}

// ---------- piccoli aiuti per leggere e scrivere i campi ----------
// I campi delle sezioni nuove si trattano con prudenza: se la pagina HTML e' una versione piu'
// vecchia (o piu' nuova) del codice e un campo manca, non succede niente di grave.

function scriviNumero(id, valore) {
  const campo = document.getElementById(id);
  if (campo) campo.value = valore;
}

function scriviSpunta(id, acceso) {
  const campo = document.getElementById(id);
  if (campo) campo.checked = !!acceso;
}

function leggiSpunta(id, predefinito) {
  const campo = document.getElementById(id);
  return campo ? campo.checked : predefinito;
}

// Legge un numero intero da un campo e controlla che stia tra minimo e massimo.
// Restituisce { valore, errore }: se "errore" e' scritto, il numero non va bene.
function leggiIntero(id, predefinito, etichetta, minimo, massimo) {
  const campo = document.getElementById(id);
  if (!campo) return { valore: predefinito, errore: null };
  const testo = campo.value.trim();
  const n = Number(testo);
  if (testo === '' || !Number.isInteger(n) || n < minimo || n > massimo) {
    return { valore: predefinito, errore: `${etichetta}: scrivi un numero intero da ${minimo} a ${massimo}.` };
  }
  return { valore: n, errore: null };
}

// ---------- dal Firebase al modulo ----------

async function caricaValoriNelForm() {
  const override = await leggiConfigDaFirebase();
  configSalvata = override || {};
  const attuale = unisciConfig(CONFIG, override);
  valoriAttuali = attuale;
  salmoSalvato = (override && override.salmo) || null;

  document.getElementById('regole-conoscenza-bonus').value = attuale.conoscenza.bonusRispostaCorretta;
  document.getElementById('regole-conoscenza-malus').value = attuale.conoscenza.malusRispostaErrata;

  document.getElementById('regole-imprevisto-malus').value = attuale.imprevisto.malus;

  document.getElementById('regole-prova-bonus').value = attuale.prova.bonusSuperata;
  document.getElementById('regole-prova-malus').value = attuale.prova.malusFallita;

  scriviNumero('regole-veloce-bonus-conoscenza', attuale.veloce.bonusConoscenza);
  scriviNumero('regole-veloce-bonus-prova', attuale.veloce.bonusProva);
  scriviNumero('regole-veloce-malus-imprevisto', attuale.veloce.malusImprevisto);
  scriviSpunta('regole-veloce-salto-attiva-casella', attuale.veloce.saltoAttivaCasella);

  document.getElementById('regole-giocatori-minimo').value = attuale.giocatori.minimo;
  document.getElementById('regole-giocatori-massimo').value = attuale.giocatori.massimo;

  scriviSpunta('regole-recensioni-attiva', attuale.recensioni.attiva);
  scriviSpunta('regole-recensioni-solo-nuovi', attuale.recensioni.soloNuovi);
  scriviNumero('regole-recensioni-prime-partite', attuale.recensioni.primePartite);
  scriviSpunta('regole-recensioni-con-nome', attuale.recensioni.conNome);

  if (salmoAdmin) {
    try {
      salmoAdmin.riempiFormSalmo(attuale.salmo);
    } catch (errore) {
      console.warn('COLLABORIAMO! Admin: campi non riempiti', errore);
    }
  }
}

// ---------- dal modulo al Firebase ----------

// Le sezioni nuove (partita veloce, recensioni): lettura e controllo dei numeri.
function leggiSezioniNuove() {
  const errori = [];
  const prendi = r => { if (r.errore) errori.push(r.errore); return r.valore; };

  // Se nella pagina manca un campo (pagina vecchia rimasta in memoria nel browser) vale il valore di adesso,
  // cosi' salvare non cambia di nascosto cio' che la pagina non mostra.
  const v = valoriAttuali.veloce;
  const veloce = {
    bonusConoscenza: prendi(leggiIntero('regole-veloce-bonus-conoscenza', v.bonusConoscenza, 'Partita veloce, bonus risposta corretta', 0, 30)),
    bonusProva: prendi(leggiIntero('regole-veloce-bonus-prova', v.bonusProva, 'Partita veloce, bonus prova superata', 0, 30)),
    malusImprevisto: prendi(leggiIntero('regole-veloce-malus-imprevisto', v.malusImprevisto, 'Partita veloce, malus Imprevisto (zero o negativo)', -30, 0)),
    saltoAttivaCasella: leggiSpunta('regole-veloce-salto-attiva-casella', v.saltoAttivaCasella)
  };

  const r = valoriAttuali.recensioni;
  const recensioni = {
    attiva: leggiSpunta('regole-recensioni-attiva', r.attiva),
    soloNuovi: leggiSpunta('regole-recensioni-solo-nuovi', r.soloNuovi),
    primePartite: prendi(leggiIntero('regole-recensioni-prime-partite', r.primePartite, 'Recensioni, quante sono le prime partite', 1, 50)),
    conNome: leggiSpunta('regole-recensioni-con-nome', r.conNome)
  };

  return { veloce, recensioni, errori };
}

// Le sezioni che questa scheda non conosce, cosi' come sono su Firebase in questo momento.
// Se non si riesce a rileggerle si usano quelle lette all'apertura della scheda.
async function sezioniDaConservare() {
  let esistente = configSalvata;
  try {
    esistente = await leggiConfigDaFirebase();
  } catch (errore) {
    console.warn("Regole: non riesco a rileggere la configurazione, uso quella letta all'apertura", errore);
  }
  const resto = {};
  for (const [nome, valore] of Object.entries(esistente || {})) {
    if (!SEZIONI_DELLA_SCHEDA.includes(nome)) resto[nome] = valore;
  }
  return resto;
}

async function salva() {
  const risultato = document.getElementById('regole-risultato');

  const nuove = leggiSezioniNuove();

  const nuovaConfig = {
    conoscenza: {
      bonusRispostaCorretta: Number(document.getElementById('regole-conoscenza-bonus').value),
      malusRispostaErrata: Number(document.getElementById('regole-conoscenza-malus').value)
    },
    imprevisto: {
      malus: Number(document.getElementById('regole-imprevisto-malus').value)
    },
    prova: {
      bonusSuperata: Number(document.getElementById('regole-prova-bonus').value),
      malusFallita: Number(document.getElementById('regole-prova-malus').value)
    },
    giocatori: {
      minimo: Number(document.getElementById('regole-giocatori-minimo').value),
      massimo: Number(document.getElementById('regole-giocatori-massimo').value)
    },
    veloce: nuove.veloce,
    recensioni: nuove.recensioni
  };

  if (nuovaConfig.giocatori.minimo < 1 || nuovaConfig.giocatori.massimo < nuovaConfig.giocatori.minimo) {
    risultato.textContent = '❌ Il minimo deve essere almeno 1, e il massimo non può essere inferiore al minimo.';
    return;
  }

  if (nuove.errori.length > 0) {
    risultato.textContent = '❌ Non ho salvato nulla. ' + nuove.errori.join(' ');
    return;
  }

  // COLLABORIAMO!: la sua sezione va salvata insieme alle altre, altrimenti
  // salvare le regole di sempre la cancellerebbe.
  if (salmoAdmin) {
    let salmo;
    try {
      salmo = salmoAdmin.leggiFormSalmo();
    } catch (errore) {
      console.warn('COLLABORIAMO! Admin: campi illeggibili', errore);
      risultato.textContent = '❌ Il blocco COLLABORIAMO! ha un problema: non ho salvato nulla.';
      return;
    }
    if (salmo.errori.length > 0) {
      risultato.textContent = '❌ Non ho salvato nulla. Controlla COLLABORIAMO!: ' + salmo.errori.join(' ');
      return;
    }
    nuovaConfig.salmo = salmo.valori;
  } else if (salmoSalvato) {
    nuovaConfig.salmo = salmoSalvato;
  }

  try {
    const daConservare = await sezioniDaConservare();
    await salvaConfigDaFirebase({ ...daConservare, ...nuovaConfig });
  } catch (errore) {
    console.warn('Regole: salvataggio non riuscito', errore);
    risultato.textContent = '❌ Non sono riuscito a salvare. Controlla la connessione e di essere entrato con la tua email, poi riprova.';
    return;
  }
  configSalvata = { ...configSalvata, ...nuovaConfig };
  salmoSalvato = nuovaConfig.salmo || null;
  risultato.textContent = '✅ Regole salvate. Valgono dalla prossima partita creata.';
}

async function ripristina() {
  if (!confirm('Tornare ai valori di base scritti nel codice? Le modifiche salvate qui andranno perse.')) return;
  await eliminaConfigDaFirebase();
  await caricaValoriNelForm();
  document.getElementById('regole-risultato').textContent = '↺ Ripristinati i valori di base.';
}
