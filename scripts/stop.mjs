#!/usr/bin/env node
/** Stop app processes and embedded Temporal dev server. */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function freePort(port) {
  spawnSync("npx", ["kill-port", String(port)], {
    cwd: root,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
}

loadEnv();

const ports = [
  process.env.WEB_PORT ?? "3020",
  process.env.API_PORT ?? "4020",
  "8080",
  "8233",
  "7233",
];

console.log("Stopping Autonomous Delivery App...\n");

for (const port of ports) {
  freePort(port);
  console.log(`  ✓ Freed port ${port}`);
}

try {
  spawnSync("npx", ["temporal", "stop"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  console.log("  ✓ Temporal dev server stopped");
} catch {
  console.log("  (Temporal was not running)");
}

console.log("\n✓ All services stopped.\n");
