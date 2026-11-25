// introduzione.js
// La presentazione animata che compare sul tabellone all'inizio di ogni partita: una premessa sullo
// spirito del gioco, poi la domanda "E' la prima volta che giocate?" e, se si risponde di si', una
// spiegazione breve delle regole. Scorre da sola come un video (ogni scena resta il tempo di leggerla),
// si puo' mettere in pausa, tornare indietro, andare avanti o saltare del tutto.
//
// I testi sono in introduzione-testi.js. Questo file si carica "a parte" (import dinamico da
// tabellone-ui.js e regolamento-ui.js): se non si carica o si rompe, la partita parte lo stesso.
//
// Tastiera (comoda con il telecomando o la tastiera del PC):
//   freccia destra / Invio = avanti, freccia sinistra = indietro, spazio = pausa, Esc = salta.

import { scenePremessa, scenaDomanda, sceneRegole, ATTESA_DOMANDA_MS } from './introduzione-testi.js';

const ID_STILE = 'introduzione-stile';
const ATTESA_STILE_MS = 2000;

function crea(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo !== undefined && testo !== null) el.textContent = String(testo);
  return el;
}

// Il foglio di stile si carica una volta sola, e si aspetta che sia pronto (ma non per sempre).
function caricaStile() {
  return new Promise(risolvi => {
    const esistente = document.getElementById(ID_STILE);
    if (esistente) { risolvi(); return; }
    const link = document.createElement('link');
    link.id = ID_STILE;
    link.rel = 'stylesheet';
    link.href = 'css/introduzione.css';
    link.onload = () => risolvi();
    link.onerror = () => risolvi();
    document.head.appendChild(link);
    setTimeout(risolvi, ATTESA_STILE_MS);
  });
}

// ---------- le animazioni "da video" ----------

const COLORI_CASELLE = ['#4f8fd8', '#4f8fd8', '#e67e22', '#4f8fd8', '#8e5cc9', '#4f8fd8', '#d94b4b', '#4f8fd8', '#3fa45b', '#f2b705'];
const COLORI_PEDINE = ['#e74c3c', '#2e86de', '#27ae60'];

function animazionePercorso() {
  const pista = crea('div', 'intro-anim intro-anim-percorso');
  const caselle = crea('div', 'intro-pista');
  COLORI_CASELLE.forEach((colore, i) => {
    const c = crea('span', 'intro-pista-casella', i === COLORI_CASELLE.length - 1 ? '🏁' : '');
    c.style.background = colore;
    caselle.appendChild(c);
  });
  pista.appendChild(caselle);
  COLORI_PEDINE.forEach((colore, i) => {
    const p = crea('span', 'intro-pedina');
    p.style.background = colore;
    p.style.setProperty('--ritardo', `${i * 0.45}s`);
    p.style.setProperty('--durata', `${5.4 + i * 0.9}s`);
    p.style.setProperty('--riga', String(i));
    pista.appendChild(p);
  });
  return pista;
}

function animazioneDado() {
  const box = crea('div', 'intro-anim intro-anim-dado');
  box.appendChild(crea('span', 'intro-telefono', '📱'));
  box.appendChild(crea('span', 'intro-freccia', '➜'));
  box.appendChild(crea('span', 'intro-dado', '🎲'));
  box.appendChild(crea('span', 'intro-numero', '+4'));
  return box;
}

function animazioneMosaico() {
  const box = crea('div', 'intro-anim intro-anim-mosaico');
  const griglia = crea('div', 'intro-mosaico');
  ['🕊️', '🍞', '🌿', '⭐'].forEach((emoji, i) => {
    const t = crea('span', `intro-tessera intro-tessera-${i}`, emoji);
    griglia.appendChild(t);
  });
  box.appendChild(crea('span', 'intro-voce', '🗣️'));
  box.appendChild(griglia);
  return box;
}

const ANIMAZIONI = { percorso: animazionePercorso, dado: animazioneDado, mosaico: animazioneMosaico };

// Il testo entra una parola alla volta, come i sottotitoli di un video.
function testoAParole(testo) {
  const p = crea('p', 'intro-testo');
  String(testo || '').split(/\s+/).filter(Boolean).forEach((parola, i) => {
    const s = crea('span', 'intro-parola', parola);
    s.style.animationDelay = `${Math.min(i * 60, 2600) + 350}ms`;
    p.appendChild(s);
    p.appendChild(document.createTextNode(' '));
  });
  return p;
}

// ---------- il lettore ----------

// opzioni:
//   config, modalita   la configurazione della partita (per i numeri delle regole)
//   conDomanda         true (tabellone): dopo la premessa chiede se e' la prima volta;
//                      false (pagina delle regole): premessa e regole di fila
//   etichettaSalta     il testo del pulsante per uscire
// Restituisce una Promise che si risolve con { esito: 'finita' | 'saltata', regole: true|false }.
export async function mostraIntroduzione({ config, modalita = 'normale', conDomanda = true, etichettaSalta = 'Salta l\'introduzione ⏭' } = {}) {
  await caricaStile();

  return new Promise(risolvi => {
    let scene = scenePremessa();
    let regoleAggiunte = false;
    if (conDomanda) scene.push(scenaDomanda());
    else { scene = scene.concat(sceneRegole(config, modalita)); regoleAggiunte = true; }

    let indice = 0;
    let trascorso = 0;          // ms gia' passati nella scena attuale (senza contare le pause)
    let ultimoIstante = 0;
    let inPausa = false;
    let finita = false;
    let animazione = 0;

    const radice = crea('div', 'intro');
    radice.setAttribute('role', 'dialog');
    radice.setAttribute('aria-modal', 'true');
    radice.setAttribute('aria-label', 'Introduzione a Corsa Cristiana');
    radice.appendChild(crea('div', 'intro-sfondo'));
    const luci = crea('div', 'intro-luci');
    for (let i = 0; i < 14; i++) {
      const l = crea('span', 'intro-luce');
      l.style.left = `${(i * 37) % 100}%`;
      l.style.animationDelay = `${-(i * 1.3)}s`;
      l.style.animationDuration = `${9 + (i % 5) * 2}s`;
      luci.appendChild(l);
    }
    radice.appendChild(luci);

    const palco = crea('div', 'intro-palco');
    palco.setAttribute('aria-live', 'polite');
    radice.appendChild(palco);

    const barra = crea('div', 'intro-barra');
    const progressi = crea('div', 'intro-progressi');
    const comandi = crea('div', 'intro-comandi');
    const bIndietro = crea('button', 'intro-comando', '‹');
    bIndietro.type = 'button'; bIndietro.title = 'Indietro'; bIndietro.setAttribute('aria-label', 'Scena precedente');
    const bPausa = crea('button', 'intro-comando', '⏸');
    bPausa.type = 'button'; bPausa.title = 'Pausa'; bPausa.setAttribute('aria-label', 'Pausa');
    const bAvanti = crea('button', 'intro-comando', '›');
    bAvanti.type = 'button'; bAvanti.title = 'Avanti'; bAvanti.setAttribute('aria-label', 'Scena successiva');
    const bSalta = crea('button', 'intro-salta', etichettaSalta);
    bSalta.type = 'button';
    comandi.append(bIndietro, bPausa, bAvanti);
    barra.append(progressi, comandi, bSalta);
    radice.appendChild(barra);

    let riempimento = null;      // la barretta che si riempie nella scena attuale
    let contoDomanda = null;     // "si parte da soli tra..."

    function disegnaProgressi() {
      progressi.textContent = '';
      scene.forEach((s, i) => {
        const segmento = crea('span', 'intro-segmento' + (i < indice ? ' fatto' : ''));
        const pieno = crea('span', 'intro-segmento-pieno');
        segmento.appendChild(pieno);
        if (i === indice) riempimento = pieno;
        progressi.appendChild(segmento);
      });
    }

    function scegli(siRegole) {
      if (finita) return;
      if (siRegole) {
        if (!regoleAggiunte) {
          scene = scene.slice(0, indice + 1).concat(sceneRegole(config, modalita));
          regoleAggiunte = true;
        }
        vaiA(indice + 1);
      } else {
        chiudi('finita');
      }
    }

    function disegnaScena() {
      const s = scene[indice];
      palco.textContent = '';
      contoDomanda = null;
      const scena = crea('div', 'intro-scena' + (s.tipo === 'domanda' ? ' intro-scena-domanda' : ''));
      scena.appendChild(crea('div', 'intro-icona', s.icona));
      scena.appendChild(crea('h2', 'intro-titolo', s.titolo));
      if (s.testo) scena.appendChild(testoAParole(s.testo));
      if (s.citazione) {
        // la citazione resta esattamente com'e': entra tutta insieme, dopo la frase introduttiva
        const citazione = crea('blockquote', 'intro-citazione', `«${s.citazione}»`);
        scena.appendChild(citazione);
      }
      if (Array.isArray(s.elenco)) {
        const elenco = crea('ul', 'intro-elenco');
        s.elenco.forEach((voce, i) => {
          const li = crea('li', 'intro-voce-elenco');
          li.style.animationDelay = `${500 + i * 900}ms`;
          if (voce.immagine) {
            const img = document.createElement('img');
            img.src = voce.immagine; img.alt = ''; img.className = 'intro-voce-immagine';
            li.appendChild(img);
          } else {
            li.appendChild(crea('span', 'intro-voce-icona', voce.icona || '•'));
          }
          const testo = crea('span', 'intro-voce-testo');
          testo.appendChild(crea('strong', '', voce.titolo));
          if (voce.testo) testo.appendChild(document.createTextNode(voce.titolo.endsWith('…') ? ` ${voce.testo}` : `: ${voce.testo}`));
          li.appendChild(testo);
          elenco.appendChild(li);
        });
        scena.appendChild(elenco);
      }
      if (s.animazione && ANIMAZIONI[s.animazione]) scena.appendChild(ANIMAZIONI[s.animazione]());
      if (s.riferimento) scena.appendChild(crea('p', 'intro-riferimento', s.riferimento));
      if (s.tipo === 'domanda') {
        const scelte = crea('div', 'intro-scelte');
        const si = crea('button', 'intro-scelta intro-scelta-si', s.si);
        si.type = 'button';
        si.addEventListener('click', () => scegli(true));
        const no = crea('button', 'intro-scelta intro-scelta-no', s.no);
        no.type = 'button';
        no.addEventListener('click', () => scegli(false));
        scelte.append(si, no);
        scena.appendChild(scelte);
        contoDomanda = crea('p', 'intro-conto');
        scena.appendChild(contoDomanda);
        setTimeout(() => { try { si.focus({ preventScroll: true }); } catch (e) { /* pazienza */ } }, 50);
      }
      palco.appendChild(scena);
      bIndietro.disabled = indice === 0;
      bAvanti.disabled = s.tipo === 'domanda';
      disegnaProgressi();
    }

    function vaiA(nuovo) {
      if (finita) return;
      if (nuovo >= scene.length) { chiudi('finita'); return; }
      indice = Math.max(0, nuovo);
      trascorso = 0;
      disegnaScena();
    }

    function pausa(valore) {
      inPausa = valore === undefined ? !inPausa : !!valore;
      radice.classList.toggle('intro-in-pausa', inPausa);
      bPausa.textContent = inPausa ? '▶' : '⏸';
      bPausa.title = inPausa ? 'Riprendi' : 'Pausa';
      bPausa.setAttribute('aria-label', bPausa.title);
    }

    function passo(istante) {
      if (finita) return;
      const delta = ultimoIstante ? Math.min(250, istante - ultimoIstante) : 0;
      ultimoIstante = istante;
      if (!inPausa) trascorso += delta;
      const s = scene[indice];
      const durata = s.durataMs || ATTESA_DOMANDA_MS;
      if (riempimento) riempimento.style.width = `${Math.min(100, (trascorso / durata) * 100)}%`;
      if (contoDomanda) {
        const sec = Math.max(0, Math.ceil((durata - trascorso) / 1000));
        contoDomanda.textContent = `Se nessuno sceglie, si parte da soli tra ${sec}s`;
      }
      if (trascorso >= durata) {
        if (s.tipo === 'domanda') scegli(false);
        else vaiA(indice + 1);
      }
      animazione = requestAnimationFrame(passo);
    }

    function tasto(evento) {
      if (finita) return;
      const s = scene[indice];
      if (evento.key === 'Escape') { evento.preventDefault(); chiudi('saltata'); }
      else if (evento.key === 'ArrowRight' && s.tipo !== 'domanda') { evento.preventDefault(); vaiA(indice + 1); }
      else if (evento.key === 'Enter' && s.tipo !== 'domanda' && !(evento.target instanceof HTMLButtonElement)) { evento.preventDefault(); vaiA(indice + 1); }
      else if (evento.key === 'ArrowLeft') { evento.preventDefault(); vaiA(indice - 1); }
      else if (evento.key === ' ' && !(evento.target instanceof HTMLButtonElement)) { evento.preventDefault(); pausa(); }
    }

    function chiudi(esito) {
      if (finita) return;
      finita = true;
      cancelAnimationFrame(animazione);
      document.removeEventListener('keydown', tasto);
      radice.classList.add('intro-uscita');
      setTimeout(() => { radice.remove(); }, 600);
      risolvi({ esito, regole: regoleAggiunte });
    }

    bIndietro.addEventListener('click', () => vaiA(indice - 1));
    bAvanti.addEventListener('click', () => vaiA(indice + 1));
    bPausa.addEventListener('click', () => pausa());
    bSalta.addEventListener('click', () => chiudi('saltata'));
    document.addEventListener('keydown', tasto);

    document.body.appendChild(radice);
    disegnaScena();
    animazione = requestAnimationFrame(passo);
  });
}
