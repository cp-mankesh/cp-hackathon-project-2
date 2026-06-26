import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeRepo, implementWithOpenHands, getDiffSummary } from "../src/openhands";
import { generatePlan, reviewCode } from "../src/openai";
import { cloneRepository, createBranch, checkoutAgentBranch, commitAndPush } from "../src/index";
import { checkoutBaseBranch, execGit, fetchRemoteBranch, remoteBranchExists, rebaseOntoRemoteBranch } from "../src/git";

describe("@ados/agents openai", () => {
  it("generatePlan works without API key (fallback)", async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const plan = await generatePlan({
      title: "Add endpoint",
      body: "Create GET /health",
      fileTree: "src/\n",
      keyFiles: "package.json",
    });

    expect(plan.summary).toContain("Add endpoint");
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.filesToModify.length).toBeGreaterThan(0);

    if (original) process.env.OPENAI_API_KEY = original;
  });

  it("reviewCode works without API key (heuristic)", async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const pass = await reviewCode({
      title: "Test",
      body: "Body",
      plan: "{}",
      diffSummary: "changes",
      testOutput: "all tests passed",
    });
    expect(pass.approved).toBe(true);

    const fail = await reviewCode({
      title: "Test",
      body: "Body",
      plan: "{}",
      diffSummary: "changes",
      testOutput: "tests fail",
    });
    expect(fail.approved).toBe(false);

    if (original) process.env.OPENAI_API_KEY = original;
  });
});

describe("@ados/agents openhands", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("analyzeRepo reads file tree and key files", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ados-test-"));
    await fs.writeFile(path.join(tmpDir, "package.json"), '{"name":"test"}');
    await fs.mkdir(path.join(tmpDir, "src"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, "src", "index.ts"), "export {}");

    const result = await analyzeRepo(tmpDir);
    expect(result.fileTree).toContain("package.json");
    expect(result.fileTree).toContain("src/");
    expect(result.keyFiles).toContain("test");
  });

  it("implementWithOpenHands reports failure when OpenAI is not configured", async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ados-test-"));

    const result = await implementWithOpenHands({
      workspacePath: tmpDir,
      plan: "Step 1: add file",
      ticketTitle: "Demo ticket",
      ticketBody: "Do something",
      attempt: 1,
    });

    expect(result.success).toBe(false);
    expect(result.summary).toContain("OPENAI_API_KEY");
    if (original) process.env.OPENAI_API_KEY = original;
  });

  it("cloneRepository clones a public GitHub repo", async () => {
    tmpDir = path.join(os.tmpdir(), `ados-clone-test-${Date.now()}`);
    await cloneRepository({
      repoFullName: "cp-mankesh/cp-hackathon-project-1",
      workspacePath: tmpDir,
      branch: "main",
    });
    const pkg = await fs.readFile(path.join(tmpDir, "package.json"), "utf-8");
    expect(pkg).toContain("name");
  }, 60_000);

  it("createBranch is idempotent when agent branch already exists", async () => {
    tmpDir = path.join(os.tmpdir(), `ados-branch-test-${Date.now()}`);
    await cloneRepository({
      repoFullName: "cp-mankesh/cp-hackathon-project-1",
      workspacePath: tmpDir,
    });

    const branchName = "agent/ticket-test-idempotent";
    await createBranch(tmpDir, branchName);
    await checkoutBaseBranch(tmpDir);
    await expect(createBranch(tmpDir, branchName)).resolves.toBeUndefined();

    const { stdout } = await execGit(["branch", "--show-current"], { cwd: tmpDir });
    expect(stdout.trim()).toBe(branchName);
  }, 60_000);

  it("cloneRepository skips re-clone when workspace already exists", async () => {
    tmpDir = path.join(os.tmpdir(), `ados-clone-skip-${Date.now()}`);
    await cloneRepository({
      repoFullName: "cp-mankesh/cp-hackathon-project-1",
      workspacePath: tmpDir,
    });
    const marker = path.join(tmpDir, ".clone-once-marker");
    await fs.writeFile(marker, "ok");
    await cloneRepository({
      repoFullName: "cp-mankesh/cp-hackathon-project-1",
      workspacePath: tmpDir,
    });
    await expect(fs.readFile(marker, "utf-8")).resolves.toBe("ok");
  }, 60_000);

  it("checkoutAgentBranch resolves branches with slashes via explicit refs", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ados-slash-branch-"));
    const bareDir = path.join(os.tmpdir(), `ados-slash-bare-${Date.now()}`);
    const branchName = "agent/ticket-slash-test";

    await execGit(["init"], { cwd: tmpDir });
    await execGit(["config", "user.email", "test@ados.local"], { cwd: tmpDir });
    await execGit(["config", "user.name", "Test"], { cwd: tmpDir });
    await fs.writeFile(path.join(tmpDir, "README.md"), "hello");
    await execGit(["add", "README.md"], { cwd: tmpDir });
    await execGit(["commit", "-m", "init"], { cwd: tmpDir });
    await execGit(["branch", "-M", "main"], { cwd: tmpDir });
    await execGit(["checkout", "-b", branchName], { cwd: tmpDir });
    await fs.writeFile(path.join(tmpDir, "README.md"), "agent change");
    await execGit(["commit", "-am", "agent"], { cwd: tmpDir });
    await execGit(["checkout", "main"], { cwd: tmpDir });

    await fs.mkdir(bareDir, { recursive: true });
    await execGit(["init", "--bare"], { cwd: bareDir });
    await execGit(["remote", "add", "origin", bareDir], { cwd: tmpDir });
    await execGit(["push", "-u", "origin", "main"], { cwd: tmpDir });
    await execGit(["push", "-u", "origin", branchName], { cwd: tmpDir });

    const workspace = path.join(os.tmpdir(), `ados-slash-ws-${Date.now()}`);
    await execGit(["clone", bareDir, workspace]);

    await fetchRemoteBranch(workspace, branchName);
    expect(await remoteBranchExists(workspace, branchName)).toBe(true);

    await checkoutAgentBranch({
      workspacePath: workspace,
      branchName,
      repoFullName: "local/test",
    });

    const { stdout } = await execGit(["branch", "--show-current"], { cwd: workspace });
    expect(stdout.trim()).toBe(branchName);
    const readme = await fs.readFile(path.join(workspace, "README.md"), "utf-8");
    expect(readme).toBe("agent change");

    await fs.rm(workspace, { recursive: true, force: true });
    await fs.rm(bareDir, { recursive: true, force: true });
  });

  it("commitAndPush returns alreadyUpToDate when working tree matches remote", async () => {
    const bareDir = path.join(os.tmpdir(), `ados-bare-up-to-date-${Date.now()}`);
    const workspace = path.join(os.tmpdir(), `ados-ws-up-to-date-${Date.now()}`);
    const branchName = "agent/ticket-up-to-date";
    const token = "test-token";

    await fs.mkdir(bareDir, { recursive: true });
    await execGit(["init", "--bare"], { cwd: bareDir });
    await execGit(["clone", bareDir, workspace]);
    await execGit(["config", "user.email", "test@ados.local"], { cwd: workspace });
    await execGit(["config", "user.name", "Test"], { cwd: workspace });
    await fs.writeFile(path.join(workspace, "README.md"), "hello");
    await execGit(["add", "README.md"], { cwd: workspace });
    await execGit(["commit", "-m", "init"], { cwd: workspace });
    await execGit(["branch", "-M", "main"], { cwd: workspace });
    await execGit(["checkout", "-b", branchName], { cwd: workspace });
    await execGit(["remote", "set-url", "origin", bareDir], { cwd: workspace });
    await execGit(["push", "-u", "origin", branchName], { cwd: workspace });

    const result = await commitAndPush({
      workspacePath: workspace,
      branchName,
      message: "[Agent] test",
      token,
      repoFullName: "local/test",
    });

    expect(result.alreadyUpToDate).toBe(true);
    expect(result.pushed).toBe(false);

    await fs.rm(workspace, { recursive: true, force: true });
    await fs.rm(bareDir, { recursive: true, force: true });
  });

  it("getDiffSummary includes untracked new files", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ados-diff-untracked-"));
    await execGit(["init"], { cwd: tmpDir });
    await execGit(["config", "user.email", "test@ados.local"], { cwd: tmpDir });
    await execGit(["config", "user.name", "Test"], { cwd: tmpDir });
    await fs.writeFile(path.join(tmpDir, "README.md"), "base");
    await execGit(["add", "README.md"], { cwd: tmpDir });
    await execGit(["commit", "-m", "init"], { cwd: tmpDir });
    await execGit(["branch", "-M", "main"], { cwd: tmpDir });

    await fs.mkdir(path.join(tmpDir, "src"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, "src", "new-card.tsx"), "export const TotalUsers = 1;\n");

    const diff = await getDiffSummary(tmpDir, "main");
    expect(diff).toContain("new-card.tsx");
    expect(diff).toContain("+export const TotalUsers");
  });

  it("rebaseOntoRemoteBranch integrates remote commits before push", async () => {
    const bareDir = path.join(os.tmpdir(), `ados-bare-rebase-${Date.now()}`);
    const workspace = path.join(os.tmpdir(), `ados-ws-rebase-${Date.now()}`);
    const other = path.join(os.tmpdir(), `ados-other-rebase-${Date.now()}`);
    const branchName = "agent/ticket-rebase-test";

    await fs.mkdir(bareDir, { recursive: true });
    await execGit(["init", "--bare"], { cwd: bareDir });
    await execGit(["clone", bareDir, workspace]);
    await execGit(["config", "user.email", "test@ados.local"], { cwd: workspace });
    await execGit(["config", "user.name", "Test"], { cwd: workspace });
    await fs.writeFile(path.join(workspace, "README.md"), "base");
    await execGit(["add", "README.md"], { cwd: workspace });
    await execGit(["commit", "-m", "init"], { cwd: workspace });
    await execGit(["branch", "-M", "main"], { cwd: workspace });
    await execGit(["checkout", "-b", branchName], { cwd: workspace });
    await execGit(["remote", "set-url", "origin", bareDir], { cwd: workspace });
    await execGit(["push", "-u", "origin", branchName], { cwd: workspace });

    await fs.writeFile(path.join(workspace, "feature.txt"), "local work");
    await execGit(["add", "feature.txt"], { cwd: workspace });
    await execGit(["commit", "-m", "local feature"], { cwd: workspace });

    await execGit(["clone", bareDir, other]);
    await execGit(["config", "user.email", "test@ados.local"], { cwd: other });
    await execGit(["config", "user.name", "Test"], { cwd: other });
    await execGit(["checkout", branchName], { cwd: other });
    await fs.writeFile(path.join(other, "remote.txt"), "remote work");
    await execGit(["add", "remote.txt"], { cwd: other });
    await execGit(["commit", "-m", "remote advance"], { cwd: other });
    await execGit(["push", "origin", branchName], { cwd: other });

    await rebaseOntoRemoteBranch(workspace, branchName);

    await expect(fs.readFile(path.join(workspace, "remote.txt"), "utf-8")).resolves.toBe("remote work");
    await expect(fs.readFile(path.join(workspace, "feature.txt"), "utf-8")).resolves.toBe("local work");

    await fs.rm(workspace, { recursive: true, force: true });
    await fs.rm(other, { recursive: true, force: true });
    await fs.rm(bareDir, { recursive: true, force: true });
  });
});
