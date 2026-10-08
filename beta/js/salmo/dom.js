// dom.js
// Salmo 133:1 — piccoli attrezzi per costruire pezzi di pagina.
// Il testo dei giocatori (i nomi) entra SEMPRE come testo semplice
// (textContent), mai come HTML: cosi' un nome strano non puo' rompere la pagina.

export function crea(tag, classe, testo) {
  const nodo = document.createElement(tag);
  if (classe) nodo.className = classe;
  if (testo !== undefined && testo !== null) nodo.textContent = String(testo);
  return nodo;
}

export function svuota(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
}

// Carica il foglio di stile della prova una volta sola. E' il modulo stesso a
// chiederlo: le pagine del gioco (tabellone.html, giocatore.html) non devono
// sapere nulla della prova.
export function caricaStile() {
  if (document.getElementById('salmo-stile')) return;
  const link = document.createElement('link');
  link.id = 'salmo-stile';
  link.rel = 'stylesheet';
  link.href = 'css/salmo.css';
  document.head.appendChild(link);
}

// Nella copia BETA del gioco c'e' una targhetta rossa in alto a sinistra: sul
// telefono la schermata lascia un po' di spazio, cosi' non copre il titolo.
export function segnaBeta(schermata) {
  try {
    if (document.querySelector('.etichetta-beta')) schermata.classList.add('salmo-con-beta');
  } catch (errore) { /* pazienza: al massimo la targhetta copre un pezzetto di titolo */ }
}

// Secondi interi rimasti (arrotondati per eccesso: "1" fino all'ultimo istante).
export function secondiRimasti(scadenza, adesso) {
  const s = Math.ceil((Number(scadenza) - Number(adesso)) / 1000);
  return Number.isFinite(s) ? Math.max(0, s) : 0;
}

// Un conto alla rovescia: ogni 250 ms chiama scrivi(secondiRimasti). Quando la
// scadenza arriva, chiama (una volta sola) allaFine. Restituisce la funzione
// per fermarlo.
export function avviaConto(scrivi, scadenza, adesso, allaFine) {
  let fermo = false;
  let finito = false;
  const passo = () => {
    if (fermo) return;
    scrivi(secondiRimasti(scadenza, adesso()));
    if (!finito && adesso() >= scadenza) {
      finito = true;
      if (allaFine) allaFine();
    }
  };
  passo();
  const timer = setInterval(passo, 250);
  return () => { fermo = true; clearInterval(timer); };
}

export function pausa(ms) {
  return new Promise(risolvi => setTimeout(risolvi, ms));
}

// sessionStorage puo' non esserci (navigazione privata, blocchi): mai un errore.
export function memoriaLeggi(chiave) {
  try { return window.sessionStorage.getItem(chiave); } catch (errore) { return null; }
}
export function memoriaScrivi(chiave, valore) {
  try { window.sessionStorage.setItem(chiave, valore); } catch (errore) { /* pazienza */ }
}
