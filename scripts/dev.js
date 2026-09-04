#!/usr/bin/env node
/**
 * Runs the API and the Vite dev server together.
 *
 * Deliberately uses only Node's own child_process rather than a package like
 * concurrently, so `npm run dev` works from a clean checkout without pulling an
 * extra dependency into the root.
 */

const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";

const targets = [
  { name: "api   ", cwd: path.join(root, "server"), color: "\x1b[36m" },
  { name: "client", cwd: path.join(root, "client"), color: "\x1b[35m" },
];

const children = [];
let shuttingDown = false;

function prefix(name, color, chunk) {
  const reset = "\x1b[0m";
  return String(chunk)
    .split("\n")
    .filter((line) => line.length)
    .map((line) => `${color}${name}${reset} │ ${line}`)
    .join("\n");
}

for (const target of targets) {
  const child = spawn(npm, ["run", "dev"], {
    cwd: target.cwd,
    shell: isWindows,
    env: process.env,
  });

  child.stdout.on("data", (d) => console.log(prefix(target.name, target.color, d)));
  child.stderr.on("data", (d) => console.error(prefix(target.name, target.color, d)));

  child.on("exit", (code) => {
    if (shuttingDown) return;
    console.error(`\n${target.name.trim()} exited with code ${code}. Stopping everything.`);
    shutdown(code || 1);
  });

  children.push(child);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach((c) => {
    if (!c.killed) c.kill("SIGTERM");
  });
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("ComplyBD starting…  API on http://localhost:5000, app on http://localhost:5173\n");
