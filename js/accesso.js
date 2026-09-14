// accesso.js
// La password che protegge le azioni riservate a chi gestisce il gioco:
// l'ingresso al pannello impostazioni, e accettare manualmente una
// risposta scritta in un altro modo durante il gioco. Mostra un modulo
// vero con un campo di tipo password (nasconde i caratteri) invece del
// prompt() del browser, che non ha mai potuto farlo — è un limite del
// browser stesso, non qualcosa che si poteva correggere sul prompt().
//
// IMPORTANTE: cambia il valore qui sotto con una password tua.

const PASSWORD = "CAMBIAMI";

// Restituisce una Promise (true/false) invece di rispondere subito,
// perché ora deve aspettare che qualcuno scriva e prema un pulsante —
// chi la chiama deve mettere "await" davanti.
export function chiediPassword(messaggio) {
  return new Promise(risolvi => {
    const overlay = document.getElementById('password-overlay');
    const elMessaggio = document.getElementById('password-messaggio');
    const input = document.getElementById('password-input');
    const bottoneConferma = document.getElementById('password-conferma');
    const bottoneAnnulla = document.getElementById('password-annulla');

    elMessaggio.textContent = messaggio || 'Inserisci la password:';
    input.value = '';
    overlay.classList.remove('nascosta');
    input.focus();

    let concluso = false;
    const concludi = risultato => {
      if (concluso) return;
      concluso = true;
      overlay.classList.add('nascosta');
      bottoneConferma.removeEventListener('click', confermaClick);
      bottoneAnnulla.removeEventListener('click', annullaClick);
      input.removeEventListener('keydown', invioTasto);
      risolvi(risultato);
    };

    const confermaClick = () => concludi(input.value === PASSWORD);
    const annullaClick = () => concludi(false);
    const invioTasto = e => { if (e.key === 'Enter') confermaClick(); };

    bottoneConferma.addEventListener('click', confermaClick);
    bottoneAnnulla.addEventListener('click', annullaClick);
    input.addEventListener('keydown', invioTasto);
  });
}