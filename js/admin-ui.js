// admin-ui.js
// Avvia le sezioni del pannello impostazioni, solo dopo aver chiesto la
// password — questa pagina non deve essere aperta da chiunque trovi
// l'indirizzo.

import { chiediPassword } from './accesso.js';
import { avviaSezioneImporta } from './admin-importa.js';
import { avviaSezioneConoscenza } from './admin-conoscenza.js';
import { avviaSezioneImprevisto } from './admin-imprevisto.js';
import { avviaSezioneProva } from './admin-prova.js';

const autorizzato = chiediPassword('Questa pagina è riservata a chi gestisce le domande.\nInserisci la password:');

if (autorizzato) {
  avviaSezioneImporta();
  avviaSezioneConoscenza();
  avviaSezioneImprevisto();
  avviaSezioneProva();
} else {
  document.body.innerHTML = '<h1>Accesso negato</h1><p>Password non corretta.</p>';
}