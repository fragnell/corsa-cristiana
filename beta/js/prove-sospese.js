// prove-sospese.js
// Le prove "in sospeso" degli ALTRI giocatori, da mostrare sul telefono: sul tabellone non c'e' piu'
// il riquadro "In sospeso" (resta solo una ⏳ sulla pedina), e chi deve controllare che la prova venga
// rispettata (per esempio "resta con gli occhi chiusi finche' non torna il tuo turno") sono gli altri.
// La propria prova il telefono la mostra gia' a parte (riquadro "Prova in corso").
//
// Solo logica, niente pagina: si prova con test-prove-sospese.mjs.

// Restituisce [{ nome, testo }] nell'ordine dei giocatori; mai un errore, anche con uno stato strano.
export function proveSospeseDegliAltri(stato, mioId) {
  const giocatori = stato && Array.isArray(stato.giocatori) ? stato.giocatori : [];
  const elenco = [];
  giocatori.forEach((g, indice) => {
    if (!g || indice === mioId || g.abbandonato) return;
    const prova = g.provaInSospeso;
    if (!prova || typeof prova !== 'object') return;
    const testo = typeof prova.testo === 'string' ? prova.testo.trim() : '';
    elenco.push({ nome: typeof g.nome === 'string' ? g.nome : '?', testo });
  });
  return elenco;
}
