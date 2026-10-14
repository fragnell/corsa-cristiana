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
import { avviaSezioneStatistiche } from './admin-statistiche.js';

// Le schede del pannello: per ognuna c'e' un pulsante "tab-btn-<nome>" e un riquadro "tab-<nome>".
const SCHEDE = ['carte', 'regole', 'statistiche', 'recensioni'];

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
    avviaSezioneStatistiche();

    for (const nome of SCHEDE) {
      const bottone = document.getElementById(`tab-btn-${nome}`);
      if (bottone) bottone.addEventListener('click', () => mostraTab(nome));
    }

  } else {
    document.body.innerHTML =
      '<h1>Accesso negato</h1><p>Password non corretta.</p>';
  }
}

function mostraTab(nome) {
  for (const scheda of SCHEDE) {
    const riquadro = document.getElementById(`tab-${scheda}`);
    if (riquadro) riquadro.classList.toggle('nascosta', nome !== scheda);

    const bottone = document.getElementById(`tab-btn-${scheda}`);
    if (bottone) bottone.classList.toggle('admin-tab-attiva', nome === scheda);
  }

  if (nome === 'recensioni') avviaRecensioniUnaVolta();
}

// La scheda Recensioni si carica "a parte", la prima volta che la si apre: se qualcosa non va,
// il resto del pannello funziona come sempre e qui compare solo un avviso.
let recensioniAvviate = false;

function avviaRecensioniUnaVolta() {
  if (recensioniAvviate) return;
  recensioniAvviate = true;

  import('./admin-recensioni.js').then(
    modulo => {
      try {
        modulo.avviaSezioneRecensioni();
      } catch (errore) {
        mostraProblemaRecensioni(errore);
      }
    },
    errore => {
      recensioniAvviate = false;   // riaprendo la scheda si puo' riprovare
      mostraProblemaRecensioni(errore);
    }
  );
}

function mostraProblemaRecensioni(errore) {
  console.warn('La scheda Recensioni non si è avviata', errore);
  const avviso = document.getElementById('recensioni-avviso');
  if (!avviso) return;
  avviso.textContent = '⚠️ La scheda Recensioni non si è caricata. Ricarica la pagina con Ctrl+F5; se resta così, il resto del pannello funziona lo stesso.';
  avviso.classList.remove('nascosta');
}

avvia();
