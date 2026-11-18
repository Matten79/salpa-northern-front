// Rakennus- ja tulitukikuvakkeet (SVG, väri currentColor)
const svg = body => `<svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  // Konekivääri jalustalla
  mg: svg(`
    <rect x="3" y="12.2" width="13" height="2.2" rx="1" stroke="none"/>
    <rect x="14" y="10" width="9" height="6" rx="1" stroke="none"/>
    <path d="M23 11 L29 12 L29 15 L23 15 Z" stroke="none"/>
    <rect x="15.5" y="16" width="5" height="4" rx=".6" stroke="none" opacity=".75"/>
    <path d="M18 18 L10 28 M18 18 L26 28 M18 18 L18 28" fill="none" stroke-width="2"/>
    <rect x="2" y="11.6" width="2" height="3.4" rx=".5" stroke="none"/>`),
  // Raskas kranaatinheitin: putki, kaksijalka ja pohjalevy
  mortar: svg(`
    <path d="M9 25 L22 5" fill="none" stroke-width="5"/>
    <path d="M20.2 4 L24.6 6.6" fill="none" stroke-width="2.4"/>
    <path d="M17 13 L13 27 M17 13 L22 27" fill="none" stroke-width="1.8"/>
    <path d="M17 19 L19.8 19" fill="none" stroke-width="1.6"/>
    <ellipse cx="9" cy="26.6" rx="6.5" ry="2.2" stroke="none"/>`),
  // Panssarintorjuntaohjus: putki, tähtäin ja jalusta
  atgm: svg(`
    <rect x="2" y="10" width="24" height="5.5" rx="2" stroke="none"/>
    <path d="M26 10.4 L30 9 L30 16.6 L26 15.2 Z" stroke="none"/>
    <rect x="11" y="5.5" width="7" height="4.5" rx="1" stroke="none"/>
    <circle cx="16.5" cy="7.7" r="1.1" fill="#0d141b" stroke="none"/>
    <path d="M15 15.5 L8 28 M15 15.5 L22 28 M15 15.5 L15 28" fill="none" stroke-width="1.8"/>`),
  // Ilmatorjunta: kaksoisputket ja tutka
  aa: svg(`
    <rect x="6" y="20" width="18" height="7" rx="1.5" stroke="none"/>
    <rect x="11" y="15" width="9" height="6" rx="1.2" stroke="none"/>
    <path d="M15 16 L26 4 M18.5 17.5 L29 7" fill="none" stroke-width="2"/>
    <path d="M4 7 Q8 12 4 17" fill="none" stroke-width="2.2"/>
    <path d="M5.5 12 L10 15" fill="none" stroke-width="1.5"/>
    <path d="M8 6.5 Q10.5 12 8 17.5" fill="none" stroke-width="1" opacity=".6"/>`),
  // Hammaskivet
  obstacle: svg(`
    <path d="M1.5 27 L7 14 L12.5 27 Z" stroke="none"/>
    <path d="M7 14 L12.5 27 L9.5 27 Z" stroke="none" opacity=".55" fill="#0d141b"/>
    <path d="M10.5 27 L16 11 L21.5 27 Z" stroke="none"/>
    <path d="M16 11 L21.5 27 L18.5 27 Z" stroke="none" opacity=".55" fill="#0d141b"/>
    <path d="M19.5 27 L25 14 L30.5 27 Z" stroke="none"/>
    <path d="M25 14 L30.5 27 L27.5 27 Z" stroke="none" opacity=".55" fill="#0d141b"/>
    <path d="M1 28.5 L31 28.5" fill="none" stroke-width="1.2" opacity=".6"/>`),
  // Panssarimiina ja varoituskyltti
  mine: svg(`
    <ellipse cx="13" cy="23" rx="11" ry="4.5" stroke="none"/>
    <rect x="2" y="19" width="22" height="4" stroke="none"/>
    <ellipse cx="13" cy="19" rx="11" ry="4.2" stroke="none" opacity=".75"/>
    <rect x="10.5" y="15" width="5" height="3.5" rx="1" stroke="none"/>
    <path d="M27 6 L27 26" fill="none" stroke-width="1.6"/>
    <path d="M22 4 L32 4 L27 12 Z" stroke-width="1"/>
    <path d="M27 6.2 L27 8.4" fill="none" stroke="#0d141b" stroke-width="1.4"/>`),
  // F-35 ylhäältä
  f35: svg(`
    <path d="M16 1.5 L18 7 L18.4 12 L29.5 19 L29.5 21.5 L18.4 18.5 L18 24.5 L22.5 28 L22.5 30 L16 28.5 L9.5 30 L9.5 28 L14 24.5 L13.6 18.5 L2.5 21.5 L2.5 19 L13.6 12 L14 7 Z" stroke="none"/>
    <path d="M15 6 L17 6 L16.6 10 L15.4 10 Z" fill="#0d141b" stroke="none" opacity=".6"/>`),
  // HIMARS: kuorma-auto ja ylös nostettu raketti-kasetti
  himars: svg(`
    <rect x="1.5" y="18" width="7" height="6" rx="1" stroke="none"/>
    <path d="M2.5 18 L3.5 14.5 L8.5 14.5 L8.5 18 Z" stroke="none" opacity=".8"/>
    <rect x="8.5" y="20" width="21" height="4" stroke="none"/>
    <path d="M12 20 L25 10 L29 15 L16 23 Z" stroke="none"/>
    <circle cx="5" cy="25.5" r="2.4" stroke="none"/>
    <circle cx="17" cy="25.5" r="2.4" stroke="none"/>
    <circle cx="24" cy="25.5" r="2.4" stroke="none"/>
    <path d="M27 9 L30.5 4.5" fill="none" stroke-width="1.6"/>
    <path d="M29 3 L31 5" fill="none" stroke-width="1" opacity=".6"/>`),
  // K9 Moukari: panssarihaupitsi
  k9: svg(`
    <rect x="2" y="17" width="20" height="7" rx="1.5" stroke="none"/>
    <rect x="6" y="12" width="12" height="6" rx="1.2" stroke="none"/>
    <path d="M16 14 L31 7" fill="none" stroke-width="2.6"/>
    <rect x="1" y="23.5" width="22" height="4" rx="2" stroke="none" opacity=".75"/>
    <circle cx="5" cy="25.5" r="1" fill="#0d141b" stroke="none"/><circle cx="12" cy="25.5" r="1" fill="#0d141b" stroke="none"/><circle cx="19" cy="25.5" r="1" fill="#0d141b" stroke="none"/>`),
  // NASAMS: ohjuskontit ja tutka
  nasams: svg(`
    <rect x="3" y="22" width="18" height="5" rx="1" stroke="none"/>
    <path d="M6 22 L10 9 L22 13 L18 22 Z" stroke="none"/>
    <path d="M9 13 L20 16.5 M8 17 L19 20" fill="none" stroke="#0d141b" stroke-width="1" opacity=".6"/>
    <path d="M22 12 L29 4" fill="none" stroke-width="1.4"/>
    <path d="M27.5 3 L30.5 4 L29 6.5 Z" stroke="none"/>
    <rect x="24" y="18" width="5" height="9" rx="1" stroke="none" opacity=".8"/>`),
  // Leopard 2A6
  leo: svg(`
    <path d="M2 19 L5 15 L25 15 L29 19 L27 24 L4 24 Z" stroke="none"/>
    <path d="M8 15 L10 10 L20 10 L22 15 Z" stroke="none"/>
    <path d="M20 12 L31 11" fill="none" stroke-width="2"/>
    <rect x="3" y="24" width="24" height="4" rx="2" stroke="none" opacity=".75"/>`),
  // Patria AMV
  amv: svg(`
    <path d="M2 21 L4 13 L22 13 L29 17 L29 22 L2 22 Z" stroke="none"/>
    <rect x="11" y="9" width="7" height="4" rx="1" stroke="none"/>
    <path d="M17 10.5 L26 10.5" fill="none" stroke-width="1.4"/>
    <circle cx="6" cy="24" r="2.6" stroke="none"/><circle cx="12" cy="24" r="2.6" stroke="none"/><circle cx="19" cy="24" r="2.6" stroke="none"/><circle cx="25" cy="24" r="2.6" stroke="none"/>`),
  // purku: lekahammer ja rikkoutunut kivi
  demolish: svg(`
    <path d="M6 27 L18 15" fill="none" stroke-width="3"/>
    <path d="M14 9 L20 3 L29 12 L23 18 Z" stroke="none"/>
    <path d="M3 29 L9 23 M2 22 L6 24 M10 30 L8 26" fill="none" stroke-width="1.6" opacity=".7"/>`),
  // henkilömiinat: pienet miinat ja varoituskolmio
  apmine: svg(`
    <ellipse cx="7" cy="25" rx="4.5" ry="2" stroke="none"/><rect x="2.5" y="22" width="9" height="3" stroke="none"/><ellipse cx="7" cy="22" rx="4.5" ry="1.8" stroke="none" opacity=".75"/>
    <ellipse cx="17" cy="27" rx="4.5" ry="2" stroke="none"/><rect x="12.5" y="24" width="9" height="3" stroke="none"/><ellipse cx="17" cy="24" rx="4.5" ry="1.8" stroke="none" opacity=".75"/>
    <path d="M26 7 L26 28" fill="none" stroke-width="1.6"/>
    <path d="M20 5 L32 5 L26 15 Z" stroke-width="1"/>
    <path d="M26 7.5 L26 10.5" fill="none" stroke="#0d141b" stroke-width="1.6"/>`),
  // ydinisku: säteilysymboli
  nuke: svg(`
    <circle cx="16" cy="16" r="14" fill="none" stroke-width="2"/>
    <circle cx="16" cy="16" r="2.6" stroke="none"/>
    <path d="M16 16 L9.5 4.8 A13 13 0 0 1 22.5 4.8 Z" stroke="none" transform="translate(0 1.2)"/>
    <path d="M16 16 L9.5 4.8 A13 13 0 0 1 22.5 4.8 Z" stroke="none" transform="rotate(120 16 16) translate(0 1.2)"/>
    <path d="M16 16 L9.5 4.8 A13 13 0 0 1 22.5 4.8 Z" stroke="none" transform="rotate(240 16 16) translate(0 1.2)"/>
    <circle cx="16" cy="16" r="5" fill="#0d141b" stroke="none" opacity=".9"/><circle cx="16" cy="16" r="2.6" stroke="none"/>`),
  // asetukset (ratas)
  gear: svg(`<circle cx="16" cy="16" r="5" fill="none" stroke-width="3"/><path d="M16 3v5M16 24v5M3 16h5M24 16h5M6.8 6.8l3.5 3.5M21.7 21.7l3.5 3.5M6.8 25.2l3.5-3.5M21.7 10.3l3.5-3.5" fill="none" stroke-width="3"/>`),
};
