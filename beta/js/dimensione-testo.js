// dimensione-testo.js
// Il pulsante A− / A+ in basso a destra sul tabellone: rende piu' grandi (o piu' piccoli) i testi
// delle carte, degli esiti, degli annunci e del riquadro del turno, per chi guarda la TV da lontano
// o non vede benissimo. La scelta resta su questo dispositivo (localStorage). Le carte si adattano
// comunque da sole: se il testo e' tanto, si rimpiccioliscono quanto serve anche con A+.
//
// Imposta su :root:
//   --scala-testo  il livello scelto (1 = normale; vedi LIVELLI_TESTO in carta-logica.js)
//   --scala-dado   quanto ingrandire il dado (che e' disegnato a 100px) in base allo schermo

import { LIVELLI_TESTO, livelloSuccessivo, livelloValido } from './carta-logica.js';
import { adattaCarta } from './carta-ui.js';

// BETA: chiave diversa da quella del gioco vero, cosi' i due non si scambiano la scelta.
const CHIAVE = 'corsa-cristiana-beta-dimensione-testo';

function leggi() {
  try { return livelloValido(localStorage.getItem(CHIAVE)); } catch (errore) { return 1; }
}

function salva(livello) {
  try { localStorage.setItem(CHIAVE, String(livello)); } catch (errore) { /* pazienza: vale solo fino alla chiusura */ }
}

function applicaDado() {
  const larghezzaScena = Math.min(window.innerWidth, window.innerHeight * 16 / 9);
  document.documentElement.style.setProperty('--scala-dado', (larghezzaScena / 960).toFixed(2));
}

export function avviaDimensioneTesto() {
  let livello = leggi();
  const radice = document.documentElement;

  const scatola = document.createElement('div');
  scatola.className = 'dimensione-testo';
  scatola.setAttribute('role', 'group');
  scatola.setAttribute('aria-label', 'Dimensione del testo sul tabellone');
  const meno = document.createElement('button');
  meno.type = 'button';
  meno.textContent = 'A−';
  meno.title = 'Testo più piccolo';
  const valore = document.createElement('span');
  valore.className = 'dimensione-testo-valore';
  const piu = document.createElement('button');
  piu.type = 'button';
  piu.textContent = 'A+';
  piu.title = 'Testo più grande (per chi è lontano dalla TV)';
  scatola.append(meno, valore, piu);

  function applica() {
    radice.style.setProperty('--scala-testo', String(livello));
    valore.textContent = `${Math.round(livello * 100)}%`;
    meno.disabled = livello <= LIVELLI_TESTO[0];
    piu.disabled = livello >= LIVELLI_TESTO[LIVELLI_TESTO.length - 1];
    adattaCarta();
  }

  meno.addEventListener('click', () => { livello = livelloSuccessivo(livello, -1); salva(livello); applica(); });
  piu.addEventListener('click', () => { livello = livelloSuccessivo(livello, +1); salva(livello); applica(); });

  document.body.appendChild(scatola);
  applica();
  applicaDado();
  window.addEventListener('resize', applicaDado);
}
