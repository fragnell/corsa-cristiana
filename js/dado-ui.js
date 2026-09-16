// dado-ui.js
// Anima il dado come un vero cubo 3D che ruota e si ferma sulla faccia
// giusta. Riceve SEMPRE un numero già deciso da tiraDado() in regole.js —
// qui ci si occupa solo di mostrarlo bene, mai di generarlo.
//
// La rotazione che porta ogni faccia verso l'osservatore è stata
// verificata una per una: questi sei assi corrispondono esattamente
// ai valori 1-6, nell'ordine.
import { riproduciEffetto } from './audio-ui.js';
const ROTAZIONE_PER_VALORE = [
  [-0.1, 0.3, -1],
  [-0.1, 0.6, -0.4],
  [-0.85, -0.42, 0.73],
  [-0.8, 0.3, -0.75],
  [0.3, 0.45, 0.9],
  [-0.16, 0.6, 0.18]
];

const DURATA_TUMBLING_MS = 1600;
const PAUSA_RISULTATO_MS = 900;

export function animaDado(valoreFinale) {
  return new Promise(risolvi => {
    const overlay = document.getElementById('dado-overlay');
    const cubo = document.getElementById('dado-cubo');

    cubo.style.transition = 'none';
    cubo.classList.remove('tumbling');
    void cubo.offsetWidth; // forza il browser a "dimenticare" l'animazione precedente
    cubo.classList.add('tumbling');
    overlay.classList.remove('nascosta');
    riproduciEffetto('dado');

    setTimeout(() => {
      cubo.classList.remove('tumbling');
      cubo.style.transition = 'transform 0.4s cubic-bezier(0.42, 1.57, 0.62, 0.86)';
      const asse = ROTAZIONE_PER_VALORE[valoreFinale - 1];
      cubo.style.transform = `rotate3d(${asse.join(',')}, 180deg)`;

      setTimeout(() => {
        overlay.classList.add('nascosta');
        risolvi();
      }, PAUSA_RISULTATO_MS);
    }, DURATA_TUMBLING_MS);
  });
}