#!/usr/bin/env node
/**
 * Cross-platform one-time project setup (Linux, macOS, Windows).
 * Expects a shared .env file in the project root — nothing else to configure.
 *
 * Usage:
 *   npm run setup
 *   node scripts/setup.mjs
 *   node scripts/setup.mjs --run   # setup then start dev server
 */
import { spawn } from "node:child_process";
import {
  buildDevPackages,
  checkPrerequisites,
  installDependencies,
  loadProjectEnv,
  printServiceUrls,
  root,
  setupDatabase,
  startInfrastructure,
} from "./lib/bootstrap.mjs";

const runAfterSetup = process.argv.includes("--run");

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Autonomous Delivery App — Setup         ║");
  console.log("╚══════════════════════════════════════════╝\n");

  checkPrerequisites();
  loadProjectEnv({ requireEnv: true });
  installDependencies();
  await startInfrastructure();
  setupDatabase();
  buildDevPackages();
  printServiceUrls();

  if (runAfterSetup) {
    console.log("→ Starting dev server...\n");
    const child = spawn("npm", ["run", "dev"], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => process.exit(code ?? 0));
  }
}

main().catch((err) => {
  console.error("\n✗ Setup failed:", err.message);
  process.exit(1);
});
