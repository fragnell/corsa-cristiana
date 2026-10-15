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
//
// Gli audio si preparano (e quindi si scaricano) alla PRIMA chiamata di una
// funzione di questo file, non appena una pagina lo importa. Il motivo: anche
// il telefono importa audio-ui.js (lo tira dentro risposta-ui.js), ma non
// suona mai nulla, e così non scarica nemmeno un byte di audio. Il tabellone
// invece chiama avviaMusica() appena si apre, quindi per lui non cambia nulla.

const CHIAVE_PREFERENZA = 'corsa-cristiana-audio-attivo';

const EFFETTI = {
  dado: 'audio/effetto-dado.mp3',
  imprevisto: 'audio/effetto-imprevisto.mp3',
  salto: 'audio/effetto-salto.mp3',
  fermo: 'audio/effetto-fermo.mp3',
  conoscenza: 'audio/effetto-conoscenza.mp3',
  vittoria: 'audio/effetto-vittoria.mp3',
  corretto: 'audio/effetto-corretto.mp3',
  sbagliato: 'audio/effetto-sbagliato.mp3'
};

const VOLUME_MUSICA = 0.4;

let elementiEffetti = null;
let musica = null;

// Crea gli elementi audio (una volta sola) e li fa scaricare. Tutte le
// funzioni che hanno bisogno della musica o degli effetti la chiamano per
// prima cosa; richiamarla quando e' gia' tutto pronto non fa niente.
function preparaAudio() {
  if (musica) return;
  elementiEffetti = {};
  Object.entries(EFFETTI).forEach(([nome, percorso]) => {
    const el = new Audio(percorso);
    el.preload = 'auto';
    elementiEffetti[nome] = el;
  });
  musica = new Audio('audio/musica-sottofondo.mp3');
  musica.loop = true;
  musica.volume = VOLUME_MUSICA;
}

// COLLABORIAMO! (Salmo 133:1): durante la prova la musica scende, cosi' si
// sente bene la voce di chi descrive. Alla fine torna al volume di sempre.
export function abbassaMusica() {
  preparaAudio();
  musica.volume = VOLUME_MUSICA * 0.25;
}

export function ripristinaMusica() {
  preparaAudio();
  musica.volume = VOLUME_MUSICA;
}

function preferenzaSalvata() {
  const valore = localStorage.getItem(CHIAVE_PREFERENZA);
  return valore === null ? true : valore === 'true'; // di default attiva
}

let statoAudioAttivo = preferenzaSalvata();

export function riproduciEffetto(nome) {
  if (!statoAudioAttivo) return;
  preparaAudio();
  const el = elementiEffetti[nome];
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}

// Ferma e azzera tutti gli effetti in corso — usato prima di un suono
// "importante" (la vittoria) per essere sicuri che non stia ancora
// suonando l'effetto della carta precedente, che su alcuni dispositivi
// può occupare il canale audio e bloccare il nuovo suono.
export function fermaEffetti() {
  if (!elementiEffetti) return; // niente e' mai partito: non c'e' nulla da fermare
  Object.values(elementiEffetti).forEach(el => {
    el.pause();
    el.currentTime = 0;
  });
}

// Da richiamare a ogni gesto vero dell'utente (apertura pagina, poi di
// nuovo su "Inizia partita", poi sull'icona stessa) — innocua se
// richiamata più volte o se la musica sta già suonando.
export function avviaMusica() {
  preparaAudio(); // anche con l'audio spento: cosi' gli effetti sono gia' scaricati se lo si riaccende
  if (statoAudioAttivo) musica.play().catch(() => {});
}

export function fermaMusica() {
  if (musica) musica.pause();
}

export function alternaAudio() {
  preparaAudio();
  statoAudioAttivo = !statoAudioAttivo;
  localStorage.setItem(CHIAVE_PREFERENZA, String(statoAudioAttivo));
  if (statoAudioAttivo) musica.play().catch(() => {});
  else musica.pause();
  return statoAudioAttivo;
}

export function audioAttivo() {
  return statoAudioAttivo;
}