// Shared design tokens and SVG helpers for the profile assets.
// Clean futuristic AI: deep space base, glass panels, cyan to violet glow.

export const C = {
  void: "#050816",
  deep: "#0A1030",
  cyan: "#67E8F9",
  sky: "#38BDF8",
  violet: "#A78BFA",
  rose: "#F472B6",
  mint: "#5EEAD4",
  text: "#E6EAF7",
  muted: "#8B93B8",
  faint: "#4A5280",
};

export const SANS =
  "'Segoe UI Variable Display','SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,'Helvetica Neue',Arial,sans-serif";
export const MONO =
  "'JetBrains Mono','SF Mono','Cascadia Code',Menlo,Consolas,'DejaVu Sans Mono','Liberation Mono',monospace";

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Seeded PRNG so particle fields are identical on every build (no noisy git diffs).
export function rng(seed = 7) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Common <defs>: glow filters, glass gradients, beam gradient and dot grid.
export function baseDefs(id) {
  return `
  <filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter>
  <filter id="${id}-glow" x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="${id}-soft" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="12"/></filter>
  <linearGradient id="${id}-glass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.085"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.02"/>
  </linearGradient>
  <linearGradient id="${id}-edge" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.36"/>
    <stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0.07"/>
    <stop offset="1" stop-color="${C.cyan}" stop-opacity="0.22"/>
  </linearGradient>
  <linearGradient id="${id}-beam" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.violet}"/>
  </linearGradient>
  <pattern id="${id}-dots" width="24" height="24" patternUnits="userSpaceOnUse">
    <circle cx="1" cy="1" r="1" fill="#FFFFFF" fill-opacity="0.055"/>
  </pattern>`;
}

// Frosted glass panel: translucent fill, bright top-left edge, inner highlight line.
export function glass(id, x, y, w, h, r = 18) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${id}-glass)" stroke="url(#${id}-edge)" stroke-width="1"/>
  <path d="M${x + r} ${y + 1} H${x + w - r}" stroke="#FFFFFF" stroke-opacity="0.2" stroke-width="1"/>`;
}

// Slowly drifting aurora orbs: [cx, cy, r, color, opacity, dx, dy, durSeconds]
export function aurora(id, orbs) {
  return orbs
    .map(
      ([cx, cy, r, color, op, dx, dy, dur]) => `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}" filter="url(#${id}-blur)">
    <animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy};0 0" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
  </circle>`
    )
    .join("");
}

// Base card: rounded void background, aurora, dot grid, glass sheen. Content goes on top.
export function card(id, w, h, orbs, r = 24) {
  return `<clipPath id="${id}-clip"><rect width="${w}" height="${h}" rx="${r}"/></clipPath>
  <g clip-path="url(#${id}-clip)">
    <rect width="${w}" height="${h}" fill="${C.void}"/>
    ${aurora(id, orbs)}
    <rect width="${w}" height="${h}" fill="url(#${id}-dots)"/>
  </g>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="url(#${id}-edge)"/>`;
}

export const frame = (w, h, label, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
${body}
</svg>
`;

// Greedy word wrap by character budget (good enough for short descriptions).
export function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    if ((line + " " + word).trim().length > max) {
      if (line) lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}
