// Builds the arcade-style contribution snake with generate-snake-animation.
// Usage: SNAKE_USER=techsaurabh-394 GITHUB_TOKEN=... node scripts/generate-snake.mjs
import fs from "node:fs";
import path from "node:path";

const username = process.env.SNAKE_USER;
const outDir = process.env.SNAKE_OUT || "dist";
if (!username || !process.env.GITHUB_TOKEN) throw new Error("SNAKE_USER and GITHUB_TOKEN are required");

// Optional decoration: fill some empty days with extra food in the image only.
// Off by default so the board matches your real contribution graph.
const density = Number(process.env.SNAKE_EXTRA_FOOD ?? 0);
if (density > 0) {
  const levels = ["FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"];
  let seed = 394;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const res = await realFetch(url, init);
    if (!String(url).endsWith("/graphql")) return res;
    const json = await res.clone().json();
    const weeks = json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
    if (!weeks) return res;
    for (const w of weeks)
      for (const d of w.contributionDays)
        if (d.contributionLevel === "NONE" && rnd() < density) d.contributionLevel = levels[Math.floor(rnd() * 4)];
    return new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } });
  };
}

// Matches the profile palette: dark cells, teal ramp, amber snake.
const theme = {
  colorDots: ["#161b22", "#0f5e57", "#14917f", "#22c3ab", "#2dd4bf"],
  colorEmpty: "#161b22",
  colorDotBorder: "#0d1117",
  colorSnake: "#fbbf24",
  sizeCell: 16,
  sizeDot: 13,
  sizeDotBorderRadius: 3,
};

const { generateSnakeAnimation } = await import("generate-snake-animation");
const [svg] = await generateSnakeAnimation(
  { platform: "github", username, githubToken: process.env.GITHUB_TOKEN },
  [{ format: "svg", drawOptions: theme, animationOptions: { frameByStep: 1, stepDurationMs: 90 } }],
);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "github-snake-dark.svg"), svg);
console.log("wrote", path.join(outDir, "github-snake-dark.svg"), svg.length, "bytes");
