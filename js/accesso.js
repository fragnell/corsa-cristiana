// accesso.js
// La password che protegge le azioni riservate a chi gestisce il gioco:
// oggi, accettare manualmente una risposta scritta in un altro modo; più
// avanti, anche l'ingresso al pannello impostazioni. È una sola password
// condivisa con chi si fida di gestire le carte — non un vero sistema di
// account separati per persona, che sarebbe un lavoro a sé.
//
// IMPORTANTE: cambia il valore qui sotto con una password tua.

const PASSWORD = "CAMBIAMI";

export function chiediPassword(messaggio) {
  const inserita = prompt(messaggio || 'Inserisci la password:');
  return inserita === PASSWORD;
}