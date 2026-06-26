#!/usr/bin/env node
/**
 * One-command dev bootstrap:
 *   .env setup → docker compose → wait for infra → prisma → api + web + worker
 */
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function ensureEnv() {
  const envPath = path.join(root, ".env");
  const examplePath = path.join(root, ".env.example");
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log("✓ Created .env from .env.example");
  }
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, ".env.local"));

  process.env.WEB_PORT = process.env.WEB_PORT ?? "3020";
  process.env.API_PORT = process.env.API_PORT ?? "4020";
  process.env.PORT = process.env.WEB_PORT;
  process.env.WEB_URL = process.env.WEB_URL ?? `http://localhost:${process.env.WEB_PORT}`;
  process.env.API_URL = process.env.API_URL ?? `http://localhost:${process.env.API_PORT}`;
  process.env.NEXT_PUBLIC_API_URL = process.env.API_URL;
  process.env.GITHUB_CALLBACK_URL =
    process.env.GITHUB_CALLBACK_URL ?? `${process.env.API_URL}/api/auth/github/callback`;
  process.env.JIRA_CALLBACK_URL =
    process.env.JIRA_CALLBACK_URL ?? `${process.env.API_URL}/api/auth/jira/callback`;
}

function runSync(command, args, label) {
  console.log(`\n→ ${label}`);
  execSync([command, ...args].join(" "), { cwd: root, stdio: "inherit", env: process.env });
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

async function waitForPort(port, label, maxWaitMs = 120_000) {
  const start = Date.now();
  process.stdout.write(`  Waiting for ${label} (port ${port})`);
  while (Date.now() - start < maxWaitMs) {
    if (await isPortInUse(port)) {
      console.log(" ✓");
      return;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timeout waiting for ${label} on port ${port}`);
}

async function assertPortsFree() {
  const webPort = Number(process.env.WEB_PORT);
  const apiPort = Number(process.env.API_PORT);
  for (const [name, port] of [
    ["WEB", webPort],
    ["API", apiPort],
  ]) {
    if (await isPortInUse(port)) {
      console.error(`\n✗ Port ${port} (${name}) is already in use.`);
      console.error(`  Free it with: npm run stop`);
      console.error(`  Or change WEB_PORT / API_PORT in .env\n`);
      process.exit(1);
    }
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Autonomous Delivery App — Dev Startup   ║");
  console.log("╚══════════════════════════════════════════╝\n");

  ensureEnv();
  await assertPortsFree();

  runSync("docker", ["compose", "up", "-d"], "Starting Docker (Postgres, Redis, Temporal)");

  await waitForPort(5433, "Postgres");
  await waitForPort(7233, "Temporal");
  await waitForPort(8080, "Temporal UI");

  runSync("npm", ["run", "db:generate"], "Generating Prisma client");
  runSync("npm", ["run", "db:push"], "Syncing database schema");
  runSync("npm", ["run", "build", "-w", "@ados/shared"], "Building @ados/shared");
  runSync("npm", ["run", "build", "-w", "@ados/agents"], "Building @ados/agents");

  const webPort = process.env.WEB_PORT;
  const apiPort = process.env.API_PORT;

  console.log("\n✓ Infrastructure ready\n");
  console.log("  Web:         " + process.env.WEB_URL);
  console.log("  API:         " + process.env.API_URL);
  console.log("  Temporal UI: http://localhost:8080\n");

  const child = spawn(
    "npx",
    [
      "concurrently",
      "-k",
      "-n", "shared,agents,api,web,worker",
      "-c", "cyan,magenta,blue,green,yellow",
      "npm run dev -w @ados/shared",
      "npm run dev -w @ados/agents",
      "npm run dev -w @ados/api",
      "npm run dev -w @ados/web",
      "npm run dev -w @ados/temporal-worker",
    ],
    { cwd: root, stdio: "inherit", env: process.env }
  );

  const shutdown = () => {
    child.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error("\n✗ Dev startup failed:", err.message);
  process.exit(1);
});
