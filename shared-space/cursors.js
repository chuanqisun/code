// ─── SVG CURSORS ─────────────────────────────────────────────
export const ARROW_SVG = `<svg viewBox="0 0 28 28" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.4"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
  <path
    d="M 5,2 L 5,21 L 9,17 L 12,24 A 1.8,1.8 0 0 0 15,22 L 12,15 L 18,15 Z"
    fill="white"
    stroke="white"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <path
    d="M 5,2 L 5,21 L 9,17 L 12,24 A 1.8,1.8 0 0 0 15,22 L 12,15 L 18,15 Z"
    fill="black"
  />
  </g>
</svg>`;
export const IBEAM_SVG = `<!-- Text Select / I-Beam Cursor (GNOME style) -->
<svg viewBox="0 0 28 28" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.4"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <path
      d="
        M 10,4 L 13,4 L 13,6 L 14,5 L 15,6 L 15,4 L 18,4
        L 18,6 L 15,6 L 15,22 L 18,22 L 18,24
        L 15,24 L 15,22 L 14,23 L 13,22 L 13,24 L 10,24
        L 10,22 L 13,22 L 13,6 L 10,6 Z
      "
      fill="white"
      stroke="white"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <path
      d="
        M 10,4 L 13,4 L 13,6 L 14,5 L 15,6 L 15,4 L 18,4
        L 18,6 L 15,6 L 15,22 L 18,22 L 18,24
        L 15,24 L 15,22 L 14,23 L 13,22 L 13,24 L 10,24
        L 10,22 L 13,22 L 13,6 L 10,6 Z
      "
      fill="black"
    />
  </g>
</svg>`;
