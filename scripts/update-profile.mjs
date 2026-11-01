// Refreshes everything on the profile that depends on live data:
//   assets/stats.svg, assets/langs.svg, assets/project-<repo>.svg
//   README sections between <!-- OSS:START/END --> and <!-- BLOG-POSTS:START/END -->
//
// Env: GH_TOKEN (required for live data), GH_LOGIN (defaults to techsaurabh-394)
// Flags: --pending   write "syncing" cards without calling any API (used for the first commit)
//        --sample    write cards from built-in sample numbers into ./preview (design check only)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { C, SANS, MONO, esc, baseDefs, card, frame, wrap } from "./theme.mjs";

/* ------------------------------------------------------------ settings */
const LOGIN = process.env.GH_LOGIN || "techsaurabh-394";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const FEED = process.env.BLOG_FEED || "https://mernstackdev.com/feed/";
const BLOG_COUNT = 5;
const OSS_COUNT = 8;
// Notebook output and generated markup swamp the byte counts, so they're left out of the chart.
const EXCLUDE_LANGS = ["Jupyter Notebook"];
// Cards shown under "Featured projects". The description here wins over the repo description.
const FEATURED = [
  {
    repo: "mcp-notes-server",
    description: "TypeScript MCP server that gives AI assistants a searchable notes store, exposed as 6 typed tools.",
    accent: C.cyan,
  },
  {
    repo: "ai-engineer-roadmap",
    description: "AI engineering from zero to production: 100 topics on RAG, LLMs, agents and MCP, with runnable Python, diagrams and interview questions.",
    accent: C.violet,
  },
];
const PALETTE = [C.cyan, C.sky, C.violet, "#C084FC", C.rose, C.mint];

const args = new Set(process.argv.slice(2));
const OUT = args.has("--sample") ? "preview" : "assets";
mkdirSync(OUT, { recursive: true });

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtNum = (n) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "K" : n.toLocaleString("en-US"));

/* --------------------------------------------------------------- data */
async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "profile-updater" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GitHub GraphQL failed: ${JSON.stringify(json.errors || json)}`);
  return json.data;
}

async function loadGitHub() {
  const to = new Date(), from = new Date(to);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  const since = from.toISOString().slice(0, 10);
  const data = await gql(
    `query($login:String!, $from:DateTime!, $to:DateTime!, $prq:String!, $ossq:String!) {
      user(login:$login) {
        repositories(ownerAffiliations:OWNER, isFork:false, privacy:PUBLIC, first:100) {
          nodes { name description url stargazerCount pushedAt
            primaryLanguage { name }
            languages(first:12, orderBy:{field:SIZE, direction:DESC}) { edges { size node { name } } } }
        }
        contributionsCollection(from:$from, to:$to) {
          totalCommitContributions restrictedContributionsCount totalPullRequestReviewContributions
          contributionCalendar { totalContributions weeks { contributionDays { contributionCount } } }
        }
      }
      merged: search(query:$prq, type:ISSUE, first:1) { issueCount }
      oss: search(query:$ossq, type:ISSUE, first:40) {
        nodes { ... on PullRequest { title url mergedAt repository { nameWithOwner url owner { login } } } }
      }
    }`,
    {
      login: LOGIN,
      from: from.toISOString(),
      to: to.toISOString(),
      prq: `author:${LOGIN} is:pr is:merged merged:>=${since}`,
      ossq: `author:${LOGIN} is:pr is:merged -user:${LOGIN} sort:updated-desc`,
    }
  );
  const u = data.user, cc = u.contributionsCollection, repos = u.repositories.nodes;

  const bytes = {};
  for (const r of repos)
    for (const e of r.languages.edges)
      if (!EXCLUDE_LANGS.includes(e.node.name)) bytes[e.node.name] = (bytes[e.node.name] || 0) + e.size;

  return {
    commits: cc.totalCommitContributions + cc.restrictedContributionsCount,
    prs: data.merged.issueCount,
    reviews: cc.totalPullRequestReviewContributions,
    stars: repos.reduce((a, r) => a + r.stargazerCount, 0),
    total: cc.contributionCalendar.totalContributions,
    weeks: cc.contributionCalendar.weeks.map((w) => w.contributionDays.reduce((a, d) => a + d.contributionCount, 0)).slice(-52),
    langs: Object.entries(bytes).sort((a, b) => b[1] - a[1]),
    repos: Object.fromEntries(repos.map((r) => [r.name, r])),
    oss: data.oss.nodes.filter((n) => n && n.repository && n.repository.owner.login !== LOGIN).slice(0, OSS_COUNT),
  };
}

const SAMPLE = {
  commits: 612, prs: 48, reviews: 21, stars: 57, total: 803,
  weeks: Array.from({ length: 52 }, (_, i) => Math.max(0, Math.round(9 + 8 * Math.sin(i / 4) + (i % 7) * 1.5 + (i > 40 ? 10 : 0)))),
  langs: [["TypeScript", 520000], ["Python", 410000], ["JavaScript", 260000], ["CSS", 90000], ["HTML", 60000], ["Shell", 12000], ["Go", 4000]],
  repos: {
    "mcp-notes-server": { stargazerCount: 12, primaryLanguage: { name: "TypeScript" }, pushedAt: new Date().toISOString() },
    "ai-engineer-roadmap": { stargazerCount: 31, primaryLanguage: { name: "Python" }, pushedAt: new Date().toISOString() },
  },
  oss: [],
};

/* ---------------------------------------------------------- stats.svg */
function statsSvg(d) {
  const W = 600, H = 270, id = "s", pending = !d;
  const metrics = [
    ["commits", d?.commits], ["merged PRs", d?.prs], ["code reviews", d?.reviews], ["total stars", d?.stars],
  ];
  const cols = metrics
    .map(([label, v], i) => {
      const x = 32 + i * 138;
      return `<g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${0.15 + i * 0.12}s" dur="0.6s" fill="freeze"/>
        <text x="${x}" y="112" font-family="${SANS}" font-size="34" font-weight="700" letter-spacing="-0.5" fill="${C.text}">${pending ? "–" : fmtNum(v)}</text>
        <text x="${x + 1}" y="136" font-family="${SANS}" font-size="13.5" fill="${C.muted}">${label}</text></g>`;
    })
    .join("");

  // Weekly contribution sparkline that draws itself on load.
  const X0 = 32, X1 = 568, Y0 = 226, Y1 = 164;
  const weeks = pending ? Array(52).fill(0) : d.weeks;
  const max = Math.max(1, ...weeks);
  const pts = weeks.map((v, i) => [X0 + (i * (X1 - X0)) / (weeks.length - 1), Y0 - (v / max) * (Y0 - Y1)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const len = Math.ceil(pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0));
  const [lx, ly] = pts[pts.length - 1];

  const body = `<defs>${baseDefs(id)}
    <linearGradient id="${id}-line" gradientUnits="userSpaceOnUse" x1="${X0}" y1="0" x2="${X1}" y2="0">
      <stop offset="0" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.violet}"/></linearGradient>
    <linearGradient id="${id}-area" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.cyan}" stop-opacity="0.32"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>
  </defs>
  ${card(id, W, H, [[540, 30, 150, C.cyan, 0.22, -30, 20, 18], [40, 270, 170, C.violet, 0.24, 30, -20, 22]], 22)}
  <text x="32" y="48" font-family="${SANS}" font-size="18" font-weight="600" fill="${C.text}">GitHub activity</text>
  <text x="568" y="48" text-anchor="end" font-family="${SANS}" font-size="12.5" fill="${C.muted}">${pending ? "Syncing on the first workflow run" : `Updated ${fmtDate(Date.now())}`}</text>
  ${cols}
  <line x1="${X0}" y1="${Y0 + 0.5}" x2="${X1}" y2="${Y0 + 0.5}" stroke="#FFFFFF" stroke-opacity="0.08"/>
  ${pending ? `<text x="300" y="200" text-anchor="middle" font-family="${SANS}" font-size="14" fill="${C.muted}">Live numbers appear after the first workflow run</text>` : `
  <path d="${line} L${X1} ${Y0} L${X0} ${Y0} Z" fill="url(#${id}-area)" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="0.9s" dur="1.4s" fill="freeze"/></path>
  <path d="${line}" fill="none" stroke="url(#${id}-line)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" filter="url(#${id}-glow)" stroke-dasharray="${len}" stroke-dashoffset="${len}">
    <animate attributeName="stroke-dashoffset" from="${len}" to="0" begin="0.3s" dur="2.2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1"/></path>
  <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4" fill="${C.violet}" opacity="0">
    <animate attributeName="opacity" from="0" to="1" begin="2.4s" dur="0.3s" fill="freeze"/></circle>
  <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4" fill="none" stroke="${C.violet}" opacity="0">
    <animate attributeName="opacity" values="0.8;0" begin="2.4s" dur="1.8s" repeatCount="indefinite"/>
    <animate attributeName="r" values="4;13" begin="2.4s" dur="1.8s" repeatCount="indefinite"/></circle>
`}
  <text x="32" y="252" font-family="${SANS}" font-size="12.5" fill="${C.muted}">Weekly contributions, last 12 months</text>
  <text x="568" y="252" text-anchor="end" font-family="${MONO}" font-size="12.5" fill="${C.muted}">${pending ? "" : `${fmtNum(d.total)} total`}</text>`;
  return frame(W, H, pending ? "GitHub activity, syncing" : `GitHub activity: ${d.commits} commits, ${d.prs} merged pull requests, ${d.reviews} code reviews in the last 12 months, ${d.stars} total stars.`, body);
}

/* ---------------------------------------------------------- langs.svg */
function langsSvg(d) {
  const W = 600, H = 270, id = "l", pending = !d;
  const sum = pending ? 1 : d.langs.reduce((a, [, b]) => a + b, 0);
  const top = pending ? [] : d.langs.slice(0, 6).map(([name, b], i) => ({ name, pct: (b / sum) * 100, color: PALETTE[i] }));
  const BX = 32, BW = 536;
  let x = BX;
  const segs = top
    .map((l, i) => {
      const w = Math.max(2, (l.pct / 100) * BW), s = `<rect x="${x.toFixed(1)}" y="76" width="${(w - (i < top.length - 1 ? 2 : 0)).toFixed(1)}" height="12" fill="${l.color}"/>`;
      x += w;
      return s;
    })
    .join("");
  const topPct = top[0]?.pct || 1;
  const rows = top
    .map((l, i) => {
      const cx = i % 2 ? 316 : 32, cy = 136 + Math.floor(i / 2) * 44, tw = 252, fw = Math.max(3, (l.pct / topPct) * tw);
      return `<g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${0.4 + i * 0.1}s" dur="0.5s" fill="freeze"/>
        <circle cx="${cx + 5}" cy="${cy - 5}" r="5" fill="${l.color}"/>
        <text x="${cx + 18}" y="${cy}" font-family="${SANS}" font-size="15" fill="${C.text}">${esc(l.name)}</text>
        <text x="${cx + tw}" y="${cy}" text-anchor="end" font-family="${MONO}" font-size="13" fill="${C.muted}">${l.pct.toFixed(1)}%</text>
        <rect x="${cx}" y="${cy + 10}" width="${tw}" height="3" rx="1.5" fill="#FFFFFF" fill-opacity="0.07"/>
        <rect x="${cx}" y="${cy + 10}" width="0" height="3" rx="1.5" fill="${l.color}">
          <animate attributeName="width" from="0" to="${fw.toFixed(1)}" begin="${0.5 + i * 0.1}s" dur="1.2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1"/></rect></g>`;
    })
    .join("");
  const body = `<defs>${baseDefs(id)}
    <clipPath id="${id}-bar"><rect x="${BX}" y="76" width="0" height="12" rx="6">
      <animate attributeName="width" from="0" to="${BW}" begin="0.2s" dur="1.4s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1"/></rect></clipPath></defs>
  ${card(id, W, H, [[60, 20, 150, C.violet, 0.22, 30, 20, 20], [560, 270, 170, C.cyan, 0.2, -30, -20, 24]], 22)}
  <text x="32" y="48" font-family="${SANS}" font-size="18" font-weight="600" fill="${C.text}">Most used languages</text>
  <text x="568" y="48" text-anchor="end" font-family="${SANS}" font-size="12.5" fill="${C.muted}">${pending ? "Syncing on the first workflow run" : "By code size, public repos"}</text>
  <rect x="${BX}" y="76" width="${BW}" height="12" rx="6" fill="#FFFFFF" fill-opacity="0.06"/>
  <g clip-path="url(#${id}-bar)">${segs}</g>
  ${rows}`;
  return frame(W, H, pending ? "Most used languages, syncing" : `Most used languages: ${top.map((l) => `${l.name} ${l.pct.toFixed(0)}%`).join(", ")}`, body);
}

/* ------------------------------------------------------- project cards */
const LANG_COLORS = { TypeScript: "#3178C6", Python: "#3572A5", JavaScript: "#F1E05A", Go: "#00ADD8", Rust: "#DEA584", "Jupyter Notebook": "#DA5B0B" };
function projectSvg(p, repo) {
  const W = 600, H = 210, id = "p" + p.repo.replace(/[^a-z0-9]/gi, "").slice(0, 8);
  const lines = wrap(p.description || repo?.description || "", 70).slice(0, 3);
  const lang = repo?.primaryLanguage?.name;
  const meta = [];
  let mx = 32;
  if (lang) {
    meta.push(`<circle cx="${mx + 5}" cy="177" r="5" fill="${LANG_COLORS[lang] || p.accent}"/><text x="${mx + 17}" y="182" font-family="${SANS}" font-size="13.5" fill="${C.muted}">${esc(lang)}</text>`);
    mx += 30 + lang.length * 7.5;
  }
  if (repo) {
    meta.push(`<path transform="translate(${mx} 169)" d="M8 0.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L0.8 6.1l5-.7z" fill="none" stroke="${C.muted}" stroke-width="1.3" stroke-linejoin="round"/><text x="${mx + 22}" y="182" font-family="${SANS}" font-size="13.5" fill="${C.muted}">${fmtNum(repo.stargazerCount)}</text>`);
  }
  const body = `<defs>${baseDefs(id)}</defs>
  ${card(id, W, H, [[560, 10, 140, p.accent, 0.3, -30, 25, 16], [80, 230, 120, C.violet, 0.14, 30, -15, 22]], 22)}
  <g transform="translate(32 34)" fill="none" stroke="${p.accent}" stroke-width="1.5" stroke-linejoin="round">
    <path d="M2 1h10l4 4v12H2z"/><path d="M12 1v4h4" /><path d="M5 9h8M5 12.5h5"/></g>
  <text x="58" y="49" font-family="${SANS}" font-size="22" font-weight="700" letter-spacing="-0.3" fill="${C.text}">${esc(p.repo)}</text>
  ${lines.map((l, i) => `<text x="32" y="${90 + i * 23}" font-family="${SANS}" font-size="15" fill="#C3C9E4">${esc(l)}</text>`).join("")}
  <line x1="32" y1="152" x2="568" y2="152" stroke="#FFFFFF" stroke-opacity="0.07"/>
  ${meta.join("")}
  ${repo?.pushedAt ? `<text x="568" y="182" text-anchor="end" font-family="${SANS}" font-size="13" fill="${C.faint}">Updated ${fmtDate(repo.pushedAt)}</text>` : ""}`;
  return frame(W, H, `${p.repo}: ${p.description}`, body);
}

/* -------------------------------------------------------------- README */
function replaceSection(md, name, content) {
  const re = new RegExp(`(<!-- ${name}:START -->)[\\s\\S]*?(<!-- ${name}:END -->)`);
  if (!re.test(md)) {
    console.warn(`README has no ${name} markers, skipped`);
    return md;
  }
  return md.replace(re, `$1\n${content}\n$2`);
}

function ossMarkdown(prs) {
  if (!prs.length)
    return `<p align="center"><sub>Merged pull requests to other projects show up here automatically.</sub></p>`;
  const rows = prs
    .map((p) => `<tr><td><a href="${p.repository.url}"><b>${esc(p.repository.nameWithOwner)}</b></a></td><td><a href="${p.url}">${esc(p.title)}</a></td><td><sub>${fmtDate(p.mergedAt)}</sub></td></tr>`)
    .join("\n");
  return `<table align="center">\n<tr><th>Project</th><th>Pull request</th><th>Merged</th></tr>\n${rows}\n</table>`;
}

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .trim();

async function blogMarkdown() {
  const res = await fetch(FEED, { headers: { "User-Agent": "Mozilla/5.0 profile-updater" } });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, BLOG_COUNT).map(([, it]) => ({
    title: decode((it.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ""),
    link: decode((it.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || ""),
    date: (it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1],
  }));
  if (!items.length) throw new Error("feed had no items");
  const nice = (p) => {
    if (!/Complete Guide|Tutorials & Examples/i.test(p.title)) return p.title;
    const slug = p.link.replace(/\/+$/, "").split("/").pop();
    const small = new Set(["a", "an", "and", "for", "in", "of", "on", "the", "to", "with", "your"]);
    const up = { ai: "AI", api: "API", mcp: "MCP", mysql: "MySQL", json: "JSON", rag: "RAG", llm: "LLM", js: "JS", node: "Node", sql: "SQL" };
    return slug.split("-").map((w, i) => up[w] || (i && small.has(w) ? w : w[0].toUpperCase() + w.slice(1))).join(" ");
  };
  items.forEach((p) => (p.title = nice(p)));
  return items.map((p) => `- [${p.title.replace(/[[\]]/g, "")}](${p.link})${p.date ? ` <sub>${fmtDate(p.date)}</sub>` : ""}`).join("\n");
}

/* ---------------------------------------------------------------- main */
async function main() {
  let data = null;
  if (args.has("--sample")) data = SAMPLE;
  else if (!args.has("--pending")) {
    if (!TOKEN) throw new Error("GH_TOKEN is not set. Use --pending to write placeholder cards.");
    data = await loadGitHub();
  }

  writeFileSync(`${OUT}/stats.svg`, statsSvg(data));
  writeFileSync(`${OUT}/langs.svg`, langsSvg(data));
  for (const p of FEATURED) writeFileSync(`${OUT}/project-${p.repo}.svg`, projectSvg(p, data?.repos[p.repo]));
  console.log(`wrote cards to ${OUT}/`);

  if (args.has("--sample") || args.has("--pending")) return;

  let md = readFileSync("README.md", "utf8");
  md = replaceSection(md, "OSS", ossMarkdown(data.oss));
  try {
    md = replaceSection(md, "BLOG-POSTS", await blogMarkdown());
  } catch (e) {
    console.warn(`blog feed skipped, kept previous posts: ${e.message}`);
  }
  writeFileSync("README.md", md);
  console.log(`README updated: ${data.oss.length} OSS PRs, ${data.commits} commits, ${data.langs.length} languages`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
