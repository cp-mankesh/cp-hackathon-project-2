#!/usr/bin/env node
/** Stop app processes on project ports and Docker Compose services. */
import { execSync } from "node:child_process";
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

loadEnv();

const ports = [
  process.env.WEB_PORT ?? "3020",
  process.env.API_PORT ?? "4020",
  "3000",
  "3001",
  "4000",
];

console.log("Stopping Autonomous Delivery App...\n");

for (const port of ports) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null`, { stdio: "ignore" });
    console.log(`  ✓ Freed port ${port}`);
  } catch {
    // port not in use
  }
}

try {
  execSync("pkill -f 'cp-hackathon-project-2.*(tsx watch|next dev|concurrently)' 2>/dev/null", {
    stdio: "ignore",
  });
} catch {
  // no processes
}

try {
  execSync("docker compose down", { cwd: root, stdio: "inherit" });
  console.log("  ✓ Docker Compose stopped");
} catch {
  console.log("  (Docker Compose was not running)");
}

console.log("\n✓ All services stopped.\n");
