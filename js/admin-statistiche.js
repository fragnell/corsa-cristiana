// admin-statistiche.js
// Scheda "Statistiche": per ogni domanda Conoscenza già uscita almeno
// una volta, mostra quante volte è stata proposta, la percentuale di
// risposte corrette, e per le domande a scelta multipla quale opzione
// sbagliata viene scelta più spesso. Le domande mai uscite compaiono in
// fondo, segnate come tali.

import { ascoltaMazzo, leggiStatisticheDaFirebase, azzeraStatistiche } from './sincronizzazione.js';

let ultimeCarte = [];
let ultimeStatistiche = {};

export function avviaSezioneStatistiche() {
  ascoltaMazzo('conoscenza', (carte) => {
    ultimeCarte = carte;
    disegna();
  });

  caricaStatistiche();

  document.getElementById('statistiche-btn-azzera').addEventListener('click', async () => {
    if (!confirm('Azzerare tutte le statistiche di tutte le domande? Non si può annullare.')) return;
    await azzeraStatistiche();
    await caricaStatistiche();
  });
}

async function caricaStatistiche() {
  ultimeStatistiche = await leggiStatisticheDaFirebase();
  disegna();
}

function disegna() {
  const contenitore = document.getElementById('statistiche-lista');

  const conStat = [];
  const senzaStat = [];

  ultimeCarte.forEach(carta => {
    const stat = ultimeStatistiche[carta._chiave];
    if (stat && stat.proposte > 0) {
      conStat.push({ carta, stat });
    } else {
      senzaStat.push(carta);
    }
  });

  conStat.sort((a, b) => (a.stat.corrette / a.stat.proposte) - (b.stat.corrette / b.stat.proposte));

  const righeConStat = conStat.map(({ carta, stat }) => {
    const percentuale = Math.round((stat.corrette / stat.proposte) * 100);

    let dettaglioOpzioni = '';
    if (carta.tipo === 'scelta' && stat.opzioniSbagliate) {
      const righe = Object.entries(stat.opzioniSbagliate)
        .sort((a, b) => b[1] - a[1])
        .map(([indice, conteggio]) => `<li>${carta.opzioni[indice] || '(opzione rimossa)'}: ${conteggio} volte</li>`)
        .join('');
      dettaglioOpzioni = `<ul class="statistiche-opzioni">${righe}</ul>`;
    }

    return `
      <div class="statistiche-riga">
        <div class="statistiche-domanda">${carta.domanda}</div>
        <div class="statistiche-percentuale ${percentuale < 50 ? 'statistiche-basse' : ''}">${percentuale}% corrette</div>
        <div class="statistiche-dettaglio">${stat.proposte} proposte, ${stat.corrette} corrette, ${stat.errate} errate${stat.correzioniManuali ? `, ${stat.correzioniManuali} accettate manualmente` : ''}</div>
        ${dettaglioOpzioni}
      </div>
    `;
  }).join('');

  const righeSenzaStat = senzaStat.map(carta => `
    <div class="statistiche-riga statistiche-mai-proposta">
      <div class="statistiche-domanda">${carta.domanda}</div>
      <div class="statistiche-percentuale">mai proposta</div>
    </div>
  `).join('');

  contenitore.innerHTML = (righeConStat + righeSenzaStat) || '<p>Nessuna domanda Conoscenza ancora creata.</p>';
}