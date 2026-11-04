// Refreshes live data: assets/stats.svg, assets/langs.svg and the Open-source / Writing sections of README.md.
// Env: GH_TOKEN, GH_LOGIN, BLOG_FEED
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ------------------------------------------------------------ settings */
const LOGIN = process.env.GH_LOGIN || "techsaurabh-394";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const FEED = process.env.BLOG_FEED || "https://mernstackdev.com/feed/";
const BLOG_COUNT = 5;
const OSS_COUNT = 5;
// Notebook output and generated markup swamp the byte counts, so they're left out of the chart.
const EXCLUDE_LANGS = ["Jupyter Notebook"];
const args = new Set(process.argv.slice(2));

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


/* ------------------------------------------------------------ SVG cards */
const SANS = "-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif";
const LANG_COLORS = { TypeScript: "#3178C6", JavaScript: "#F1E05A", Python: "#3572A5", HTML: "#E34C26", CSS: "#7C3AED", Shell: "#16A34A", Dockerfile: "#0EA5E9", PHP: "#8892BF" };
const PAL = ["#4F46E5", "#0EA5E9", "#7C3AED", "#16A34A", "#F59E0B", "#EC4899"];

function statsSvg(d) {
  const W = 580, H = 260;
  const items = [["Commits (12 mo)", d.commits, "#4F46E5"], ["Merged PRs", d.prs, "#0EA5E9"], ["Code reviews", d.reviews, "#7C3AED"], ["Stars earned", d.stars, "#F59E0B"]];
  const tiles = items.map(([l, v, c], i) => {
    const x = 28 + (i % 2) * 262, y = 60 + Math.floor(i / 2) * 62;
    return `<rect x="${x}" y="${y}" width="250" height="52" rx="12" fill="${c}" fill-opacity=".08"/><text x="${x + 16}" y="${y + 33}" font-family="${SANS}" font-size="26" font-weight="800" fill="#0F172A">${fmtNum(v)}</text><text x="${x + 234}" y="${y + 31}" text-anchor="end" font-family="${SANS}" font-size="13" fill="#475569">${l}</text>`;
  }).join("");
  const max = Math.max(1, ...d.weeks), bw = 9.6;
  const bars = d.weeks.map((v, i) => { const h = Math.max(2, (v / max) * 52); return `<rect x="${28 + i * 10.6}" y="${236 - h}" width="${bw}" height="${h}" rx="2" fill="#6366F1" fill-opacity="${v ? 0.35 + 0.65 * (v / max) : 0.15}"/>`; }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="GitHub activity in the last 12 months: ${d.commits} commits, ${d.prs} merged pull requests, ${d.reviews} code reviews, ${d.stars} stars.">
<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="16" fill="#fff" stroke="#E2E8F0" stroke-width="1.5"/>
<text x="28" y="38" font-family="${SANS}" font-size="12" font-weight="700" letter-spacing="2" fill="#6366F1">GITHUB ACTIVITY</text>
<text x="${W - 28}" y="38" text-anchor="end" font-family="${SANS}" font-size="12" fill="#94A3B8">${fmtNum(d.total)} contributions, last 12 months</text>
${tiles}${bars}</svg>`;
}

function langsSvg(d) {
  const W = 580, H = 260, top = d.langs.slice(0, 6), sum = top.reduce((a, [, b]) => a + b, 0) || 1;
  let x = 28; const seg = [], rows = [];
  top.forEach(([n, b], i) => {
    const c = LANG_COLORS[n] || PAL[i % PAL.length], w = (b / sum) * 524;
    seg.push(`<rect x="${x.toFixed(1)}" y="56" width="${Math.max(w, 2).toFixed(1)}" height="14" fill="${c}"/>`); x += w;
    const col = i % 2, row = Math.floor(i / 2), rx = 28 + col * 262, ry = 100 + row * 42;
    rows.push(`<circle cx="${rx + 6}" cy="${ry + 6}" r="6" fill="${c}"/><text x="${rx + 22}" y="${ry + 11}" font-family="${SANS}" font-size="15" font-weight="600" fill="#0F172A">${esc(n)}</text><text x="${rx + 250}" y="${ry + 11}" text-anchor="end" font-family="${SANS}" font-size="14" fill="#475569">${((b / sum) * 100).toFixed(1)}%</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Most used languages: ${top.map(([n, b]) => `${n} ${((b / sum) * 100).toFixed(0)}%`).join(", ")}.">
<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="16" fill="#fff" stroke="#E2E8F0" stroke-width="1.5"/>
<text x="28" y="38" font-family="${SANS}" font-size="12" font-weight="700" letter-spacing="2" fill="#6366F1">MOST USED LANGUAGES</text>
<clipPath id="c"><rect x="28" y="56" width="524" height="14" rx="7"/></clipPath><g clip-path="url(#c)">${seg.join("")}</g>
${rows.join("")}</svg>`;
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
  if (!prs.length) return "Merged pull requests to other projects show up here automatically.";
  return prs
    .map((p) => `- [${p.repository.nameWithOwner}](${p.repository.url}): [${p.title.replace(/[[\]]/g, "")}](${p.url}) <sub>${fmtDate(p.mergedAt)}</sub>`)
    .join("\n");
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
  {
    if (!TOKEN) throw new Error("GH_TOKEN is not set. Use --pending to write placeholder cards.");
    data = await loadGitHub();
  }

  mkdirSync("assets", { recursive: true });
  writeFileSync("assets/stats.svg", statsSvg(data));
  writeFileSync("assets/langs.svg", langsSvg(data));

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
