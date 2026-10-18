// connessione.js
// Dice se QUESTO dispositivo e' collegato a Firebase in questo momento: callback(true) o callback(false) a
// ogni cambiamento (anche la prima volta, appena si comincia ad ascoltare). Serve solo a mostrare un avviso
// quando la connessione cade (vedi avviso-connessione.js): non scrive niente nel database.
// Restituisce la funzione per smettere di ascoltare.

import { db, ref, onValue } from './rete.js';

export function ascoltaConnessione(callback) {
  return onValue(ref(db, '.info/connected'), (istantanea) => {
    callback(istantanea.val() === true);
  });
}
