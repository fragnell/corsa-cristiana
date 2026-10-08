// tempo.js
// Salmo 133:1 — un piccolo attrezzo condiviso da tabellone e telefoni:
// dare un TEMPO MASSIMO a un'operazione di rete.
//
// Con Firebase, una scrittura fatta mentre la connessione e' caduta non
// fallisce e non finisce: resta in attesa per sempre. Se il gioco aspettasse
// quella promessa, si fermerebbe. Con questo attrezzo, invece, dopo "ms"
// millisecondi l'attesa finisce con un errore e si puo' decidere cosa fare.

// "operazione" e' una FUNZIONE che restituisce la promessa (cosi' anche un
// errore immediato viene intercettato). Risolve con il valore dell'operazione
// oppure rifiuta con l'errore dell'operazione o con "tempo scaduto".
export function conLimite(operazione, ms) {
  return new Promise((risolvi, rifiuta) => {
    const timer = setTimeout(() => rifiuta(new Error('tempo scaduto')), ms);
    Promise.resolve().then(operazione).then(
      valore => { clearTimeout(timer); risolvi(valore); },
      errore => { clearTimeout(timer); rifiuta(errore); }
    );
  });
}
