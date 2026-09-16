// audio-ui.js
// Musica di sottofondo ed effetti sonori del tabellone. Il telefono non
// ha mai audio, solo il tabellone. La preferenza attivo/disattivo si
// ricorda nel browser (localStorage), così vale anche dopo "Gioca
// un'altra partita" (che ricarica la pagina da zero).
//
// I browser bloccano l'audio con suono finché non c'è un vero gesto
// dell'utente sulla pagina — per questo avviaMusica() viene chiamata
// più di una volta (all'apertura, e di nuovo su "Inizia partita"): se
// un tentativo viene bloccato in silenzio, il successivo lo sblocca.
// Richiamarla quando la musica sta già suonando non ha alcun effetto
// negativo.

const CHIAVE_PREFERENZA = 'corsa-cristiana-audio-attivo';

const EFFETTI = {
  dado: 'audio/effetto-dado.mp3',
  imprevisto: 'audio/effetto-imprevisto.mp3',
  salto: 'audio/effetto-salto.mp3',
  fermo: 'audio/effetto-fermo.mp3',
  conoscenza: 'audio/effetto-conoscenza.mp3',
  vittoria: 'audio/effetto-vittoria.mp3'
};

const elementiEffetti = {};
Object.entries(EFFETTI).forEach(([nome, percorso]) => {
  const el = new Audio(percorso);
  el.preload = 'auto';
  elementiEffetti[nome] = el;
});

const musica = new Audio('audio/musica-sottofondo.mp3');
musica.loop = true;
musica.volume = 0.4;

function preferenzaSalvata() {
  const valore = localStorage.getItem(CHIAVE_PREFERENZA);
  return valore === null ? true : valore === 'true'; // di default attiva
}

let statoAudioAttivo = preferenzaSalvata();

export function riproduciEffetto(nome) {
  if (!statoAudioAttivo) return;
  const el = elementiEffetti[nome];
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {}); // se il browser blocca anche questo, non è un errore grave da segnalare
}

// Da richiamare a ogni gesto vero dell'utente (apertura pagina, poi di
// nuovo su "Inizia partita", poi sull'icona stessa) — innocua se
// richiamata più volte o se la musica sta già suonando.
export function avviaMusica() {
  if (statoAudioAttivo) musica.play().catch(() => {});
}

export function fermaMusica() {
  musica.pause();
}

export function alternaAudio() {
  statoAudioAttivo = !statoAudioAttivo;
  localStorage.setItem(CHIAVE_PREFERENZA, String(statoAudioAttivo));
  if (statoAudioAttivo) musica.play().catch(() => {});
  else musica.pause();
  return statoAudioAttivo;
}

export function audioAttivo() {
  return statoAudioAttivo;
}