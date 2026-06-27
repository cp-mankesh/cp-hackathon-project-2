#!/usr/bin/env node
/**
 * One-command lightweight setup (Linux, macOS, Windows).
 * No Docker — uses SQLite + embedded Temporal dev server.
 *
 * Usage:
 *   npm run setup              # install, configure, and start the app
 *   npm run setup -- --no-run  # setup only, don't start dev server
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

const runAfterSetup = !process.argv.includes("--no-run");

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
    const child = spawn("npm", ["run", "dev:apps"], {
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
