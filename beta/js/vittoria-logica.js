// vittoria-logica.js
// I calcoli della festa di fine partita (vittoria-ui.js), senza pagina: si provano con
// test-vittoria-logica.mjs.

// La classifica finale: prima chi ha vinto, poi gli altri in ordine di casella (piu' avanti = meglio),
// a parita' di casella chi ha risposto giusto a piu' domande Conoscenza. Chi ha lasciato la partita
// non sale sul podio e non compare.
// "posto" segue la regola delle gare: due giocatori sulla stessa casella hanno lo stesso posto
// (1°, 2°, 2°, 4°). Il vincitore e' sempre 1° da solo.
export function classificaFinale(giocatori, vincitoreId) {
  const elenco = (Array.isArray(giocatori) ? giocatori : [])
    .map((g, indice) => ({ g, indice }))
    .filter(({ g }) => g && !g.abbandonato)
    .map(({ g, indice }) => ({
      id: Number.isInteger(g.id) ? g.id : indice,
      nome: typeof g.nome === 'string' && g.nome.trim() ? g.nome.trim() : '?',
      colore: g.colore,
      posizione: Number.isFinite(Number(g.posizione)) ? Number(g.posizione) : 0,
      corrette: Number.isInteger(g.conoscenzaCorrette) && g.conoscenzaCorrette >= 0 ? g.conoscenzaCorrette : 0,
      totali: Number.isInteger(g.conoscenzaTotali) && g.conoscenzaTotali >= 0 ? g.conoscenzaTotali : 0
    }));

  elenco.sort((a, b) => {
    if (a.id === vincitoreId) return -1;
    if (b.id === vincitoreId) return 1;
    if (b.posizione !== a.posizione) return b.posizione - a.posizione;
    if (b.corrette !== a.corrette) return b.corrette - a.corrette;
    return a.nome.localeCompare(b.nome, 'it');
  });

  elenco.forEach((voce, i) => {
    if (i === 0) { voce.posto = 1; return; }
    const prima = elenco[i - 1];
    voce.posto = i > 1 && prima.posizione === voce.posizione ? prima.posto : i + 1;
  });
  return elenco;
}

// Le lettere del nome, una per una, per farle comparire in sequenza. Array.from tiene insieme i
// caratteri "doppi" (lettere accentate composte, molte emoji), cosi' non si spezzano a meta'.
export function lettereNome(nome) {
  return Array.from(String(nome === undefined || nome === null ? '' : nome).trim()).slice(0, 40);
}

// "7 risposte giuste su 9" (o niente, se non ha mai risposto).
export function testoRisposte(corrette, totali) {
  const t = Number(totali);
  const c = Number(corrette);
  if (!Number.isInteger(t) || t <= 0) return '';
  const giuste = Number.isInteger(c) && c >= 0 ? Math.min(c, t) : 0;
  return `✅ ${giuste}/${t} ${t === 1 ? 'risposta' : 'risposte'}`;
}
