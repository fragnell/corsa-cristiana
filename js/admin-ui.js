// admin-ui.js
// Avvia le sezioni del pannello impostazioni, solo dopo aver chiesto la
// password — questa pagina non deve essere aperta da chiunque trovi
// l'indirizzo.

import { chiediPassword } from './accesso.js';
import { avviaSezioneImporta } from './admin-importa.js';
import { avviaSezioneConoscenza } from './admin-conoscenza.js';
import { avviaSezioneImprevisto } from './admin-imprevisto.js';
import { avviaSezioneProva } from './admin-prova.js';
import { avviaSezioneRegole } from './admin-regole.js';

async function avvia() {
  const autorizzato = await chiediPassword(
    'Questa pagina è riservata a chi gestisce le domande.\nInserisci la password:'
  );

  if (autorizzato) {
    avviaSezioneImporta();
    avviaSezioneConoscenza();
    avviaSezioneImprevisto();
    avviaSezioneProva();
    avviaSezioneRegole();

    document.getElementById('tab-btn-carte').addEventListener('click', () => {
      mostraTab('carte');
    });

    document.getElementById('tab-btn-regole').addEventListener('click', () => {
      mostraTab('regole');
    });

  } else {
    document.body.innerHTML =
      '<h1>Accesso negato</h1><p>Password non corretta.</p>';
  }
}

function mostraTab(nome) {
  document
    .getElementById('tab-carte')
    .classList.toggle('nascosta', nome !== 'carte');

  document
    .getElementById('tab-regole')
    .classList.toggle('nascosta', nome !== 'regole');

  document
    .getElementById('tab-btn-carte')
    .classList.toggle('admin-tab-attiva', nome === 'carte');

  document
    .getElementById('tab-btn-regole')
    .classList.toggle('admin-tab-attiva', nome === 'regole');
}

avvia();