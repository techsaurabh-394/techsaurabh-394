// Builds assets/traffic.svg from GitHub traffic data of PUBLIC repos (excluding the profile repo itself).
// GitHub keeps only 14 days of traffic, so daily numbers are merged into data/traffic-history.json.
// Needs GH_TOKEN with repo access (PROFILE_TOKEN). Without it, the card is rebuilt from saved history.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const LOGIN = process.env.GH_LOGIN || "techsaurabh-394";
const TOKEN = process.env.GH_TOKEN || "";
const HIST = "data/traffic-history.json";
const FONT = "-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

mkdirSync("data", { recursive: true });
const hist = existsSync(HIST) ? JSON.parse(readFileSync(HIST, "utf8")) : { repos: {}, updated: "" };

async function api(path) {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "profile-traffic" },
  });
  return r.ok ? r.json() : null;
}

if (TOKEN) {
  const repos = (await api(`/users/${LOGIN}/repos?per_page=100&type=owner`)) || [];
  for (const r of repos) {
    if (r.private || r.name === LOGIN) continue;
    const t = await api(`/repos/${LOGIN}/${r.name}/traffic/views`);
    if (!t) continue; // no push access to traffic: keep old data
    const h = (hist.repos[r.name] ||= {});
    for (const d of t.views) {
      const day = d.timestamp.slice(0, 10);
      if (d.count || !h[day]) h[day] = { c: d.count, u: d.uniques };
    }
  }
  writeFileSync(HIST, JSON.stringify(hist, null, 1));
}

const today = new Date();
const dayAgo = (n) => new Date(today - n * 864e5).toISOString().slice(0, 10);
const rows = Object.entries(hist.repos).map(([name, days]) => {
  const v = Object.entries(days);
  const sum = (f, k) => v.filter(([d]) => f(d)).reduce((a, [, x]) => a + x[k], 0);
  return {
    name,
    views: sum(() => true, "c"),
    uniq: sum(() => true, "u"),
    d7: sum((d) => d >= dayAgo(7), "c"),
  };
});
const tot = rows.reduce((a, r) => ({ views: a.views + r.views, uniq: a.uniq + r.uniq, d7: a.d7 + r.d7 }), { views: 0, uniq: 0, d7: 0 });
const top = rows.filter((r) => r.views > 0).sort((a, b) => b.views - a.views).slice(0, 3);
const max = Math.max(1, ...top.map((r) => r.views));

const tile = (x, y, color, big, label) =>
  `<rect x="${x}" y="${y}" width="250" height="52" rx="12" fill="${color}" fill-opacity=".08"/>` +
  `<text x="${x + 16}" y="${y + 33}" font-family="${FONT}" font-size="26" font-weight="800" fill="#0F172A">${big}</text>` +
  `<text x="${x + 234}" y="${y + 31}" text-anchor="end" font-family="${FONT}" font-size="13" fill="#475569">${esc(label)}</text>`;

const bars = top.map((r, i) => {
  const y = 196 + i * 20;
  const w = Math.max(6, Math.round((r.views / max) * 150));
  return (
    `<text x="28" y="${y + 10}" font-family="${FONT}" font-size="12" fill="#475569">${esc(r.name.length > 22 ? r.name.slice(0, 21) + "…" : r.name)}</text>` +
    `<rect x="210" y="${y}" width="${w}" height="12" rx="6" fill="#6366F1" fill-opacity="${0.85 - i * 0.2}"/>` +
    `<text x="${210 + w + 8}" y="${y + 10}" font-family="${FONT}" font-size="12" font-weight="700" fill="#0F172A">${r.views}</text>`
  );
}).join("");

const label = `Repository traffic: ${tot.views} views, ${tot.uniq} unique visits, ${tot.d7} views in the last 7 days.`;
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 270" width="580" height="270" role="img" aria-label="${esc(label)}">` +
  `<rect x=".75" y=".75" width="578.5" height="268.5" rx="16" fill="#fff" stroke="#E2E8F0" stroke-width="1.5"/>` +
  `<text x="28" y="38" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="2" fill="#6366F1">REPO TRAFFIC</text>` +
  `<text x="552" y="38" text-anchor="end" font-family="${FONT}" font-size="12" fill="#94A3B8">public repos, tracked daily</text>` +
  tile(28, 56, "#4F46E5", tot.views, "Total views") +
  tile(290, 56, "#0EA5E9", tot.uniq, "Unique visits") +
  tile(28, 118, "#7C3AED", tot.d7, "Views, last 7 days") +
  tile(290, 118, "#F59E0B", rows.filter((r) => r.views > 0).length, "Repos viewed") +
  `<text x="28" y="190" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="1.5" fill="#94A3B8">MOST VIEWED</text>` +
  bars.replace(/y="(\d+)"/g, (m, n) => `y="${+n + 6}"`) +
  `</svg>\n`;
writeFileSync("assets/traffic.svg", svg);
console.log(JSON.stringify({ tot, top: top.map((r) => r.name) }));
