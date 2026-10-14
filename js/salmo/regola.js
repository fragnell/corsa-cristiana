// regola.js
// Salmo 133:1 — QUANDO scatta la prova. Solo funzioni pure: ricevono lo
// stato della partita e la configurazione, restituiscono una risposta.
// Non toccano Firebase, non toccano la pagina, non usano il caso: con gli
// stessi numeri in ingresso la risposta e' sempre la stessa.
//
// "Ultimo" = chi in questo momento e' piu' indietro (ed e' il suo turno).
// "Primo"  = chi in questo momento e' piu' avanti.

import { CONFIG } from '../config.js';

// ---------- Configurazione "a prova di valori strani" ----------

function numeroOppure(valore, difetto) {
  const n = Number(valore);
  return Number.isFinite(n) ? n : difetto;
}

function interoPositivoOppure(valore, difetto) {
  const n = Math.floor(numeroOppure(valore, difetto));
  return n >= 1 ? n : difetto;
}

function boolOppure(valore, difetto) {
  return typeof valore === 'boolean' ? valore : difetto;
}

function sicuroLivello(livello, base) {
  const l = livello || {};
  return {
    riquadri: interoPositivoOppure(l.riquadri, base.riquadri),
    provaMs: interoPositivoOppure(l.provaMs, base.provaMs),
    anteprimaMs: interoPositivoOppure(l.anteprimaMs, base.anteprimaMs)
  };
}

// Prende la configurazione salvata (che potrebbe avere campi mancanti o
// scritti male) e restituisce una copia in cui ogni valore e' valido:
// quello che non va torna al valore di base di config.js.
export function configSalmoSicura(grezza, base = CONFIG.salmo) {
  const g = grezza || {};
  const d = g.distacchi || {};
  const livelli = g.livelli || {};
  const malus = numeroOppure(g.malusPrimo, base.malusPrimo);

  return {
    attivo: boolOppure(g.attivo, base.attivo),
    giocatoriMinimi: interoPositivoOppure(g.giocatoriMinimi, base.giocatoriMinimi),
    distacchi: {
      finoA4: interoPositivoOppure(d.finoA4, base.distacchi.finoA4),
      finoA6: interoPositivoOppure(d.finoA6, base.distacchi.finoA6),
      finoA8: interoPositivoOppure(d.finoA8, base.distacchi.finoA8),
      finoA10: interoPositivoOppure(d.finoA10, base.distacchi.finoA10),
      finoA12: interoPositivoOppure(d.finoA12, base.distacchi.finoA12)
    },
    primoMassimo: interoPositivoOppure(g.primoMassimo, base.primoMassimo),
    giriDiPausa: Math.max(0, Math.floor(numeroOppure(g.giriDiPausa, base.giriDiPausa))),
    maxPerPartita: Math.max(0, Math.floor(numeroOppure(g.maxPerPartita, base.maxPerPartita))),
    bonusUltimo: Math.max(0, Math.floor(numeroOppure(g.bonusUltimo, base.bonusUltimo))),
    malusPrimo: malus > 0 ? -malus : Math.floor(malus),   // il malus e' sempre negativo (o zero)
    ultimoSaltaSeFallisce: boolOppure(g.ultimoSaltaSeFallisce, base.ultimoSaltaSeFallisce),
    ultimoTiraDopoSuccesso: boolOppure(g.ultimoTiraDopoSuccesso, base.ultimoTiraDopoSuccesso),
    tentativi: interoPositivoOppure(g.tentativi, base.tentativi),
    prontoMs: interoPositivoOppure(g.prontoMs, base.prontoMs),
    sbirciataMs: interoPositivoOppure(g.sbirciataMs, base.sbirciataMs),
    esitoMs: interoPositivoOppure(g.esitoMs, base.esitoMs),
    livelli: {
      bambini: sicuroLivello(livelli.bambini, base.livelli.bambini),
      normale: sicuroLivello(livelli.normale, base.livelli.normale)
    }
  };
}

// ---------- Chi gioca, chi e' primo, chi e' ultimo ----------

// Chi e' ancora in partita (chi ha abbandonato non conta mai).
export function giocatoriAttivi(stato) {
  return stato.giocatori.filter(g => !g.abbandonato);
}

// Il primo e' chi ha la posizione piu' alta; a parita' vince l'ordine dei
// giocatori (cioe' il primo della lista tra quelli a pari merito).
export function trovaPrimo(attivi) {
  let primo = attivi[0];
  for (const g of attivi) {
    if (g.posizione > primo.posizione) primo = g;
  }
  return primo;
}

// Il distacco richiesto cresce col numero di giocatori: con tanti giocatori
// il tavolo gira piu' lentamente, quindi serve un distacco maggiore.
export function distaccoRichiesto(nGiocatori, cfg) {
  const d = cfg.distacchi;
  if (nGiocatori <= 4) return d.finoA4;
  if (nGiocatori <= 6) return d.finoA6;
  if (nGiocatori <= 8) return d.finoA8;
  if (nGiocatori <= 10) return d.finoA10;
  return d.finoA12;
}

// Se uno dei due e' junior, la prova e' a livello bambini.
export function livelloPerCoppia(primo, ultimo) {
  return (primo.junior || ultimo.junior) ? 'bambini' : 'normale';
}

// ---------- I contatori della partita (vivono dentro lo stato) ----------

// stato.salmo = { avviati, turni, ultimoAvvio }
//   avviati     quante prove sono partite in questa partita (anche se poi annullate)
//   turni       quanti passaggi di turno ci sono stati finora
//   ultimoAvvio il valore di "turni" quando e' partita l'ultima prova (assente se mai)
export function leggiContatori(stato) {
  const s = (stato && stato.salmo) || {};
  return {
    avviati: Math.max(0, Math.floor(numeroOppure(s.avviati, 0))),
    turni: Math.max(0, Math.floor(numeroOppure(s.turni, 0))),
    ultimoAvvio: Number.isFinite(s.ultimoAvvio) ? s.ultimoAvvio : null
  };
}

export function contatoriDopoTurno(stato) {
  const c = leggiContatori(stato);
  const nuovo = { avviati: c.avviati, turni: c.turni + 1 };
  if (c.ultimoAvvio !== null) nuovo.ultimoAvvio = c.ultimoAvvio;
  return nuovo;
}

export function contatoriDopoAvvio(stato) {
  const c = leggiContatori(stato);
  return { avviati: c.avviati + 1, turni: c.turni, ultimoAvvio: c.turni };
}

// ---------- LA regola ----------

// Chiamata al passaggio di turno, quando "stato.turnoDi" e' gia' il giocatore
// che sta per giocare. Risponde { scatta: true, primo, ultimo, distacco, livello }
// oppure { scatta: false, motivo }.
//
// opzioni.presenti (facoltativa): funzione id => true/false. Se uno dei due
// protagonisti risulta disconnesso, la prova non parte (e non si consuma).
export function valutaSalmo(stato, cfg, opzioni = {}) {
  const no = motivo => ({ scatta: false, motivo });

  if (!cfg || !cfg.attivo) return no('spento');
  if (!stato || stato.vincitore != null) return no('partita-finita');

  const attivi = giocatoriAttivi(stato);
  if (attivi.length < cfg.giocatoriMinimi) return no('pochi-giocatori');

  const contatori = leggiContatori(stato);
  if (contatori.avviati >= cfg.maxPerPartita) return no('massimo-raggiunto');

  if (contatori.ultimoAvvio !== null &&
      contatori.turni - contatori.ultimoAvvio < cfg.giriDiPausa * attivi.length) {
    return no('pausa');
  }

  const ultimo = stato.giocatori[stato.turnoDi];
  if (!ultimo || ultimo.abbandonato) return no('turno-non-valido');

  const minimo = Math.min(...attivi.map(g => g.posizione));
  if (ultimo.posizione !== minimo) return no('non-ultimo');

  const primo = trovaPrimo(attivi);
  if (primo.id === ultimo.id) return no('stesso-giocatore');

  const distacco = primo.posizione - ultimo.posizione;
  if (distacco < distaccoRichiesto(attivi.length, cfg)) return no('poco-distacco');
  if (primo.posizione > cfg.primoMassimo) return no('primo-troppo-avanti');

  const presenti = opzioni.presenti;
  if (presenti && (!presenti(primo.id) || !presenti(ultimo.id))) return no('non-presenti');

  return {
    scatta: true,
    motivo: 'ok',
    primo: primo.id,
    ultimo: ultimo.id,
    distacco,
    livello: livelloPerCoppia(primo, ultimo)
  };
}
