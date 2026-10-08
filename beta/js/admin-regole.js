// admin-regole.js
// La scheda "Regole": mostra i valori che oggi vivono solo in config.js,
// e permette di sovrascriverli salvandoli su Firebase. Se non tocchi
// nulla, il gioco continua a usare i valori di sempre.

import { CONFIG, unisciConfig } from './config.js';
import { leggiConfigDaFirebase, salvaConfigDaFirebase, eliminaConfigDaFirebase } from './sincronizzazione.js';

export async function avviaSezioneRegole() {
  await caricaValoriNelForm();
  document.getElementById('regole-btn-salva').addEventListener('click', salva);
  document.getElementById('regole-btn-ripristina').addEventListener('click', ripristina);
}

async function caricaValoriNelForm() {
  const override = await leggiConfigDaFirebase();
  const attuale = unisciConfig(CONFIG, override);

  document.getElementById('regole-conoscenza-bonus').value = attuale.conoscenza.bonusRispostaCorretta;
  document.getElementById('regole-conoscenza-malus').value = attuale.conoscenza.malusRispostaErrata;
  document.getElementById('regole-conoscenza-sfida-bonus').value = attuale.conoscenza.sfidaBonusVincitore;
  document.getElementById('regole-conoscenza-sfida-malus').value = attuale.conoscenza.sfidaMalusPerdente;

  document.getElementById('regole-imprevisto-malus').value = attuale.imprevisto.malus;

  document.getElementById('regole-prova-bonus').value = attuale.prova.bonusSuperata;
  document.getElementById('regole-prova-malus').value = attuale.prova.malusFallita;

  document.getElementById('regole-bonus-attiva-casella').checked = attuale.regole.bonusAttivaCasella;
  document.getElementById('regole-salto-attiva-casella').checked = attuale.regole.saltoAttivaCasella;
  document.getElementById('regole-arrivo-libero').checked = attuale.regole.arrivoLibero;

  document.getElementById('regole-giocatori-minimo').value = attuale.giocatori.minimo;
  document.getElementById('regole-giocatori-massimo').value = attuale.giocatori.massimo;
}

async function salva() {
  const risultato = document.getElementById('regole-risultato');

  const nuovaConfig = {
    conoscenza: {
      bonusRispostaCorretta: Number(document.getElementById('regole-conoscenza-bonus').value),
      malusRispostaErrata: Number(document.getElementById('regole-conoscenza-malus').value),
      sfidaBonusVincitore: Number(document.getElementById('regole-conoscenza-sfida-bonus').value),
      sfidaMalusPerdente: Number(document.getElementById('regole-conoscenza-sfida-malus').value)
    },
    imprevisto: {
      malus: Number(document.getElementById('regole-imprevisto-malus').value)
    },
    prova: {
      bonusSuperata: Number(document.getElementById('regole-prova-bonus').value),
      malusFallita: Number(document.getElementById('regole-prova-malus').value)
    },
    regole: {
      bonusAttivaCasella: document.getElementById('regole-bonus-attiva-casella').checked,
      saltoAttivaCasella: document.getElementById('regole-salto-attiva-casella').checked,
      arrivoLibero: document.getElementById('regole-arrivo-libero').checked
    },
    giocatori: {
      minimo: Number(document.getElementById('regole-giocatori-minimo').value),
      massimo: Number(document.getElementById('regole-giocatori-massimo').value)
    }
  };

  if (nuovaConfig.giocatori.minimo < 1 || nuovaConfig.giocatori.massimo < nuovaConfig.giocatori.minimo) {
    risultato.textContent = '❌ Il minimo deve essere almeno 1, e il massimo non può essere inferiore al minimo.';
    return;
  }

  await salvaConfigDaFirebase(nuovaConfig);
  risultato.textContent = '✅ Regole salvate. Valgono dalla prossima partita creata.';
}

async function ripristina() {
  if (!confirm('Tornare ai valori di base scritti nel codice? Le modifiche salvate qui andranno perse.')) return;
  await eliminaConfigDaFirebase();
  await caricaValoriNelForm();
  document.getElementById('regole-risultato').textContent = '↺ Ripristinati i valori di base.';
}