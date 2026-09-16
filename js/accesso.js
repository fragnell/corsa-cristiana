// accesso.js
// Il login vero di chi gestisce il gioco, con Firebase Authentication —
// non più una password scritta nel codice, ma un account verificato dai
// server di Firebase. Usato sia per l'ingresso al pannello impostazioni,
// sia per accettare manualmente una risposta scritta in un altro modo
// durante il gioco.

import { auth, signInWithEmailAndPassword, signOut } from './rete.js';

// Restituisce una Promise (true/false): true se il login è riuscito.
export function chiediPassword(messaggio) {
  return new Promise(risolvi => {
    const overlay = document.getElementById('password-overlay');
    const elMessaggio = document.getElementById('password-messaggio');
    const inputEmail = document.getElementById('password-email');
    const inputPassword = document.getElementById('password-input');
    const elErrore = document.getElementById('password-errore');
    const bottoneConferma = document.getElementById('password-conferma');
    const bottoneAnnulla = document.getElementById('password-annulla');

    elMessaggio.textContent = messaggio || 'Accedi:';
    inputEmail.value = '';
    inputPassword.value = '';
    elErrore.textContent = '';
    overlay.classList.remove('nascosta');
    inputEmail.focus();

    let concluso = false;
    const concludi = risultato => {
      if (concluso) return;
      concluso = true;
      overlay.classList.add('nascosta');
      bottoneConferma.removeEventListener('click', confermaClick);
      bottoneAnnulla.removeEventListener('click', annullaClick);
      inputPassword.removeEventListener('keydown', invioTasto);
      risolvi(risultato);
    };

    const confermaClick = async () => {
      elErrore.textContent = '';
      bottoneConferma.disabled = true;
      try {
        await signInWithEmailAndPassword(auth, inputEmail.value.trim(), inputPassword.value);
        concludi(true);
      } catch (errore) {
        elErrore.textContent = 'Email o password non corretti.';
        bottoneConferma.disabled = false;
      }
    };
    const annullaClick = () => concludi(false);
    const invioTasto = e => { if (e.key === 'Enter') confermaClick(); };

    bottoneConferma.addEventListener('click', confermaClick);
    bottoneAnnulla.addEventListener('click', annullaClick);
    inputPassword.addEventListener('keydown', invioTasto);
  });
}

// Esce dall'account — usata dopo "Accetta risposta" sul tabellone, per
// non lasciare il login sbloccato su un dispositivo condiviso.
export function esci() {
  return signOut(auth);
}