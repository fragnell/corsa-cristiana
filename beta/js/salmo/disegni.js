// disegni.js
// Salmo 133:1 — i disegni del mosaico. Ogni disegno e' un'immagine quadrata
// (100 x 100) con il PROPRIO sfondo colorato, completa in se': nessun
// disegno continua in quello vicino, quindi i riquadri si possono scambiare
// in qualunque ordine senza "spezzare" niente.
//
// I disegni sono scritti qui dentro come testo SVG: non c'e' nessun file da
// scaricare (niente rete lenta, niente nomi di file sbagliati) e restano
// nitidi a qualunque dimensione. Sono tutti disegni originali, fatti per
// questo gioco.
//
// Ogni disegno ha un identificativo breve (solo lettere minuscole): e' quello
// che viaggia su Firebase al posto dell'immagine.

// ---------- piccoli attrezzi per disegnare ----------

// Scintilla a quattro punte (per cielo e notte).
function scintilla(x, y, r, colore = '#fff') {
  const a = r * 0.28;
  return `<path d="M${x} ${y - r} L${x + a} ${y - a} L${x + r} ${y} L${x + a} ${y + a} L${x} ${y + r} L${x - a} ${y + a} L${x - r} ${y} L${x - a} ${y - a} Z" fill="${colore}"/>`;
}

// Stella a cinque punte.
function stella(cx, cy, grande, piccolo, colore) {
  const punti = [];
  for (let k = 0; k < 10; k++) {
    const raggio = k % 2 === 0 ? grande : piccolo;
    const angolo = (-90 + k * 36) * Math.PI / 180;
    punti.push(`${(cx + raggio * Math.cos(angolo)).toFixed(1)},${(cy + raggio * Math.sin(angolo)).toFixed(1)}`);
  }
  return `<polygon points="${punti.join(' ')}" fill="${colore}"/>`;
}

// Un disegno completo: sfondo + contenuto.
function svg(sfondo, contenuto) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="100" height="100" fill="${sfondo}"/>${contenuto}</svg>`;
}

// ---------- i disegni ----------

const COLOMBA = svg('#8ecbee', `<g transform="translate(3 5) scale(0.93)">
  <path d="M30 56 C34 28 44 12 58 10 C66 22 64 44 52 60 Z" fill="#eaf2fb" stroke="#b6d0ea" stroke-width="1.4"/>
  <path d="M38 54 C40 34 46 22 54 16 M44 56 C47 38 54 26 60 22" fill="none" stroke="#b6d0ea" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M5 62 C12 54 24 54 34 52 C44 50 52 48 58 44 C62 38 70 33 78 35 C86 36 88 44 86 50 L83 58 C80 68 68 73 54 73 C42 73 32 69 24 67 C14 68 8 67 5 62 Z" fill="#ffffff"/>
  <path d="M10 62 C18 58 30 60 40 64" fill="none" stroke="#dbe8f5" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="42" cy="62" rx="12" ry="6" fill="#e3eef9"/>
  <path d="M86 41 L97 45 L86 49 Z" fill="#f2994a"/>
  <circle cx="81" cy="40" r="2.2" fill="#1d1d1d"/>
  <path d="M93 47 C98 52 99 58 97 64" fill="none" stroke="#7f9a34" stroke-width="1.6" stroke-linecap="round"/>
  <ellipse cx="96" cy="51" rx="3.6" ry="1.9" transform="rotate(30 96 51)" fill="#7f9a34"/>
  <ellipse cx="98" cy="58" rx="3.6" ry="1.9" transform="rotate(75 98 58)" fill="#7f9a34"/>
  <ellipse cx="94" cy="62" rx="3.6" ry="1.9" transform="rotate(-30 94 62)" fill="#93ad45"/>
</g>`);

const PANE = svg('#dcd4f2', `
  <ellipse cx="50" cy="78" rx="38" ry="7" fill="#b8a6e0"/>
  <path d="M12 70 C10 50 24 35 50 35 C76 35 90 50 88 70 C88 75 84 77 80 77 L20 77 C16 77 12 75 12 70 Z" fill="#d99441"/>
  <path d="M20 58 C25 45 37 40 50 40 C63 40 75 45 80 58 C70 51 60 49 50 49 C40 49 30 51 20 58 Z" fill="#e8b35d"/>
  <path d="M37 44 L43 59 M49 43 L55 58 M61 44 L67 59" fill="none" stroke="#b86a1d" stroke-width="4.2" stroke-linecap="round"/>
`);

const PESCE = svg('#17705a', `
  <path d="M34 38 C38 22 54 22 60 36 Z" fill="#e07f1a"/>
  <path d="M38 66 C42 78 52 78 58 66 Z" fill="#e07f1a"/>
  <path d="M70 52 L94 34 L94 70 Z" fill="#f79d3b"/>
  <ellipse cx="46" cy="52" rx="29" ry="18" fill="#f79d3b"/>
  <ellipse cx="46" cy="61" rx="22" ry="6" fill="#fcd29a"/>
  <path d="M52 38 C58 46 58 58 52 66" fill="none" stroke="#c9620d" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="30" cy="48" r="5.6" fill="#ffffff"/>
  <circle cx="29" cy="48" r="3" fill="#161616"/>
  <circle cx="14" cy="26" r="2.4" fill="#8cc9bd"/>
  <circle cx="19" cy="18" r="1.7" fill="#8cc9bd"/>
`);

const LAMPADA = svg('#2c3a68', `
  <circle cx="84" cy="25" r="19" fill="#374577"/>
  <circle cx="84" cy="25" r="12" fill="#445283"/>
  <path d="M84 7 C91 14 95 21 91 29 C89 34 81 34 79 29 C77 23 81 16 84 7 Z" fill="#f9c933"/>
  <path d="M85 20 C89 24 89 28 85 31 C81 28 81 24 85 20 Z" fill="#f08a3c"/>
  <path d="M68 58 L84 36 L92 42 L78 66 Z" fill="#c1693b"/>
  <path d="M19 60 C21 75 34 85 52 85 C68 85 79 77 81 63 L81 59 Z" fill="#c1693b"/>
  <ellipse cx="50" cy="59" rx="31" ry="7" fill="#8c4a22"/>
  <path d="M22 64 C9 59 6 76 20 77" fill="none" stroke="#c1693b" stroke-width="5" stroke-linecap="round"/>
`);

const AGNELLO = svg('#d3e8c3', `
  <rect y="76" width="100" height="24" fill="#a8d598"/>
  <rect x="43" y="64" width="5" height="18" rx="2" fill="#4a4f5d"/>
  <rect x="54" y="64" width="5" height="18" rx="2" fill="#4a4f5d"/>
  <rect x="71" y="64" width="5" height="18" rx="2" fill="#4a4f5d"/>
  <rect x="81" y="64" width="5" height="18" rx="2" fill="#4a4f5d"/>
  <g fill="#ffffff" stroke="#a9c9a2" stroke-width="1.6">
    <circle cx="58" cy="40" r="16"/><circle cx="74" cy="46" r="15"/><circle cx="50" cy="54" r="14"/>
    <circle cx="68" cy="60" r="13"/><circle cx="82" cy="58" r="10"/><circle cx="42" cy="42" r="10"/>
  </g>
  <g fill="#ffffff"><circle cx="58" cy="40" r="14.4"/><circle cx="74" cy="46" r="13.4"/><circle cx="50" cy="54" r="12.4"/><circle cx="68" cy="60" r="11.4"/><circle cx="42" cy="42" r="8.4"/></g>
  <ellipse cx="25" cy="48" rx="10" ry="11" fill="#4a4f5d"/>
  <ellipse cx="16" cy="40" rx="5" ry="3.4" transform="rotate(-25 16 40)" fill="#4a4f5d"/>
  <circle cx="30" cy="38" r="6.5" fill="#ffffff"/>
  <circle cx="22" cy="46" r="2" fill="#ffffff"/><circle cx="22" cy="46" r="1" fill="#1d1d1d"/>
  <ellipse cx="17" cy="54" rx="2.2" ry="1.6" fill="#2a2d36"/>
`);

const STELLA = svg('#4b3a78', `
  ${stella(50, 55, 37, 15.5, '#f5c842')}
  ${scintilla(14, 14, 7)}${scintilla(86, 24, 5)}${scintilla(13, 84, 5)}${scintilla(88, 88, 7)}
`);

const ARCA = svg('#bfe3f5', `
  <path d="M8 62 L92 62 L82 84 L20 84 Z" fill="#8b5a2b"/>
  <rect x="30" y="43" width="40" height="19" fill="#d99e5c"/>
  <rect x="35" y="49" width="6" height="7" fill="#5a3a1c"/><rect x="47" y="49" width="6" height="7" fill="#5a3a1c"/><rect x="59" y="49" width="6" height="7" fill="#5a3a1c"/>
  <path d="M25 44 L50 23 L75 44 Z" fill="#c1693b"/>
  <path d="M0 78 C12 70 22 70 34 78 C46 86 56 86 68 78 C80 70 90 70 100 78 L100 100 L0 100 Z" fill="#2f7fc1"/>
  <path d="M0 86 C12 80 22 80 34 86 C46 92 56 92 68 86 C80 80 90 80 100 86" fill="none" stroke="#8ec5f0" stroke-width="2"/>
`);

const ARCOBALENO = svg('#fce6a0', `
  <path d="M8 70 A42 42 0 0 1 92 70 Z" fill="#d94a38"/>
  <path d="M14 70 A36 36 0 0 1 86 70 Z" fill="#f39a37"/>
  <path d="M20 70 A30 30 0 0 1 80 70 Z" fill="#e8b21c"/>
  <path d="M26 70 A24 24 0 0 1 74 70 Z" fill="#4ba046"/>
  <path d="M32 70 A18 18 0 0 1 68 70 Z" fill="#2f7fc1"/>
  <path d="M38 70 A12 12 0 0 1 62 70 Z" fill="#7a54b5"/>
  <path d="M43 70 A7 7 0 0 1 57 70 Z" fill="#fce6a0"/>
  <g fill="#ffffff">
    <circle cx="9" cy="72" r="8"/><circle cx="19" cy="73" r="7"/><circle cx="14" cy="66" r="6"/><rect x="4" y="72" width="22" height="8" rx="4"/>
    <circle cx="91" cy="72" r="8"/><circle cx="81" cy="73" r="7"/><circle cx="86" cy="66" r="6"/><rect x="74" y="72" width="22" height="8" rx="4"/>
  </g>
`);

function acino(x, y) {
  return `<circle cx="${x}" cy="${y}" r="8.6" fill="#6f3ea0"/><circle cx="${x - 2.6}" cy="${y - 2.6}" r="2" fill="#a98cd1"/>`;
}
const UVA = svg('#bfe6dd', `
  <rect x="47.5" y="12" width="5" height="18" rx="2" fill="#6b4423"/>
  <path d="M52 24 C60 13 74 13 85 19 C79 32 62 35 52 24 Z" fill="#4ba046"/>
  ${[31, 43, 55, 67].map(x => acino(x, 36)).join('')}
  ${[37, 49, 61].map(x => acino(x, 48)).join('')}
  ${[43, 55].map(x => acino(x, 60)).join('')}
  ${acino(49, 72)}
`);

function chicco(x, y, rot, colore) {
  return `<ellipse cx="${x}" cy="${y}" rx="4.6" ry="9.5" transform="rotate(${rot} ${x} ${y})" fill="${colore}"/>`;
}
const GRANO = svg('#c8d4ee', `
  <path d="M50 88 C34 86 20 72 17 52 C32 56 46 70 50 88 Z" fill="#6aa536"/>
  <path d="M50 88 C66 86 80 72 83 52 C68 56 54 70 50 88 Z" fill="#6aa536"/>
  <path d="M50 20 L50 92" stroke="#7aa63e" stroke-width="3" stroke-linecap="round"/>
  <path d="M50 14 L43 3 M50 14 L57 3 M50 14 L50 1" stroke="#e0a526" stroke-width="1.8" stroke-linecap="round"/>
  <ellipse cx="50" cy="24" rx="5" ry="10" fill="#e0a526"/>
  ${chicco(41, 36, -22, '#ecc04e')}${chicco(59, 36, 22, '#e0a526')}
  ${chicco(40, 50, -22, '#e0a526')}${chicco(60, 50, 22, '#ecc04e')}
  ${chicco(41, 64, -22, '#ecc04e')}${chicco(59, 64, 22, '#e0a526')}
`);

function raggio(angolo) {
  return `<rect x="47" y="6" width="6" height="14" rx="3" transform="rotate(${angolo} 50 50)" fill="#f39a37"/>`;
}
const SOLE = svg('#84b6e6', `
  ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(raggio).join('')}
  <circle cx="50" cy="50" r="23" fill="#f39a37"/>
  <circle cx="50" cy="50" r="19" fill="#f5c842"/>
`);

const LUNA = svg('#233c5f', `
  <circle cx="45" cy="55" r="33" fill="#f7e6a6"/>
  <circle cx="62" cy="42" r="29" fill="#233c5f"/>
  ${scintilla(78, 26, 7)}${scintilla(92, 40, 4)}${scintilla(82, 64, 7)}${scintilla(88, 86, 5)}
`);

const NUVOLA = svg('#70a6dc', `
  <g fill="#b8d4f2"><circle cx="80" cy="24" r="8"/><circle cx="88" cy="30" r="6"/><rect x="72" y="26" width="24" height="9" rx="4.5"/></g>
  <g fill="#ffffff"><circle cx="32" cy="58" r="14"/><circle cx="52" cy="46" r="21"/><circle cx="71" cy="60" r="13"/><rect x="14" y="58" width="68" height="22" rx="11"/></g>
  <rect x="24" y="68" width="48" height="8" rx="4" fill="#e1ecf8"/>
`);

const ALBERO = svg('#f5d6a8', `
  <ellipse cx="50" cy="90" rx="34" ry="6" fill="#9bcb62"/>
  <path d="M44 91 L47 56 L54 56 L57 91 Z" fill="#8b5a2b"/>
  <circle cx="50" cy="33" r="23" fill="#2e6b2e"/>
  <circle cx="31" cy="52" r="16" fill="#3f8f3a"/><circle cx="69" cy="52" r="16" fill="#3f8f3a"/>
  <circle cx="50" cy="52" r="17" fill="#52a040"/>
  <g fill="#d94a38"><circle cx="38" cy="38" r="3.4"/><circle cx="60" cy="30" r="3.4"/><circle cx="24" cy="54" r="3.4"/><circle cx="74" cy="48" r="3.4"/><circle cx="50" cy="56" r="3.4"/></g>
`);

const MONTAGNA = svg('#f7d4d9', `
  <path d="M2 84 L30 46 L58 84 Z" fill="#8a9ab0"/>
  <path d="M30 46 L22 58 L28 55 L33 60 L38 56 Z" fill="#ffffff"/>
  <path d="M28 84 L68 26 L104 84 Z" fill="#5d6f8a"/>
  <path d="M68 26 L57 43 L64 40 L69 46 L75 40 L80 44 Z" fill="#ffffff"/>
  <rect y="82" width="100" height="18" fill="#72ad60"/>
`);

const ANCORA = svg('#d7ebf4', `
  <g fill="#1f3a5f" stroke="#1f3a5f" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="50" cy="19" r="8" fill="none" stroke-width="5"/>
    <rect x="47" y="27" width="6" height="58" rx="3" stroke="none"/>
    <rect x="35" y="38" width="30" height="6" rx="3" stroke="none"/>
    <path d="M17 62 C20 80 36 90 50 90 C64 90 80 80 83 62" fill="none" stroke-width="6"/>
    <path d="M8 64 L21 44 L30 66 Z" stroke="none"/>
    <path d="M92 64 L79 44 L70 66 Z" stroke="none"/>
  </g>
`);

const CHIAVE = svg('#2f5c3a', `
  <g transform="rotate(-33 50 50)" fill="#e8b73a">
    <rect x="36" y="46" width="52" height="8" rx="2"/>
    <rect x="74" y="53" width="6" height="11" rx="1.5"/>
    <rect x="84" y="53" width="6" height="15" rx="1.5"/>
    <circle cx="25" cy="50" r="15"/>
    <circle cx="25" cy="50" r="6.4" fill="#2f5c3a"/>
  </g>
`);

const ROTOLO = svg('#a2cfc3', `
  <rect x="28" y="22" width="44" height="56" fill="#f6efd9" stroke="#c9a66b" stroke-width="2"/>
  <g fill="#9aa0a6">
    <rect x="34" y="33" width="32" height="3.2" rx="1.6"/><rect x="34" y="41" width="32" height="3.2" rx="1.6"/>
    <rect x="34" y="49" width="32" height="3.2" rx="1.6"/><rect x="34" y="57" width="20" height="3.2" rx="1.6"/>
    <rect x="34" y="65" width="26" height="3.2" rx="1.6"/>
  </g>
  <rect x="19" y="12" width="62" height="14" rx="7" fill="#d9b27a" stroke="#b88a4a" stroke-width="2"/>
  <rect x="19" y="74" width="62" height="14" rx="7" fill="#d9b27a" stroke="#b88a4a" stroke-width="2"/>
`);

const BROCCA = svg('#f2c4be', `
  <path d="M26 41 C9 38 7 63 24 67" fill="none" stroke="#c1693b" stroke-width="5.4" stroke-linecap="round"/>
  <path d="M74 41 C91 38 93 63 76 67" fill="none" stroke="#c1693b" stroke-width="5.4" stroke-linecap="round"/>
  <rect x="35" y="10" width="30" height="8" rx="4" fill="#a8532a"/>
  <rect x="41" y="16" width="18" height="14" fill="#c1693b"/>
  <path d="M41 29 C25 35 19 53 23 69 C27 83 40 91 50 91 C60 91 73 83 77 69 C81 53 75 35 59 29 Z" fill="#c1693b"/>
  <path d="M22 58 C40 65 60 65 78 58 L78 65 C60 72 40 72 22 65 Z" fill="#f2c24a"/>
  <path d="M28 80 C42 86 58 86 72 80" fill="none" stroke="#9a4f2a" stroke-width="3" stroke-linecap="round"/>
  <path d="M31 43 C29 50 29 56 31 62" fill="none" stroke="#e08a5a" stroke-width="3" stroke-linecap="round"/>
`);

const TENDA = svg('#e9dbf2', `
  <rect y="82" width="100" height="18" fill="#e6c88a"/>
  <path d="M50 24 L8 83 L50 83 Z" fill="#dfae6a"/>
  <path d="M50 24 L92 83 L50 83 Z" fill="#c68c45"/>
  <path d="M50 46 L41 83 L58 83 Z" fill="#5a3a1c"/>
  <rect x="48.6" y="10" width="3" height="16" fill="#5a3a1c"/>
  <path d="M51.6 10 L65 14 L51.6 19 Z" fill="#d94a38"/>
`);

const MELOGRANO = svg('#bcd8f0', `
  <path d="M66 34 C77 24 90 26 95 31 C90 40 75 42 66 34 Z" fill="#4ba046"/>
  <circle cx="50" cy="57" r="29" fill="#c8302a" stroke="#9a1f1f" stroke-width="3"/>
  <path d="M36 32 L39 19 L46 29 L50 17 L54 29 L61 19 L64 32 Z" fill="#a8201c"/>
  <rect x="35" y="30" width="30" height="5" rx="2.5" fill="#a8201c"/>
  <path d="M31 55 C33 46 39 41 46 40" fill="none" stroke="#e88a8a" stroke-width="4.2" stroke-linecap="round"/>
`);

const BASTONE = svg('#f6e5a7', `
  <path d="M0 88 C20 82 40 85 60 82 C80 85 90 82 100 86 L100 100 L0 100 Z" fill="#9bcb62"/>
  <path d="M70 94 L70 36 C70 16 50 13 41 22 C34 29 37 41 46 41" fill="none" stroke="#8b5a2b" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <g stroke="#4ba046" stroke-width="2" stroke-linecap="round">
    <path d="M13 92 L11 80 M18 92 L19 79 M23 92 L28 82"/>
    <path d="M86 92 L84 82 M91 92 L94 81 M96 92 L99 84"/>
  </g>
`);

// ---------- l'elenco ----------

// Nell'ordine in cui compaiono nel foglio di prova. "nome" serve a chi deve
// descrivere a voce: e' il nome che il primo giocatore usa, per esempio "la
// colomba su sfondo azzurro".
export const DISEGNI = {
  colomba:    { nome: 'Colomba',    svg: COLOMBA },
  pane:       { nome: 'Pane',       svg: PANE },
  pesce:      { nome: 'Pesce',      svg: PESCE },
  lampada:    { nome: 'Lampada',    svg: LAMPADA },
  agnello:    { nome: 'Agnello',    svg: AGNELLO },
  stella:     { nome: 'Stella',     svg: STELLA },
  arca:       { nome: 'Arca',       svg: ARCA },
  arcobaleno: { nome: 'Arcobaleno', svg: ARCOBALENO },
  uva:        { nome: 'Uva',        svg: UVA },
  grano:      { nome: 'Grano',      svg: GRANO },
  sole:       { nome: 'Sole',       svg: SOLE },
  luna:       { nome: 'Luna',       svg: LUNA },
  nuvola:     { nome: 'Nuvola',     svg: NUVOLA },
  albero:     { nome: 'Albero',     svg: ALBERO },
  montagna:   { nome: 'Montagna',   svg: MONTAGNA },
  ancora:     { nome: 'Àncora',     svg: ANCORA },
  chiave:     { nome: 'Chiave',     svg: CHIAVE },
  rotolo:     { nome: 'Rotolo',     svg: ROTOLO },
  brocca:     { nome: 'Brocca',     svg: BROCCA },
  tenda:      { nome: 'Tenda',      svg: TENDA },
  melograno:  { nome: 'Melograno',  svg: MELOGRANO },
  bastone:    { nome: 'Bastone',    svg: BASTONE }
};

export const ID_DISEGNI = Object.keys(DISEGNI);

// Il disegno di un identificativo; se l'identificativo non esiste (dato
// rovinato, versione diversa del gioco) restituisce un riquadro grigio
// invece di rompere la schermata.
const DISEGNO_DI_RIPIEGO = svg('#cfcfcf', '<circle cx="50" cy="50" r="18" fill="#ffffff"/>');

export function svgDisegno(id) {
  const d = Object.prototype.hasOwnProperty.call(DISEGNI, id) ? DISEGNI[id] : null;
  return d ? d.svg : DISEGNO_DI_RIPIEGO;
}

export function nomeDisegno(id) {
  const d = Object.prototype.hasOwnProperty.call(DISEGNI, id) ? DISEGNI[id] : null;
  return d ? d.nome : '';
}
