// Builds the animated SVGs that don't depend on live data:
//   assets/hero.svg          name, typing agent log, particles, orbiting agent core
//   assets/divider.svg       glowing section divider with a travelling pulse
//   assets/architecture.svg  animated MCP agent loop + RAG-with-evals pipeline
// Run: node scripts/build-static.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { C, SANS, MONO, esc, rng, baseDefs, glass, card, frame } from "./theme.mjs";

mkdirSync("assets", { recursive: true });
const f = (n) => +n.toFixed(4);

/* ------------------------------------------------------------------ hero */
function hero() {
  const W = 1200, H = 420, id = "h";
  const rand = rng(394);

  // Constellation: twinkling points, faint links between near neighbours.
  const pts = Array.from({ length: 48 }, () => [rand() * W, rand() * H, 0.6 + rand() * 1.4]);
  let links = "";
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
      if (d < 105) links += `<line x1="${f(pts[i][0])}" y1="${f(pts[i][1])}" x2="${f(pts[j][0])}" y2="${f(pts[j][1])}" stroke="${C.cyan}" stroke-opacity="${f(0.13 * (1 - d / 105))}"/>`;
    }
  const stars = pts
    .map(([x, y, r]) => {
      const dur = (2.5 + rand() * 4).toFixed(2), beg = (-rand() * 6).toFixed(2), lo = (0.12 + rand() * 0.2).toFixed(2);
      return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#FFFFFF"><animate attributeName="opacity" values="${lo};0.9;${lo}" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/></circle>`;
    })
    .join("");

  // Rising particles, like data floating up through the scene.
  const rising = Array.from({ length: 14 }, () => {
    const x = rand() * W, dur = 10 + rand() * 14, beg = -rand() * dur, col = rand() > 0.5 ? C.cyan : C.violet;
    return `<circle cx="${f(x)}" r="${f(1 + rand() * 1.6)}" fill="${col}" filter="url(#${id}-glow)">
      <animate attributeName="cy" from="${H + 10}" to="-10" dur="${f(dur)}s" begin="${f(beg)}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0.85;0" dur="${f(dur)}s" begin="${f(beg)}s" repeatCount="indefinite"/>
    </circle>`;
  }).join("");

  // Typing agent log: each phrase is clipped by a rect whose width steps one character at a time.
  const phrases = [
    "building agents that act on real systems",
    "shipping MCP servers that give assistants tools",
    "measuring RAG with evals, not guesses",
    "writing for 10K+ developers every month",
  ];
  const CW = 10.8, X0 = 124, BASE = 340, SLOT = 4.6, T = SLOT * phrases.length;
  const TYPE = 1.8, HOLD_END = 3.8, ERASE = 0.45;
  const events = []; // [t, phrase, chars]
  phrases.forEach((p, i) => {
    const s = i * SLOT, n = p.length;
    for (let k = 1; k <= n; k++) events.push([s + (TYPE * k) / n, i, k]);
    for (let k = n - 1; k >= 0; k--) events.push([s + HOLD_END + (ERASE * (n - k)) / n, i, k]);
  });
  events.unshift([0, 0, 0]);
  const kt = (t) => +(t / T).toFixed(6);

  const clips = phrases
    .map((p, i) => {
      const ev = events.filter((e) => e[1] === i);
      const times = [0, ...ev.map((e) => kt(e[0]))];
      const vals = [0, ...ev.map((e) => f(e[2] * CW))];
      // dedupe a leading duplicate 0 time
      if (times[1] === 0) { times.shift(); vals.shift(); }
      return `<clipPath id="${id}-type${i}"><rect x="${X0}" y="${BASE - 22}" height="30" width="0">
        <animate attributeName="width" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${times.join(";")}" values="${vals.join(";")}"/>
      </rect></clipPath>`;
    })
    .join("");
  const texts = phrases
    .map((p, i) => `<text x="${X0}" y="${BASE}" textLength="${f(p.length * CW)}" lengthAdjust="spacingAndGlyphs" clip-path="url(#${id}-type${i})" font-family="${MONO}" font-size="18" fill="${C.text}">${esc(p)}</text>`)
    .join("");
  const caretT = events.map((e) => kt(e[0])), caretX = events.map((e) => f(X0 + 2 + e[2] * CW));
  const caret = `<rect y="${BASE - 17}" width="9" height="21" rx="1.5" fill="${C.cyan}" x="${X0 + 2}">
      <animate attributeName="x" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${caretT.join(";")}" values="${caretX.join(";")}"/>
      <animate attributeName="opacity" values="1;0" keyTimes="0;0.5" calcMode="discrete" dur="1s" repeatCount="indefinite"/>
    </rect>`;

  // Agent core: glowing LLM core, counter-rotating rings, comet sweep, satellites with data packets.
  const cx = 942, cy = 214, R = 150;
  const sats = [["MCP", -52], ["RAG", 38], ["Evals", 128], ["Tools", 218]].map(([label, deg], i) => {
    const a = (deg * Math.PI) / 180, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    const w = 20 + label.length * 10.5;
    const sx = cx + 58 * Math.cos(a), sy = cy + 58 * Math.sin(a);
    const ex = x - (w / 2 + 4) * Math.cos(a) * 0.9, ey = y - 20 * Math.sin(a) * 0.9;
    const dur = 2.6 + i * 0.35;
    return `
    <line x1="${f(sx)}" y1="${f(sy)}" x2="${f(ex)}" y2="${f(ey)}" stroke="url(#${id}-beam)" stroke-opacity="0.45" stroke-dasharray="3 5"/>
    <circle r="3.2" fill="${i % 2 ? C.violet : C.cyan}" filter="url(#${id}-glow)">
      <animateMotion dur="${dur}s" begin="${-i * 0.7}s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" path="M${f(sx)} ${f(sy)} L${f(ex)} ${f(ey)}"/>
    </circle>
    <g transform="translate(${f(x - w / 2)} ${f(y - 17)})">
      <rect width="${f(w)}" height="34" rx="17" fill="${C.deep}" fill-opacity="0.75"/>
      <rect width="${f(w)}" height="34" rx="17" fill="url(#${id}-glass)" stroke="url(#${id}-edge)"/>
      <text x="${f(w / 2)}" y="22.5" text-anchor="middle" font-family="${SANS}" font-size="15" font-weight="600" fill="${C.text}">${label}</text>
    </g>`;
  }).join("");

  const core = `
  <radialGradient id="${id}-core" cx="0.42" cy="0.38" r="0.7">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.35" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.violet}"/>
  </radialGradient>`;

  const body = `<defs>${baseDefs(id)}${core}${clips}</defs>
  ${card(id, W, H, [
    [1000, 90, 210, C.cyan, 0.28, -40, 30, 18],
    [210, 430, 240, C.violet, 0.32, 50, -30, 22],
    [640, -40, 160, C.rose, 0.16, -30, 25, 26],
  ], 28)}
  <g clip-path="url(#${id}-clip)">${links}${stars}${rising}</g>

  <g transform="translate(72 70)">
    <rect width="356" height="32" rx="16" fill="url(#${id}-glass)" stroke="url(#${id}-edge)"/>
    <circle cx="20" cy="16" r="4.5" fill="${C.mint}"><animate attributeName="opacity" values="1;0.35;1" dur="2s" repeatCount="indefinite"/></circle>
    <circle cx="20" cy="16" r="4.5" fill="none" stroke="${C.mint}"><animate attributeName="r" values="4.5;11" dur="2s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values="0.7;0" dur="2s" repeatCount="indefinite"/></circle>
    <text x="36" y="21" font-family="${SANS}" font-size="14" fill="${C.text}">Open to AI Engineer and full-stack roles</text>
  </g>

  <linearGradient id="${id}-name" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#CFF6FF"/>
  </linearGradient>
  <text x="70" y="182" font-family="${SANS}" font-size="66" font-weight="700" letter-spacing="-1.5" fill="url(#${id}-name)">Saurabh Pathak</text>
  <text x="72" y="224" font-family="${SANS}" font-size="23" fill="${C.muted}">AI Engineer and Full-Stack Developer</text>

  <g>
    ${glass(id, 72, 264, 610, 104, 16)}
    <circle cx="94" cy="286" r="4.5" fill="${C.rose}" fill-opacity="0.8"/>
    <circle cx="110" cy="286" r="4.5" fill="${C.violet}" fill-opacity="0.8"/>
    <circle cx="126" cy="286" r="4.5" fill="${C.cyan}" fill-opacity="0.8"/>
    <text x="664" y="290" text-anchor="end" font-family="${MONO}" font-size="12" fill="${C.faint}">agent.log</text>
    <text x="96" y="${BASE}" font-family="${MONO}" font-size="18" font-weight="700" fill="${C.cyan}">❯</text>
    ${texts}${caret}
  </g>

  <g>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#FFFFFF" stroke-opacity="0.09"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="url(#${id}-beam)" stroke-width="2" stroke-linecap="round" stroke-dasharray="150 793" filter="url(#${id}-glow)">
      <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="9s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${cx}" cy="${cy}" r="104" fill="none" stroke="${C.violet}" stroke-opacity="0.45" stroke-dasharray="2 9">
      <animateTransform attributeName="transform" type="rotate" from="360 ${cx} ${cy}" to="0 ${cx} ${cy}" dur="40s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${cx}" cy="${cy}" r="78" fill="none" stroke="${C.cyan}" stroke-opacity="0.18"/>
    <circle cx="${cx}" cy="${cy}" r="70" fill="${C.cyan}" opacity="0.35" filter="url(#${id}-soft)">
      <animate attributeName="r" values="62;80;62" dur="3.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.25;0.5;0.25" dur="3.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${cx}" cy="${cy}" r="50" fill="url(#${id}-core)"/>
    <text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="${MONO}" font-size="16" font-weight="700" fill="${C.void}">LLM</text>
    ${sats}
  </g>`;
  return frame(W, H, "Saurabh Pathak, AI Engineer and Full-Stack Developer. Builds AI agents, MCP servers and RAG pipelines measured with evals.", body);
}

/* --------------------------------------------------------------- divider */
function divider() {
  const W = 1200, H = 36, id = "d";
  return frame(W, H, "", `<defs>${baseDefs(id)}
    <linearGradient id="${id}-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/>
      <stop offset="0.25" stop-color="${C.cyan}" stop-opacity="0.55"/>
      <stop offset="0.75" stop-color="${C.violet}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${C.violet}" stop-opacity="0"/>
    </linearGradient></defs>
  <rect x="0" y="17.5" width="${W}" height="1" fill="url(#${id}-line)"/>
  <ellipse cy="18" rx="60" ry="3" fill="${C.cyan}" filter="url(#${id}-glow)" opacity="0.9">
    <animate attributeName="cx" values="-80;${W + 80}" dur="6s" repeatCount="indefinite" calcMode="spline" keyTimes="0;1" keySplines="0.6 0 0.4 1"/>
  </ellipse>
  <circle cy="18" r="2.5" fill="#FFFFFF">
    <animate attributeName="cx" values="-20;${W + 140}" dur="6s" repeatCount="indefinite" calcMode="spline" keyTimes="0;1" keySplines="0.6 0 0.4 1"/>
  </circle>`).replace(/<title><\/title>\n/, "");
}

/* ---------------------------------------------------------- architecture */
function architecture() {
  const W = 1200, H = 540, id = "a", CYCLE = 7;
  const NW = 152, NH = 84, LEFT = 48, GAP = (W - LEFT * 2 - NW * 6) / 5;
  const nx = (i) => LEFT + i * (NW + GAP);

  // A packet that only moves inside [a, b] of the shared cycle, invisible otherwise.
  const packet = (d, a, b, color) => `<circle r="4" fill="${color}" filter="url(#${id}-glow)" opacity="0">
      <animateMotion dur="${CYCLE}s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;${a};${b};1" path="${d}"/>
      <animate attributeName="opacity" dur="${CYCLE}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${a};${b}" values="0;1;0"/>
    </circle>`;
  // Node border lights up when a packet arrives at time a.
  const pulse = (x, y, a, color) => {
    const e = Math.min(a + 0.08, 0.999);
    return `<rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="14" fill="none" stroke="${color}" stroke-width="1.5" opacity="0" filter="url(#${id}-glow)">
      <animate attributeName="opacity" dur="${CYCLE}s" repeatCount="indefinite" keyTimes="0;${f(Math.max(a - 0.001, 0))};${f(a + 0.01)};${f(e)};1" values="0;0;1;0;0"/>
    </rect>`;
  };

  function lane(y, title, sub, nodes, accentLast, start, back) {
    let out = `<text x="${LEFT}" y="${y - 38}" font-family="${SANS}" font-size="19" font-weight="600" fill="${C.text}">${esc(title)}</text>
      <text x="${LEFT}" y="${y - 16}" font-family="${SANS}" font-size="13.5" fill="${C.muted}">${esc(sub)}</text>`;
    const step = 0.075;
    nodes.forEach(([t, s], i) => {
      const x = nx(i), last = i === nodes.length - 1, color = last && accentLast ? C.rose : i % 2 ? C.violet : C.cyan;
      out += `<rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="14" fill="${C.deep}" fill-opacity="0.7"/>
        ${glass(id, x, y, NW, NH, 14)}
        ${last && accentLast ? `<rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="14" fill="none" stroke="${C.rose}" stroke-opacity="0.55"/>` : ""}
        <circle cx="${x + 16}" cy="${y + 18}" r="3" fill="${color}"/>
        <text x="${x + NW / 2}" y="${y + 43}" text-anchor="middle" font-family="${SANS}" font-size="16" font-weight="600" fill="${C.text}">${esc(t)}</text>
        <text x="${x + NW / 2}" y="${y + 64}" text-anchor="middle" font-family="${SANS}" font-size="12.5" fill="${C.muted}">${esc(s)}</text>
        ${pulse(x, y, f(start + i * step), color)}`;
      if (!last) {
        const x1 = x + NW + 6, x2 = nx(i + 1) - 8, cy = y + NH / 2, d = `M${f(x1)} ${cy} L${f(x2)} ${cy}`;
        out += `<path d="${d}" stroke="${C.violet}" stroke-opacity="0.6" stroke-width="1.5" marker-end="url(#${id}-arrow)"/>
          ${packet(d, f(start + i * step), f(start + (i + 1) * step), i % 2 ? C.violet : C.cyan)}`;
      }
    });
    // Return / feedback path under the lane.
    const [fromI, toI, label, color] = back;
    const fx = nx(fromI) + NW / 2, tx = nx(toI) + NW / 2, by = y + NH, ly = by + 40;
    const d = `M${f(fx)} ${by + 4} V${ly - 12} Q${f(fx)} ${ly} ${f(fx - 12)} ${ly} H${f(tx + 12)} Q${f(tx)} ${ly} ${f(tx)} ${ly - 12} V${by + 8}`;
    const a = f(start + (nodes.length - 1) * step + 0.02), b = f(a + 0.12);
    out += `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="0.5" stroke-width="1.3" stroke-dasharray="4 6" marker-end="url(#${id}-arrow-${color === C.rose ? "r" : "v"})">
        <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="2s" repeatCount="indefinite"/>
      </path>
      <rect x="${f((fx + tx) / 2 - label.length * 3.5 - 12)}" y="${ly - 11}" width="${f(label.length * 7 + 24)}" height="22" rx="11" fill="${C.void}" fill-opacity="0.85"/>
      <text x="${f((fx + tx) / 2)}" y="${ly + 4.5}" text-anchor="middle" font-family="${SANS}" font-size="13" fill="${color}">${esc(label)}</text>
      ${packet(d, a, b, color)}`;
    return out;
  }

  const marker = (mid, color) => `<marker id="${mid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker>`;

  const body = `<defs>${baseDefs(id)}${marker(`${id}-arrow`, C.violet)}${marker(`${id}-arrow-r`, C.rose)}${marker(`${id}-arrow-v`, C.violet)}</defs>
  ${card(id, W, H, [
    [120, 80, 200, C.cyan, 0.18, 40, 20, 20],
    [1080, 520, 220, C.violet, 0.22, -40, -20, 24],
    [1100, 60, 150, C.rose, 0.1, -20, 30, 28],
  ], 28)}
  ${lane(108, "Agent loop over MCP", "How an assistant reaches real systems through typed tools", [
    ["You", "ask in plain words"],
    ["LLM agent", "plans, picks a tool"],
    ["MCP client", "JSON-RPC calls"],
    ["MCP server", "mcp-notes-server"],
    ["Typed tools", "6 tools, schemas"],
    ["Notes store", "searchable notes"],
  ], false, 0.02, [5, 1, "results return as context", C.violet])}
  ${lane(374, "RAG pipeline, measured with evals", "Retrieval tuned by scores instead of guesses", [
    ["Documents", "markdown and PDFs"],
    ["Chunking", "split with overlap"],
    ["Embeddings", "text to vectors"],
    ["Vector store", "similarity search"],
    ["Generate", "answer from top-k"],
    ["Evals", "faithfulness, recall"],
  ], true, 0.45, [5, 1, "scores tune chunking, prompts and k", C.rose])}`;
  return frame(W, H, "Architecture: an LLM agent calls typed tools on an MCP server, and a RAG pipeline from documents to evals whose scores feed back into chunking and prompts.", body);
}

writeFileSync("assets/hero.svg", hero());
writeFileSync("assets/divider.svg", divider());
writeFileSync("assets/architecture.svg", architecture());
console.log("built hero.svg, divider.svg, architecture.svg");
