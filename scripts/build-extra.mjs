// Builds the personality cards (edit the CONTENT block, then run: node scripts/build-extra.mjs)
//   assets/about.svg    animated terminal "about me"
//   assets/now.svg      "Currently" card: building / learning / reading
//   assets/playing.svg  "On repeat" equalizer card
//   assets/skills.svg   animated skill bars
import { writeFileSync, mkdirSync } from "node:fs";
import { C, SANS, MONO, esc, baseDefs, glass, card, frame } from "./theme.mjs";

mkdirSync("assets", { recursive: true });
const f = (n) => +n.toFixed(3);

/* ------------------------------------------------------------- CONTENT */
const ABOUT = [
  ["whoami", "saurabh pathak | AI engineer and full-stack developer"],
  ["cat focus.txt", "agents that act on real systems, MCP servers, RAG measured with evals"],
  ["ls projects/", "mcp-notes-server  ai-engineer-roadmap  mcp-safe-actions"],
  ["echo $STATUS", "open to AI engineer and full-stack roles. say hi :)"],
];
const NOW = [
  ["Building", "MCP servers with safe, approval-gated tool actions", C.cyan],
  ["Learning", "agent evals and reliable tool use in RAG pipelines", C.violet],
  ["Reading", "the Model Context Protocol spec and open-source agent code", C.rose],
];
const TRACK = { title: "Lofi coding beats", artist: "On repeat while I ship", note: "edit TRACK in scripts/build-extra.mjs" };
const SKILLS = [
  ["TypeScript / Node.js", 90, C.cyan],
  ["Python / FastAPI", 85, C.violet],
  ["React / Next.js", 88, C.cyan],
  ["MCP and AI agents", 82, C.violet],
  ["RAG and evals", 78, C.cyan],
  ["Docker / CI / Cloud", 72, C.violet],
];

/* --------------------------------------------------------------- about */
function about() {
  const W = 1200, H = 372, id = "ab", CW = 9.6, X0 = 70, CYCLE = 16;
  let y = 104, body = "", t = 0.4;
  ABOUT.forEach(([cmd, out]) => {
    const cmdW = (cmd.length + 2) * CW, outW = out.length * CW;
    const reveal = (x, w, y, start, dur, text, fill, weight = 400) => {
      const a = f(start / CYCLE), b = f((start + dur) / CYCLE);
      const cid = `${id}c${Math.round(start * 10)}`;
      return `<clipPath id="${cid}"><rect x="${x}" y="${y - 20}" height="28" width="0"><animate attributeName="width" dur="${CYCLE}s" repeatCount="indefinite" calcMode="linear" keyTimes="0;${a};${b};1" values="0;0;${f(w)};${f(w)}"/></rect></clipPath>
      <text x="${x}" y="${y}" textLength="${f(w)}" lengthAdjust="spacingAndGlyphs" clip-path="url(#${cid})" font-family="${MONO}" font-size="16" font-weight="${weight}" fill="${fill}">${text}</text>`;
    };
    body += `<text x="${X0}" y="${y}" font-family="${MONO}" font-size="16" font-weight="700" fill="${C.cyan}">$</text>`;
    body += reveal(X0 + 22, cmdW, y, t, 0.7, esc(cmd), C.text, 700);
    t += 0.9;
    body += reveal(X0 + 22, outW, y + 28, t, 1.1, esc(out), C.muted);
    t += 1.3;
    y += 64;
  });
  const caretY = y - 64 + 28;
  const body2 = `<defs>${baseDefs(id)}</defs>
  ${card(id, W, H, [[1050, 40, 200, C.violet, 0.22, -40, 30, 22], [150, 330, 220, C.cyan, 0.16, 40, -20, 26]], 24)}
  ${glass(id, 28, 24, W - 56, H - 48, 18)}
  <circle cx="58" cy="52" r="5.5" fill="${C.rose}" fill-opacity="0.85"/><circle cx="78" cy="52" r="5.5" fill="${C.violet}" fill-opacity="0.85"/><circle cx="98" cy="52" r="5.5" fill="${C.cyan}" fill-opacity="0.85"/>
  <text x="${W / 2}" y="57" text-anchor="middle" font-family="${MONO}" font-size="13" fill="${C.faint}">saurabh@portfolio: ~/about</text>
  <line x1="28" y1="72" x2="${W - 28}" y2="72" stroke="#FFFFFF" stroke-opacity="0.08"/>
  ${body}
  <rect x="${X0 + 22 + ABOUT[ABOUT.length - 1][1].length * CW + 6}" y="${caretY - 16}" width="9" height="20" rx="1.5" fill="${C.cyan}"><animate attributeName="opacity" values="1;0" keyTimes="0;0.5" calcMode="discrete" dur="1s" repeatCount="indefinite"/></rect>`;
  return frame(W, H, "Terminal about me: Saurabh Pathak, AI engineer and full-stack developer focused on agents, MCP servers and RAG with evals, open to roles.", body2);
}

/* ----------------------------------------------------------------- now */
function now() {
  const W = 600, H = 250, id = "n";
  const rows = NOW.map(([k, v, col], i) => {
    const y = 84 + i * 52;
    return `<g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${0.2 + i * 0.25}s" dur="0.6s" fill="freeze"/>
      <circle cx="40" cy="${y - 5}" r="4" fill="${col}" filter="url(#${id}-glow)"><animate attributeName="opacity" values="1;0.35;1" dur="${2 + i * 0.4}s" repeatCount="indefinite"/></circle>
      <text x="56" y="${y}" font-family="${SANS}" font-size="12.5" font-weight="700" letter-spacing="1.5" fill="${col}">${k.toUpperCase()}</text>
      <text x="56" y="${y + 21}" font-family="${SANS}" font-size="14" fill="${C.text}">${esc(v)}</text></g>`;
  }).join("");
  return frame(W, H, "Currently: building MCP servers with approval-gated actions, learning agent evals, reading the MCP spec.", `<defs>${baseDefs(id)}</defs>
  ${card(id, W, H, [[520, 20, 130, C.cyan, 0.22, -20, 20, 18], [60, 260, 140, C.violet, 0.22, 20, -20, 22]], 22)}
  <text x="32" y="44" font-family="${SANS}" font-size="17" font-weight="700" fill="${C.text}">Currently</text>
  <text x="568" y="44" text-anchor="end" font-family="${MONO}" font-size="12" fill="${C.faint}">updated by hand</text>
  <line x1="32" y1="58" x2="568" y2="58" stroke="#FFFFFF" stroke-opacity="0.08"/>${rows}`);
}

/* ------------------------------------------------------------- playing */
function playing() {
  const W = 600, H = 250, id = "p";
  const bars = Array.from({ length: 22 }, (_, i) => {
    const x = 40 + i * 24, base = 150, hmax = 30 + ((i * 37) % 50), dur = f(0.55 + ((i * 13) % 9) / 10), col = i % 2 ? C.violet : C.cyan;
    return `<rect x="${x}" width="14" rx="4" fill="${col}" fill-opacity="0.9" y="${base}" height="8">
      <animate attributeName="height" values="8;${hmax};12;${hmax * 0.6};8" dur="${dur}s" repeatCount="indefinite"/>
      <animate attributeName="y" values="${base};${base - hmax + 8};${base - 4};${f(base - hmax * 0.6 + 8)};${base}" dur="${dur}s" repeatCount="indefinite"/></rect>`;
  }).join("");
  return frame(W, H, `On repeat: ${TRACK.title}`, `<defs>${baseDefs(id)}</defs>
  ${card(id, W, H, [[300, 250, 200, C.violet, 0.25, 30, -20, 20], [560, 40, 120, C.rose, 0.18, -20, 20, 24]], 22)}
  <text x="32" y="44" font-family="${SANS}" font-size="17" font-weight="700" fill="${C.text}">On repeat</text>
  <g transform="translate(560 38)"><circle r="4" fill="${C.mint}"><animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite"/></circle></g>
  <line x1="32" y1="58" x2="568" y2="58" stroke="#FFFFFF" stroke-opacity="0.08"/>
  <g transform="translate(0 -4)">${bars}</g>
  <text x="32" y="200" font-family="${SANS}" font-size="18" font-weight="600" fill="${C.text}">${esc(TRACK.title)}</text>
  <text x="32" y="224" font-family="${SANS}" font-size="13.5" fill="${C.muted}">${esc(TRACK.artist)}</text>`);
}

/* -------------------------------------------------------------- skills */
function skills() {
  const W = 1200, H = 60 + Math.ceil(SKILLS.length / 2) * 62 + 20, id = "k", BW = 440;
  const rows = SKILLS.map(([name, pct, col], i) => {
    const colN = i % 2, row = Math.floor(i / 2), x = 48 + colN * 570, y = 92 + row * 62;
    const w = f((BW * pct) / 100);
    return `<text x="${x}" y="${y - 12}" font-family="${SANS}" font-size="15" font-weight="600" fill="${C.text}">${esc(name)}</text>
      <text x="${x + BW}" y="${y - 12}" text-anchor="end" font-family="${MONO}" font-size="13" fill="${C.muted}">${pct}%</text>
      <rect x="${x}" y="${y}" width="${BW}" height="10" rx="5" fill="#FFFFFF" fill-opacity="0.06"/>
      <rect x="${x}" y="${y}" width="0" height="10" rx="5" fill="${col}" filter="url(#${id}-glow)">
        <animate attributeName="width" from="0" to="${w}" begin="${0.2 + i * 0.15}s" dur="1.2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.8 0.2 1"/></rect>
      <circle cy="${y + 5}" r="3" fill="#FFFFFF" opacity="0"><animate attributeName="cx" from="${x}" to="${x + w}" begin="${0.2 + i * 0.15}s" dur="1.2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.8 0.2 1"/><animate attributeName="opacity" values="0;1;0" keyTimes="0;0.5;1" begin="${0.2 + i * 0.15}s" dur="1.3s" fill="freeze"/></circle>`;
  }).join("");
  return frame(W, H, "Skill levels: " + SKILLS.map((s) => `${s[0]} ${s[1]}%`).join(", "), `<defs>${baseDefs(id)}</defs>
  ${card(id, W, H, [[1100, 30, 160, C.cyan, 0.16, -30, 20, 20], [100, H, 180, C.violet, 0.2, 30, -20, 24]], 22)}
  <text x="48" y="44" font-family="${SANS}" font-size="17" font-weight="700" fill="${C.text}">Skill levels</text>
  <text x="${W - 48}" y="44" text-anchor="end" font-family="${MONO}" font-size="12" fill="${C.faint}">self-assessed, in daily use</text>
  ${rows}`);
}

writeFileSync("assets/about.svg", about());
writeFileSync("assets/now.svg", now());
writeFileSync("assets/playing.svg", playing());
writeFileSync("assets/skills.svg", skills());
console.log("built about.svg, now.svg, playing.svg, skills.svg");
