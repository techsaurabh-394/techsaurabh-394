// Builds the arcade-style contribution snake with the documented API of
// generate-snake-animation (the action's query string cannot set sizes).
import fs from "node:fs";
import path from "node:path";
import { generateSnakeAnimation } from "generate-snake-animation";

const username = process.env.SNAKE_USER;
const outDir = process.env.SNAKE_OUT || "dist";
if (!username || !process.env.GITHUB_TOKEN) throw new Error("SNAKE_USER and GITHUB_TOKEN are required");

// Arcade look: dark empty cells, bright green ramp ending at #39d353, amber snake.
const arcade = {
  colorDots: ["#161b22", "#0e4429", "#1a8a3a", "#2ea043", "#39d353"],
  colorEmpty: "#161b22",
  colorDotBorder: "#0d1117",
  colorSnake: "#fbbf24",
  sizeCell: 20,
  sizeDot: 18,
  sizeDotBorderRadius: 5,
};

const outputs = [
  { format: "svg", drawOptions: arcade, animationOptions: { frameByStep: 1, stepDurationMs: 100 } },
];

const results = await generateSnakeAnimation(
  { platform: "github", username, githubToken: process.env.GITHUB_TOKEN },
  outputs,
);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "github-snake-dark.svg"), results[0]);
console.log("wrote", path.join(outDir, "github-snake-dark.svg"), results[0].length, "bytes");
