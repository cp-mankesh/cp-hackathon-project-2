/**
 * End-to-end browser test: create ticket → run agent → approve plan → approve review.
 * Records Playwright video. Requires app on WEB_PORT (3020) and API on 4020.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, ".env"), "utf-8").catch(() => "");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim();
    }
  }
}
const ARTIFACTS = path.join(ROOT, "e2e-artifacts");
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3020";
const API_URL = process.env.API_URL ?? "http://localhost:4020";
const GITHUB_USER_ID = process.env.E2E_USER_ID ?? "cmqszurfi0000ca4ze2gsgof8";
const PROJECT_ID = process.env.E2E_PROJECT_ID ?? "cmqszvkd10006ca4z9c98s8qt";

const TICKET_TITLE = "Add Total User stat card on Dashboard page";
const TICKET_BODY = `Add a new summary card on the Dashboard page that displays the total number of users.

Requirements:
- Place it alongside the existing metric cards on the dashboard
- Match the same card styling, spacing, and typography as other dashboard stat cards
- Show a clear label like "Total Users" with a numeric count
- Use mock or existing user data source already used on the dashboard if available`;

async function createGithubUserSession() {
  await loadEnv();
  const prisma = new PrismaClient();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.session.create({
    data: {
      userId: GITHUB_USER_ID,
      token,
      expiresAt,
    },
  });
  await prisma.$disconnect();
  return token;
}

async function waitForTicketStatus(request, ticketId, statuses, timeoutMs = 600_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request.get(`${API_URL}/api/tickets/${ticketId}`);
    if (res.ok()) {
      const { ticket } = await res.json();
      if (statuses.includes(ticket.status)) return ticket;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Timeout waiting for status ${statuses.join("|")} on ticket ${ticketId}`);
}

async function main() {
  await fs.mkdir(path.join(ARTIFACTS, "videos"), { recursive: true });
  const sessionToken = await createGithubUserSession();
  console.log("[e2e] Created GitHub user session");

  const browser = await chromium.launch({
    headless: false,
    slowMo: 400,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: path.join(ARTIFACTS, "videos"), size: { width: 1440, height: 900 } },
  });

  await context.addCookies([
    {
      name: "ados_session",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();
  const request = context.request;

  const log = (msg) => {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    console.log(line);
  };

  log("Opening admin dashboard");
  await page.goto(`${WEB_URL}/admin`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Ticket Hub", { timeout: 30_000 });

  const revisionOnly = process.env.E2E_REVISION_ONLY === "1";
  let ticketId = process.env.E2E_TICKET_ID;

  if (revisionOnly) {
    if (!ticketId) throw new Error("E2E_REVISION_ONLY requires E2E_TICKET_ID");
    log(`Revision-only mode for ticket ${ticketId}`);
    const res = await request.get(`${API_URL}/api/tickets/${ticketId}`);
    if (!res.ok()) throw new Error(`Ticket not found: ${ticketId}`);
    let ticket = (await res.json()).ticket;
    await page.goto(`${WEB_URL}/admin/tickets/${ticketId}`, { waitUntil: "networkidle" });

    const prUrls = (ticket.pullRequests ?? []).map((pr) => pr.url).filter(Boolean);
    if (!["completed", "pr_created"].includes(ticket.status) || prUrls.length === 0) {
      throw new Error(`Ticket not ready for revision: status=${ticket.status}, prs=${prUrls.length}`);
    }

    log("Starting post-PR revision");
    await page.waitForSelector("#post-pr-revision", { timeout: 30_000 });
    await page.fill(
      "#post-pr-revision textarea",
      "Make the Total Users card title slightly larger and add a subtle border to match other cards."
    );
    await page.click('button:has-text("Start Revision")');
    await page.waitForTimeout(3000);

    log("Waiting for revision plan approval…");
    ticket = await waitForTicketStatus(request, ticketId, ["awaiting_plan_approval"], 900_000);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('button:has-text("Approve Plan & Start Fix")', { timeout: 120_000 });
    await page.screenshot({ path: path.join(ARTIFACTS, "06-revision-plan.png"), fullPage: true });
    await page.click('button:has-text("Approve Plan & Start Fix")');

    log("Waiting for revision implementation…");
    ticket = await waitForTicketStatus(
      request,
      ticketId,
      ["awaiting_human_review", "completed", "pr_created"],
      1_800_000
    );

    if (ticket.status === "awaiting_human_review") {
      await page.goto(`${WEB_URL}/admin/review`, { waitUntil: "networkidle" });
      await page.waitForSelector('button:has-text("Approve & Create PR")', { timeout: 120_000 });
      await page.click('button:has-text("Approve & Create PR")');
      ticket = await waitForTicketStatus(request, ticketId, ["completed", "pr_created"], 300_000);
    }

    await page.goto(`${WEB_URL}/admin/tickets/${ticketId}`, { waitUntil: "networkidle" });
    await page.click('button:has-text("Activity Log")');
    await page.screenshot({ path: path.join(ARTIFACTS, "07-after-revision.png"), fullPage: true });

    const report = {
      ticketId,
      revisionStatus: ticket.status,
      revisionPrUrls: (ticket.pullRequests ?? []).map((pr) => pr.url).filter(Boolean),
      completedAt: new Date().toISOString(),
    };
    await fs.writeFile(path.join(ARTIFACTS, "e2e-revision-report.json"), JSON.stringify(report, null, 2));
    log(`Revision complete — status: ${ticket.status}`);

    const video = page.video();
    await page.waitForTimeout(3000);
    await context.close();
    await browser.close();
    if (video) {
      const videoPath = await video.path();
      const dest = path.join(ARTIFACTS, "videos", "e2e-revision.webm");
      await fs.rename(videoPath, dest).catch(async () => fs.copyFile(videoPath, dest));
      log(`Revision video: ${dest}`);
    }
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  log("Creating new ticket via API (or reusing E2E_TICKET_ID)");
  if (!ticketId) {
    const createRes = await request.post(`${API_URL}/api/tickets`, {
      data: {
        projectId: PROJECT_ID,
        title: TICKET_TITLE,
        body: TICKET_BODY,
        priority: "P2",
        source: "manual",
      },
    });
    if (!createRes.ok()) {
      const err = await createRes.text();
      throw new Error(`Create ticket failed: ${err}`);
    }
    const { ticket: created } = await createRes.json();
    ticketId = created.id;
  }
  log(`Ticket: ${ticketId}`);

  log("Opening ticket in browser");
  await page.goto(`${WEB_URL}/admin/tickets/${ticketId}`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1", { timeout: 30_000 });
  await page.screenshot({ path: path.join(ARTIFACTS, "01-ticket-created.png"), fullPage: true });

  log("Starting agent workflow");
  await page.click('button:has-text("Run Agent")');
  await page.waitForTimeout(2000);

  log("Waiting for plan approval (clone → analyze → plan)…");
  await waitForTicketStatus(request, ticketId, ["awaiting_plan_approval"], 900_000);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('button:has-text("Approve Plan & Start Fix")', { timeout: 60_000 });
  await page.screenshot({ path: path.join(ARTIFACTS, "02-plan-ready.png"), fullPage: true });
  log("Plan ready — approving");

  await page.click('button:has-text("Approve Plan & Start Fix")');
  await page.waitForTimeout(3000);

  log("Waiting for implementation + review (may take several minutes)…");
  let ticket;
  const implDeadline = Date.now() + 1_800_000;
  while (Date.now() < implDeadline) {
    const res = await request.get(`${API_URL}/api/tickets/${ticketId}`);
    const data = await res.json();
    ticket = data.ticket;
    log(`  status: ${ticket.status}`);
    if (ticket.status === "awaiting_human_review") break;
    if (ticket.status === "failed") {
      throw new Error(`Agent failed: ${ticket.runs?.[0]?.errorMessage ?? "unknown"}`);
    }
    if (ticket.status === "completed" || ticket.status === "pr_created") break;
    await page.reload({ waitUntil: "networkidle" }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 8000));
  }

  if (!ticket || ticket.status === "failed") {
    throw new Error("Implementation did not complete");
  }

  await page.screenshot({ path: path.join(ARTIFACTS, "03-implementation-done.png"), fullPage: true });

  if (ticket.status === "awaiting_human_review") {
    log("Approving in Review Queue");
    await page.goto(`${WEB_URL}/admin/review`, { waitUntil: "networkidle" });
    await page.waitForSelector('button:has-text("Approve & Create PR")', { timeout: 120_000 });
    await page.screenshot({ path: path.join(ARTIFACTS, "04-review-queue.png"), fullPage: true });
    await page.click('button:has-text("Approve & Create PR")');
    await page.waitForTimeout(5000);

    ticket = await waitForTicketStatus(
      request,
      ticketId,
      ["completed", "pr_created"],
      300_000
    );
  }

  // Refresh ticket for PR URLs after push completes
  {
    const res = await request.get(`${API_URL}/api/tickets/${ticketId}`);
    ticket = (await res.json()).ticket;
  }

  await page.goto(`${WEB_URL}/admin/tickets/${ticketId}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS, "05-final-ticket.png"), fullPage: true });

  const report = {
    ticketId,
    title: TICKET_TITLE,
    finalStatus: ticket.status,
    prUrls: (ticket.pullRequests ?? []).map((pr) => pr.url).filter(Boolean),
    completedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(ARTIFACTS, "e2e-report.json"), JSON.stringify(report, null, 2));

  log(`Done — status: ${ticket.status}`);
  const prUrls = (ticket.pullRequests ?? []).map((pr) => pr.url).filter(Boolean);
  for (const url of prUrls) log(`PR: ${url}`);

  // Post-PR revision flow
  if (["completed", "pr_created"].includes(ticket.status) && prUrls.length > 0) {
    log("Starting post-PR revision");
    await page.goto(`${WEB_URL}/admin/tickets/${ticketId}`, { waitUntil: "networkidle" });
    await page.waitForSelector("#post-pr-revision", { timeout: 30_000 });
    await page.fill(
      "#post-pr-revision textarea",
      "Make the Total Users card title slightly larger and add a subtle border to match other cards."
    );
    await page.click('button:has-text("Start Revision")');
    await page.waitForTimeout(3000);

    log("Waiting for revision plan approval…");
    await waitForTicketStatus(request, ticketId, ["awaiting_plan_approval"], 900_000);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('button:has-text("Approve Plan & Start Fix")', { timeout: 120_000 });
    await page.screenshot({ path: path.join(ARTIFACTS, "06-revision-plan.png"), fullPage: true });
    await page.click('button:has-text("Approve Plan & Start Fix")');

    log("Waiting for revision implementation…");
    ticket = await waitForTicketStatus(
      request,
      ticketId,
      ["awaiting_human_review", "completed", "pr_created"],
      1_800_000
    );

    if (ticket.status === "awaiting_human_review") {
      await page.goto(`${WEB_URL}/admin/review`, { waitUntil: "networkidle" });
      await page.waitForSelector('button:has-text("Approve & Create PR")', { timeout: 120_000 });
      await page.click('button:has-text("Approve & Create PR")');
      ticket = await waitForTicketStatus(request, ticketId, ["completed", "pr_created"], 300_000);
    }

    await page.goto(`${WEB_URL}/admin/tickets/${ticketId}`, { waitUntil: "networkidle" });
    await page.click('button:has-text("Activity Log")');
    await page.waitForSelector("text=revision", { timeout: 30_000 }).catch(() => undefined);
    await page.screenshot({ path: path.join(ARTIFACTS, "07-after-revision.png"), fullPage: true });
    report.revisionStatus = ticket.status;
    report.revisionPrUrls = (ticket.pullRequests ?? []).map((pr) => pr.url).filter(Boolean);
    log(`Revision complete — status: ${ticket.status}`);
  }

  const video = page.video();
  await page.waitForTimeout(3000);
  await context.close();
  await browser.close();

  if (video) {
    const videoPath = await video.path();
    const dest = path.join(ARTIFACTS, "videos", "e2e-agent-flow.webm");
    await fs.rename(videoPath, dest).catch(async () => {
      await fs.copyFile(videoPath, dest);
    });
    log(`E2E video: ${dest}`);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("[e2e] FAILED:", err);
  process.exit(1);
});
