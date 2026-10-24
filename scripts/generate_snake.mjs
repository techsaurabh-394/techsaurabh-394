// Builds the arcade-style contribution snake with the documented API of
// generate-snake-animation (the action's query string cannot set sizes).
import fs from "node:fs";
import path from "node:path";


// DECORATION ONLY: the package reads the contribution calendar from the GitHub API.
// To make the board look like a full arcade game, empty days get extra "food" in the
// image only. Nothing is written to GitHub and your real contributions are untouched.
// Real contribution days are never changed. Set SNAKE_EXTRA_FOOD=0 to turn this off.
const density = Number(process.env.SNAKE_EXTRA_FOOD ?? 0.4);
const levels = ["FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"];
let seed = 394;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const res = await realFetch(url, init);
  if (!density || !String(url).endsWith("/graphql")) return res;
  const json = await res.clone().json();
  const weeks = json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!weeks) return res;
  for (const w of weeks)
    for (const d of w.contributionDays)
      if (d.contributionLevel === "NONE" && rnd() < density) d.contributionLevel = levels[Math.floor(rnd() * 4)];
  return new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } });
};

const username = process.env.SNAKE_USER;
const outDir = process.env.SNAKE_OUT || "dist";
if (!username || !process.env.GITHUB_TOKEN) throw new Error("SNAKE_USER and GITHUB_TOKEN are required");

// Arcade look: dark empty cells, bright green ramp ending at #39d353, amber snake.
const arcade = {
  colorDots: ["#161b22", "#2ea043", "#39d353", "#4ade80", "#7CFF9B"],
  colorEmpty: "#161b22",
  colorDotBorder: "#0d1117",
  colorSnake: "#fbbf24",
  sizeCell: 20,
  sizeDot: 18,
  sizeDotBorderRadius: 5,
};

const outputs = [
  { format: "svg", drawOptions: arcade, animationOptions: { frameByStep: 1, stepDurationMs: 70 } },
];

const { generateSnakeAnimation } = await import("generate-snake-animation");
const results = await generateSnakeAnimation(
  { platform: "github", username, githubToken: process.env.GITHUB_TOKEN },
  outputs,
);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "github-snake-dark.svg"), results[0]);
console.log("wrote", path.join(outDir, "github-snake-dark.svg"), results[0].length, "bytes");
