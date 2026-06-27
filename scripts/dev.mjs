#!/usr/bin/env node
/**
 * One-command dev bootstrap:
 *   .env → docker compose → wait for infra → prisma → api + web + worker
 */
import { spawn } from "node:child_process";
import {
  buildDevPackages,
  isPortInUse,
  loadProjectEnv,
  root,
  setupDatabase,
  startInfrastructure,
} from "./lib/bootstrap.mjs";

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

  loadProjectEnv({ createFromExample: true });
  await assertPortsFree();

  await startInfrastructure();
  setupDatabase();
  buildDevPackages();

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
    { cwd: root, stdio: "inherit", env: process.env, shell: process.platform === "win32" }
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
