/**
 * Run vitest and record a Playwright video of the HTML test report.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARTIFACTS = path.join(ROOT, "e2e-artifacts");

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function runTests() {
  const { stdout, stderr } = await execFileAsync("npm", ["test"], {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: "0" },
    maxBuffer: 20 * 1024 * 1024,
  });
  return { stdout, stderr, passed: !stderr.includes("FAIL") && stdout.includes("passed") };
}

function buildReportHtml(stdout, stderr) {
  const combined = `${stdout}\n${stderr}`.trim();
  const lines = combined.split("\n").map((line) => {
    let cls = "line";
    if (/✓|passed/i.test(line)) cls = "pass";
    else if (/✗|FAIL|failed/i.test(line)) cls = "fail";
    else if (/Test Files|Tests|Duration/i.test(line)) cls = "summary";
    return `<div class="${cls}">${escapeHtml(line)}</div>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Unit Test Results — AI Intelligence Hub</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-monospace, monospace; background: #0f172a; color: #e2e8f0; margin: 0; padding: 2rem; }
    h1 { color: #a78bfa; font-family: system-ui, sans-serif; margin-bottom: 0.25rem; }
    p { color: #94a3b8; font-family: system-ui, sans-serif; }
    .output { background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-top: 1.5rem; line-height: 1.6; }
    .pass { color: #4ade80; }
    .fail { color: #f87171; font-weight: bold; }
    .summary { color: #38bdf8; font-weight: bold; margin-top: 0.5rem; }
    .line { color: #cbd5e1; }
  </style>
</head>
<body>
  <h1>Unit Test Suite — Autonomous Delivery App</h1>
  <p>Recorded ${new Date().toLocaleString()} · vitest run</p>
  <div class="output">${lines.join("\n")}</div>
</body>
</html>`;
}

async function recordVideo(htmlPath) {
  await fs.mkdir(path.join(ARTIFACTS, "videos"), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: path.join(ARTIFACTS, "videos"), size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);
  const video = page.video();
  await context.close();
  await browser.close();
  if (!video) return null;
  const src = await video.path();
  const dest = path.join(ARTIFACTS, "videos", "unit-tests.webm");
  await fs.rename(src, dest).catch(async () => fs.copyFile(src, dest));
  return dest;
}

async function main() {
  await fs.mkdir(ARTIFACTS, { recursive: true });
  console.log("[unit-tests] Running vitest…");
  const result = await runTests();
  const html = buildReportHtml(result.stdout, result.stderr);
  const htmlPath = path.join(ARTIFACTS, "unit-test-report.html");
  await fs.writeFile(htmlPath, html);
  await fs.writeFile(path.join(ARTIFACTS, "unit-test-output.txt"), `${result.stdout}\n${result.stderr}`);
  console.log("[unit-tests] Recording video of report…");
  const videoPath = await recordVideo(htmlPath);
  const summary = {
    passed: result.passed,
    htmlReport: htmlPath,
    video: videoPath,
    recordedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(ARTIFACTS, "unit-test-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (!result.passed) process.exit(1);
}

main().catch((err) => {
  console.error("[unit-tests] FAILED:", err);
  process.exit(1);
});
