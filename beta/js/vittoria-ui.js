// vittoria-ui.js
// La festa di fine partita sul tabellone, a tutto schermo: raggi di luce, la pedina del vincitore
// che arriva con la corona, il nome in oro lettera per lettera, coriandoli e fuochi d'artificio,
// il versetto, il podio con 2° e 3°, poi i pulsanti. Tutto disegnato dal vivo (niente video):
// e' nitido su qualunque TV.
//
// I calcoli (classifica, lettere del nome...) sono in vittoria-logica.js. I nomi arrivano dai
// telefoni: entrano sempre come testo semplice (textContent), mai come HTML.

import { classificaFinale, lettereNome, testoRisposte } from './vittoria-logica.js';

const VERSETTO = '«…In una corsa tutti corrono, ma uno solo ottiene il premio…»';
const RIFERIMENTO = '1 Corinti 9:24';

// Quanto durano i fuochi d'artificio (poi restano solo pochi coriandoli, per non affaticare la TV).
const DURATA_FUOCHI_MS = 9000;
const DURATA_CORIANDOLI_MS = 16000;

const ORO = ['#ffd54f', '#ffca28', '#ffe082', '#fff3c4', '#f9a825'];

function crea(tag, classe, testo) {
  const nodo = document.createElement(tag);
  if (classe) nodo.className = classe;
  if (testo !== undefined && testo !== null) nodo.textContent = String(testo);
  return nodo;
}

function pedina(nome, colore, classe) {
  const p = crea('div', classe);
  p.style.setProperty('--colore-pedina', colore || '#888');
  p.appendChild(crea('span', '', (lettereNome(nome)[0] || '?').toUpperCase()));
  return p;
}

// ---------- coriandoli e fuochi d'artificio (canvas) ----------

function avviaFesta(canvas, coloriGiocatori) {
  const ctx = canvas.getContext('2d');
  const colori = [...new Set([...coloriGiocatori.filter(Boolean), ...ORO])];
  const scegli = elenco => elenco[Math.floor(Math.random() * elenco.length)];
  let larghezza = 0;
  let altezza = 0;
  let scala = 1;

  function misura() {
    scala = Math.min(window.devicePixelRatio || 1, 2);
    larghezza = window.innerWidth;
    altezza = window.innerHeight;
    canvas.width = Math.round(larghezza * scala);
    canvas.height = Math.round(altezza * scala);
    ctx.setTransform(scala, 0, 0, scala, 0, 0);
  }
  misura();
  window.addEventListener('resize', misura);

  const coriandoli = [];
  const scintille = [];
  const razzi = [];
  const inizio = performance.now();
  const u = () => Math.min(larghezza, altezza * 16 / 9) / 100;   // 1% della "scena"

  function coriandolo(x, y, vx, vy) {
    coriandoli.push({
      x, y, vx, vy,
      w: u() * (0.5 + Math.random() * 0.6), h: u() * (0.9 + Math.random() * 0.9),
      angolo: Math.random() * Math.PI, giro: (Math.random() - 0.5) * 0.3,
      oscilla: Math.random() * Math.PI * 2, colore: scegli(colori)
    });
  }

  // due cannoni dagli angoli in basso
  function cannoni(quanti) {
    for (let i = 0; i < quanti; i++) {
      const v = u() * (2.2 + Math.random() * 1.6);
      const a1 = (-62 - Math.random() * 22) * Math.PI / 180;
      coriandolo(0, altezza, Math.cos(a1) * v, Math.sin(a1) * v);
      const a2 = (-118 + Math.random() * 22) * Math.PI / 180;
      coriandolo(larghezza, altezza, Math.cos(a2) * v, Math.sin(a2) * v);
    }
  }

  function pioggia(quanti) {
    for (let i = 0; i < quanti; i++) {
      coriandolo(Math.random() * larghezza, -u() * 2, (Math.random() - 0.5) * u() * 0.3, u() * (0.15 + Math.random() * 0.25));
    }
  }

  function lanciaRazzo() {
    razzi.push({
      x: larghezza * (0.15 + Math.random() * 0.7), y: altezza,
      vy: -u() * (1.45 + Math.random() * 0.35),
      quota: altezza * (0.12 + Math.random() * 0.3),
      colore: scegli(colori)
    });
  }

  function esplodi(x, y, colore) {
    const quante = 70;
    const forza = u() * (0.55 + Math.random() * 0.35);
    const secondo = scegli(ORO);
    for (let i = 0; i < quante; i++) {
      const a = (Math.PI * 2 * i) / quante + Math.random() * 0.1;
      const v = forza * (0.6 + Math.random() * 0.6);
      scintille.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vita: 1, colore: i % 3 === 0 ? secondo : colore });
    }
  }

  cannoni(90);
  let ultimoRazzo = 0;
  let ultimaPioggia = 0;
  let fermato = false;
  let animazione = 0;

  function passo(adesso) {
    if (fermato) return;
    const t = adesso - inizio;
    ctx.clearRect(0, 0, larghezza, altezza);

    if (t < DURATA_FUOCHI_MS && adesso - ultimoRazzo > 520 + Math.random() * 500) {
      ultimoRazzo = adesso;
      lanciaRazzo();
    }
    if (t > 700 && t < 1500 && coriandoli.length < 260) cannoni(4);
    if (t < DURATA_CORIANDOLI_MS && adesso - ultimaPioggia > (t < 6000 ? 60 : 220)) {
      ultimaPioggia = adesso;
      pioggia(t < 6000 ? 3 : 1);
    }

    // razzi che salgono
    ctx.globalCompositeOperation = 'lighter';
    for (let i = razzi.length - 1; i >= 0; i--) {
      const r = razzi[i];
      r.y += r.vy;
      r.vy *= 0.985;
      ctx.fillStyle = r.colore;
      ctx.beginPath();
      ctx.arc(r.x, r.y, u() * 0.22, 0, Math.PI * 2);
      ctx.fill();
      if (r.y <= r.quota || r.vy > -u() * 0.25) {
        esplodi(r.x, r.y, r.colore);
        razzi.splice(i, 1);
      }
    }
    // scintille dei fuochi
    for (let i = scintille.length - 1; i >= 0; i--) {
      const s = scintille[i];
      s.x += s.vx; s.y += s.vy;
      s.vx *= 0.96; s.vy = s.vy * 0.96 + u() * 0.012;
      s.vita -= 0.012;
      if (s.vita <= 0) { scintille.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, s.vita);
      ctx.fillStyle = s.colore;
      ctx.beginPath();
      ctx.arc(s.x, s.y, u() * 0.16 * (0.5 + s.vita), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // coriandoli
    for (let i = coriandoli.length - 1; i >= 0; i--) {
      const c = coriandoli[i];
      c.vy += u() * 0.035;
      c.vx *= 0.985;
      c.vy = Math.min(c.vy, u() * 0.45);
      c.oscilla += 0.08;
      c.x += c.vx + Math.sin(c.oscilla) * u() * 0.06;
      c.y += c.vy;
      c.angolo += c.giro;
      if (c.y > altezza + u() * 3) { coriandoli.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angolo);
      ctx.scale(1, Math.cos(c.oscilla));       // si "girano" mentre cadono
      ctx.fillStyle = c.colore;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }

    if (t > DURATA_CORIANDOLI_MS + 4000 && coriandoli.length === 0 && scintille.length === 0 && razzi.length === 0) {
      ferma();
      return;
    }
    animazione = requestAnimationFrame(passo);
  }

  function ferma() {
    fermato = true;
    cancelAnimationFrame(animazione);
    window.removeEventListener('resize', misura);
    ctx.clearRect(0, 0, larghezza, altezza);
  }

  animazione = requestAnimationFrame(passo);
  return ferma;
}

// ---------- la scena ----------

let fermaFesta = null;

// Se la scena e' piu' alta dello schermo (tanti giocatori, schermo basso), la rimpicciolisce tutta
// insieme quanto basta: niente tagli in alto o in basso.
function adattaAlloSchermo() {
  const box = document.querySelector('#vittoria-overlay .vittoria-box');
  if (!box) return;
  box.style.setProperty('--vittoria-adatta', '1');
  const alta = box.scrollHeight;
  const disponibile = window.innerHeight * 0.97;
  const fattore = alta > disponibile ? Math.max(0.6, disponibile / alta) : 1;
  box.style.setProperty('--vittoria-adatta', fattore.toFixed(3));
}

window.addEventListener('resize', () => {
  const overlay = document.getElementById('vittoria-overlay');
  if (overlay && !overlay.classList.contains('nascosta')) adattaAlloSchermo();
});

// giocatori: lo stato.giocatori della partita; coloreDi(g): il colore CSS della pedina.
export function mostraCelebrazione({ giocatori, vincitoreId, coloreDi }) {
  const overlay = document.getElementById('vittoria-overlay');
  const scena = document.getElementById('vittoria-scena');
  const canvas = document.getElementById('vittoria-festa');
  if (!overlay || !scena) return;

  const classifica = classificaFinale(giocatori, vincitoreId);
  const colore = g => (typeof coloreDi === 'function' ? coloreDi(g) : g.colore) || '#888';
  const campione = classifica[0] || { nome: '?', colore: '#888' };

  scena.textContent = '';

  scena.appendChild(crea('div', 'vittoria-traguardo', '🏁 Traguardo raggiunto!'));

  const blocco = crea('div', 'vittoria-campione');
  blocco.appendChild(crea('div', 'vittoria-alone'));
  blocco.appendChild(pedina(campione.nome, colore(campione), 'vittoria-pedina'));
  blocco.appendChild(crea('div', 'vittoria-corona', '👑'));
  scena.appendChild(blocco);

  const titolo = crea('h2', 'vittoria-titolo');
  titolo.id = 'vittoria-titolo';
  titolo.appendChild(crea('span', 'vittoria-ha-vinto', 'Ha vinto'));
  const nome = crea('span', 'vittoria-nome');
  lettereNome(campione.nome).forEach((lettera, i) => {
    const l = crea('span', 'vittoria-lettera', lettera === ' ' ? ' ' : lettera);
    l.style.animationDelay = `${1500 + i * 70}ms, ${2600 + i * 70}ms`;
    nome.appendChild(l);
  });
  titolo.appendChild(nome);
  scena.appendChild(titolo);

  const versetto = crea('p', 'vittoria-versetto', VERSETTO);
  versetto.appendChild(crea('span', 'vittoria-riferimento', RIFERIMENTO));
  scena.appendChild(versetto);

  // il podio: 2° a sinistra, 1° al centro, 3° a destra (solo chi c'e')
  const altri = classifica.slice(1);
  if (altri.length > 0) {
    const podio = crea('div', 'vittoria-podio');
    const ordine = [altri[0], classifica[0], altri[1]].filter(Boolean);
    const gradini = altri.length === 1 ? [altri[0], classifica[0]] : ordine;
    gradini.forEach((g, i) => {
      const gradino = crea('div', `vittoria-gradino vittoria-gradino-${g.posto === 1 && g.id === campione.id ? 1 : (g === altri[0] ? 2 : 3)}`);
      gradino.style.animationDelay = `${3200 + i * 180}ms`;
      gradino.appendChild(pedina(g.nome, colore(g), 'vittoria-pedina-piccola'));
      gradino.appendChild(crea('div', 'vittoria-gradino-nome', g.nome));
      const risposte = testoRisposte(g.corrette, g.totali);
      if (risposte) gradino.appendChild(crea('div', 'vittoria-gradino-risposte', risposte));
      const base = crea('div', 'vittoria-gradino-base', `${g.posto}°`);
      gradino.appendChild(base);
      podio.appendChild(gradino);
    });
    scena.appendChild(podio);

    const resto = altri.slice(2);
    if (resto.length > 0) {
      const fila = crea('div', 'vittoria-altri');
      resto.forEach(g => {
        const voce = crea('span', 'vittoria-altro');
        const pallino = crea('span', 'vittoria-altro-pallino');
        pallino.style.background = colore(g);
        voce.append(`${g.posto}° `, pallino, g.nome);
        fila.appendChild(voce);
      });
      scena.appendChild(fila);
    }
  }

  overlay.classList.remove('nascosta', 'vittoria-entrata');
  void overlay.offsetWidth;
  overlay.classList.add('vittoria-entrata');
  adattaAlloSchermo();

  if (fermaFesta) fermaFesta();
  fermaFesta = null;
  const movimentoRidotto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canvas && !movimentoRidotto) {
    try {
      fermaFesta = avviaFesta(canvas, classifica.map(colore));
    } catch (errore) {
      console.warn('Coriandoli non disponibili (la festa resta lo stesso)', errore);
    }
  }
}

export function fermaCelebrazione() {
  if (fermaFesta) fermaFesta();
  fermaFesta = null;
}
