import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(__dirname, "../..");

export function loadEnvFile(filePath) {
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

export function applyEnvDefaults() {
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

/**
 * @param {{ requireEnv?: boolean, createFromExample?: boolean }} options
 */
export function loadProjectEnv(options = {}) {
  const { requireEnv = false, createFromExample = false } = options;
  const envPath = path.join(root, ".env");
  const examplePath = path.join(root, ".env.example");

  if (!fs.existsSync(envPath)) {
    if (createFromExample && fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log("✓ Created .env from .env.example");
    } else if (requireEnv) {
      throw new Error(
        "Missing .env file. Copy the shared .env into the project root, then run setup again."
      );
    }
  }

  loadEnvFile(envPath);
  loadEnvFile(path.join(root, ".env.local"));
  applyEnvDefaults();
}

export function runSync(command, args, label) {
  console.log(`\n→ ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`Failed: ${command} ${args.join(" ")}`);
  }
}

export function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

export function parseNodeMajorVersion(versionOutput) {
  const match = versionOutput.match(/v?(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function checkPrerequisites() {
  const errors = [];

  if (!commandExists("node", ["--version"])) {
    errors.push("Node.js is not installed (need v20+). https://nodejs.org/");
  } else {
    const version = spawnSync("node", ["--version"], {
      encoding: "utf-8",
      shell: process.platform === "win32",
    });
    const major = parseNodeMajorVersion(version.stdout ?? "");
    if (major < 20) {
      errors.push(`Node.js ${major} detected — need v20 or higher.`);
    }
  }

  if (!commandExists("npm", ["--version"])) {
    errors.push("npm is not installed.");
  }

  if (!commandExists("docker", ["--version"])) {
    errors.push("Docker is not installed. https://docs.docker.com/get-docker/");
  } else if (!commandExists("docker", ["compose", "version"])) {
    errors.push("Docker Compose is not available. Install Docker Desktop or the compose plugin.");
  }

  if (errors.length > 0) {
    console.error("\n✗ Prerequisites check failed:\n");
    for (const err of errors) {
      console.error(`  • ${err}`);
    }
    console.error("");
    throw new Error("Fix the items above and run setup again.");
  }

  console.log("✓ Prerequisites OK (Node.js, npm, Docker)");
}

export function isPortInUse(port) {
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

export async function waitForPort(port, label, maxWaitMs = 120_000) {
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

export async function startInfrastructure() {
  runSync("docker", ["compose", "up", "-d"], "Starting Docker (Postgres, Redis, Temporal)");
  await waitForPort(5433, "Postgres");
  await waitForPort(6380, "Redis");
  await waitForPort(7233, "Temporal");
  await waitForPort(8080, "Temporal UI");
}

export function installDependencies() {
  runSync("npm", ["install"], "Installing npm dependencies");
}

export function setupDatabase() {
  runSync("npm", ["run", "db:generate"], "Generating Prisma client");
  runSync("npm", ["run", "db:push"], "Syncing database schema");
}

export function buildDevPackages() {
  runSync("npm", ["run", "build", "-w", "@ados/shared"], "Building @ados/shared");
  runSync("npm", ["run", "build", "-w", "@ados/agents"], "Building @ados/agents");
}

export function printServiceUrls() {
  console.log("\n✓ Setup complete\n");
  console.log("  Web:         " + process.env.WEB_URL);
  console.log("  API:         " + process.env.API_URL);
  console.log("  Temporal UI: http://localhost:8080");
  console.log("\n  Start the app:  npm run dev");
  console.log("  Stop everything: npm run stop\n");
}
