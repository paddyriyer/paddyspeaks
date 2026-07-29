/**
 * Inline icon set, drawn in the Lucide idiom (1.5px stroke, 24px grid) so the
 * prototype has no runtime dependency on an icon package or a CDN.
 */

import { raw } from '../dom.js';

const paths = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  users: '<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.85"/><path d="M16 3.15A4 4 0 0 1 16 11"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M2 13h20"/>',
  book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v18H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M8 7h7"/><path d="M8 11h7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  sparkline: '<path d="M3 17l4-6 4 3 5-8 5 5"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  arrowRight: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  bookmark: '<path d="M6 4h12v17l-6-4.5L6 21z"/>',
  bookmarkFilled: '<path d="M6 4h12v17l-6-4.5L6 21z" fill="currentColor"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  x: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4"/><path d="M12 17.2h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  trend: '<path d="M3 16l6-6 4 4 8-8"/><path d="M15 6h6v6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  filter: '<path d="M3 5h18"/><path d="M7 12h10"/><path d="M10 19h4"/>',
  quote: '<path d="M9 7H5v5h4c0 3-1.5 4.5-4 5"/><path d="M19 7h-4v5h4c0 3-1.5 4.5-4 5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/>',
  link: '<path d="M10 13a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 11a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.75"/>',
  eyeOff: '<path d="M4 4l16 16"/><path d="M9.5 6.3A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.7 3.4"/><path d="M6.4 8A17 17 0 0 0 2 12s3.5 6 10 6a9.5 9.5 0 0 0 3.3-.55"/>',
  lightbulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 1 4 10.5V15H8v-1.5A6 6 0 0 1 12 3z"/>',
  send: '<path d="M21 4 3 11l7 2.5L12.5 21z"/><path d="m10 14 11-10"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  slash: '<circle cx="12" cy="12" r="9"/><path d="m6 18 12-12"/>',
  gauge: '<path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 14 4-4"/>',
};

/** Render an icon. `size` is a px number; stroke stays optically consistent. */
export function icon(name, size = 16) {
  const body = paths[name];
  if (!body) return raw('');
  return raw(
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" `
    + `stroke="currentColor" stroke-width="1.6" stroke-linecap="round" `
    + `stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
  );
}
