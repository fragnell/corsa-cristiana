// risposta-ui.js
// Il giocatore scrive la propria risposta (invece che qualcuno la valuti a
// vista). Il controllo è automatico e tollerante su maiuscole, spazi e
// accenti. Se il controllo sbaglia per un dettaglio di forma, "Correggi"
// rimanda la domanda al giocatore per riprovare.
//
// Oggi questo gira sulla stessa pagina del tabellone, per simulare cosa
// succederà sul telefono del giocatore quando costruiremo i dispositivi
// separati — la logica però è già quella definitiva.

function normalizza(testo) {
  return testo
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // via gli accenti
    .toLowerCase()
    .replace(/['\u2019`.,]/g, '')                       // via apostrofi e punteggiatura comune
    .replace(/\s+/g, ' ')
    .trim();
}

function contaRisposteValide(risposteDate, rispostePossibili) {
  const possibiliNorm = rispostePossibili.map(normalizza);
  const trovate = new Set();
  risposteDate.forEach(r => {
    const idx = possibiliNorm.indexOf(normalizza(r));
    if (idx !== -1) trovate.add(idx); // per indice, così non conta due volte la stessa voce
  });
  return trovate.size;
}

function raccogliRisposta(carta) {
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
        area.classList.add('nascosta');
        risolvi(lista);
      });
      input.focus();

    } else {
      area.innerHTML = `
        <div class="risposta-riga">
          <input type="text" id="risposta-input" placeholder="Scrivi la risposta...">
          <button id="risposta-invia">✅ Invia</button>
        </div>
      `;
      const input = document.getElementById('risposta-input');
      const invia = () => {
        area.classList.add('nascosta');
        risolvi([input.value.trim()]);
      };
      document.getElementById('risposta-invia').addEventListener('click', invia);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') invia(); });
      input.focus();
    }
  });
}

function mostraVerdetto(corretta, risposteDate) {
  return new Promise(risolvi => {
    const area = document.getElementById('verdetto-area');
    area.classList.remove('nascosta');
    area.innerHTML = `
      <p class="verdetto-esito">${corretta ? '✅ Corretto!' : '❌ Non risulta corretto'}</p>
      <p class="verdetto-dettaglio">Risposta data: ${risposteDate.join(', ') || '(vuota)'}</p>
      <button id="verdetto-ok">Va bene, continua</button>
      <button id="verdetto-correggi">✏️ Correggi</button>
    `;
    document.getElementById('verdetto-ok').addEventListener('click', () => {
      area.classList.add('nascosta');
      risolvi(true);
    });
    document.getElementById('verdetto-correggi').addEventListener('click', () => {
      area.classList.add('nascosta');
      risolvi(false);
    });
  });
}

// Chiede la risposta, verifica, mostra l'esito. Se si preme "Correggi" si
// ricomincia da capo. Restituisce true/false: se la risposta finale è giusta.
export async function chiediRispostaEVerifica(carta) {
  while (true) {
    const risposteDate = await raccogliRisposta(carta);

    const corretta = carta.tipo === 'elenco'
      ? contaRisposteValide(risposteDate, carta.rispostePossibili) >= carta.minimoRichiesto
      : normalizza(risposteDate[0] || '') === normalizza(carta.risposta);

    const accettata = await mostraVerdetto(corretta, risposteDate);
    if (accettata) return corretta;
  }
}