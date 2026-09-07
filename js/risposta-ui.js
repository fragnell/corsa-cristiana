// risposta-ui.js
// Raccoglie la risposta scritta o scelta dal giocatore, la verifica in
// modo automatico, e mostra il verdetto con un conto alla rovescia di 10
// secondi — se è sbagliata, anche la risposta corretta. Non decide da
// sola quando mostrare o nascondere la carta: quello lo coordina chi la
// usa (tabellone-ui.js), perché la carta deve restare visibile mentre il
// giocatore risponde.
//
// Tre tipi di domanda: "diretta" (una risposta scritta), "elenco" (più
// risposte scritte, con un minimo richiesto), "scelta" (si tocca una
// delle opzioni proposte, poi si conferma).

function normalizza(testo) {
  return testo
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019`.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PAROLE_IGNORATE = new Set(['il','lo','la','i','gli','le','un','uno','una','di','del','della','dei','e','a','ai','al']);

function paroleSignificative(testo) {
  return normalizza(testo).split(' ').filter(p => p.length > 0 && !PAROLE_IGNORATE.has(p));
}

function risposteCorrispondono(risposta, atteso) {
  const paroleR = paroleSignificative(risposta);
  const paroleA = paroleSignificative(atteso);
  if (paroleR.length === 0) return false;
  return paroleR.every(p => paroleA.includes(p)) || paroleA.every(p => paroleR.includes(p));
}

export function valutaRisposta(carta, risposteDate) {
  if (carta.tipo === 'elenco') {
    const trovate = new Set();
    risposteDate.forEach(r => {
      carta.rispostePossibili.forEach((atteso, idx) => {
        if (risposteCorrispondono(r, atteso)) trovate.add(idx);
      });
    });
    return trovate.size >= carta.minimoRichiesto;
  }
  if (carta.tipo === 'scelta') {
    // qui non serve tolleranza: il giocatore ha toccato esattamente una
    // delle opzioni proposte, il confronto è sempre alla lettera.
    return risposteDate[0] === carta.rispostaCorretta;
  }
  return normalizza(risposteDate[0] || '') === normalizza(carta.risposta);
}

export function raccogliRisposta(carta) {
  return new Promise(risolvi => {
    const area = document.getElementById('risposta-area');
    area.classList.remove('nascosta');

    if (carta.tipo === 'elenco') {
      area.innerHTML = `
        <p>Scrivi una risposta alla volta e premi "Aggiungi".<br>Servono almeno ${carta.minimoRichiesto} risposte diverse.</p>
        <div id="risposta-elenco-lista"></div>
        <div class="risposta-riga">
          <input type="text" id="risposta-input" placeholder="Scrivi qui...">
          <button id="risposta-aggiungi">➕ Aggiungi</button>
        </div>
        <p id="risposta-elenco-messaggio"></p>
        <button id="risposta-conferma">✅ Conferma</button>
      `;
      const lista = [];
      const listaEl = document.getElementById('risposta-elenco-lista');
      const input = document.getElementById('risposta-input');
      const aggiorna = () => { listaEl.innerHTML = lista.map(r => `<div>• ${r}</div>`).join(''); };
      const aggiungi = () => {
        const valore = input.value.trim();
        if (valore) { lista.push(valore); input.value = ''; aggiorna(); }
        input.focus();
      };
      document.getElementById('risposta-aggiungi').addEventListener('click', aggiungi);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') aggiungi(); });
      document.getElementById('risposta-conferma').addEventListener('click', () => {
        if (lista.length === 0) {
          document.getElementById('risposta-elenco-messaggio').textContent = 'Aggiungi almeno una risposta prima di confermare.';
          return;
        }
        area.classList.add('nascosta');
        risolvi(lista);
      });
      input.focus();

    } else if (carta.tipo === 'scelta') {
      area.innerHTML = `
        <div id="risposta-scelta-opzioni"></div>
        <button id="risposta-conferma-scelta" disabled>✅ Conferma</button>
      `;
      const contenitoreOpzioni = document.getElementById('risposta-scelta-opzioni');
      const bottoneConferma = document.getElementById('risposta-conferma-scelta');
      let opzioneScelta = null;

      carta.opzioni.forEach(opzione => {
        const bottone = document.createElement('button');
        bottone.type = 'button';
        bottone.className = 'risposta-opzione';
        bottone.textContent = opzione;
        bottone.addEventListener('click', () => {
          contenitoreOpzioni.querySelectorAll('.risposta-opzione').forEach(b => b.classList.remove('selezionata'));
          bottone.classList.add('selezionata');
          opzioneScelta = opzione;
          bottoneConferma.disabled = false;
        });
        contenitoreOpzioni.appendChild(bottone);
      });

      bottoneConferma.addEventListener('click', () => {
        area.classList.add('nascosta');
        risolvi([opzioneScelta]);
      });

    } else {
      area.innerHTML = `
        <div class="risposta-riga">
          <input type="text" id="risposta-input" placeholder="Scrivi la risposta...">
          <button id="risposta-invia">✅ Invia</button>
        </div>
      `;
      const input = document.getElementById('risposta-input');
      const invia = () => {
        if (!input.value.trim()) { input.focus(); return; }
        area.classList.add('nascosta');
        risolvi([input.value.trim()]);
      };
      document.getElementById('risposta-invia').addEventListener('click', invia);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') invia(); });
      input.focus();
    }
  });
}

const DURATA_COUNTDOWN_S = 10;

export function mostraVerdetto(carta, corretta, risposteDate) {
  return new Promise(risolvi => {
    const area = document.getElementById('verdetto-area');
    area.classList.remove('nascosta');

    let secondiRimasti = DURATA_COUNTDOWN_S;

    let rigaRispostaGiusta = '';
    if (!corretta) {
      let rispostaGiusta;
      if (carta.tipo === 'elenco') {
        rispostaGiusta = carta.rispostePossibili.join(', ');
      } else if (carta.tipo === 'scelta') {
        rispostaGiusta = carta.rispostaCorretta;
      } else {
        rispostaGiusta = carta.risposta;
      }
      rigaRispostaGiusta = `<p class="verdetto-risposta-giusta">Risposta corretta: ${rispostaGiusta}</p>`;
    }

    area.innerHTML = `
      <p class="verdetto-esito">${corretta ? '✅ Corretto!' : '❌ Non risulta corretto'}</p>
      <p class="verdetto-dettaglio">Risposta data: ${risposteDate.join(', ') || '(vuota)'}</p>
      ${rigaRispostaGiusta}
      <p class="verdetto-countdown">Si chiude tra <span id="verdetto-conto">${secondiRimasti}</span>s</p>
      <button id="verdetto-ok">✅ OK</button>
      <button id="verdetto-correggi">✏️ Correggi</button>
    `;

    let concluso = false;
    const concludi = risultato => {
      if (concluso) return;
      concluso = true;
      clearInterval(timer);
      area.classList.add('nascosta');
      risolvi(risultato);
    };

    const timer = setInterval(() => {
      secondiRimasti--;
      const conto = document.getElementById('verdetto-conto');
      if (conto) conto.textContent = secondiRimasti;
      if (secondiRimasti <= 0) concludi(true);
    }, 1000);

    document.getElementById('verdetto-ok').addEventListener('click', () => concludi(true));
    document.getElementById('verdetto-correggi').addEventListener('click', () => concludi(false));
  });
}