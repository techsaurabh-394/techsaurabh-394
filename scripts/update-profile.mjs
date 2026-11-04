// Refreshes the Open-source and Writing sections of README.md from live data.
// Env: GH_TOKEN, GH_LOGIN, BLOG_FEED
import { readFileSync, writeFileSync } from "node:fs";
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
