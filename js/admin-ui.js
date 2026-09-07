// admin-ui.js
// Avvia le tre sezioni del pannello impostazioni. Ognuna vive nel proprio
// file e si occupa solo di sé stessa.

import { avviaSezioneConoscenza } from './admin-conoscenza.js';
import { avviaSezioneImprevisto } from './admin-imprevisto.js';
import { avviaSezioneProva } from './admin-prova.js';

avviaSezioneConoscenza();
avviaSezioneImprevisto();
avviaSezioneProva();