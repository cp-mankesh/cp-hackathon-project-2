# Graph Report - cp-hackathon-project-2  (2026-06-26)

## Corpus Check
- 83 files · ~137,333 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 383 nodes · 679 edges · 32 communities (25 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]

## God Nodes (most connected - your core abstractions)
1. `execGit()` - 20 edges
2. `api()` - 16 edges
3. `Quick Start` - 13 edges
4. `checkoutAgentBranch()` - 12 edges
5. `cn()` - 12 edges
6. `cloneRepository()` - 11 edges
7. `createBranch()` - 10 edges
8. `commitAndPush()` - 10 edges
9. `generateDetailedPlan()` - 9 edges
10. `buildApp()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `parseDetailedPlan()` --calls--> `normalizeDetailedPlan()`  [INFERRED]
  apps/web/src/components/PlanViewer.tsx → packages/shared/src/plan-normalize.ts
- `ChangeSummaryViewer()` --calls--> `isMeaningfulDiffText()`  [INFERRED]
  apps/web/src/components/ChangeSummaryViewer.tsx → packages/shared/src/diff-parse.ts
- `loadProjectRepositories()` --calls--> `resolveProjectRepositories()`  [INFERRED]
  apps/api/src/routes/tickets.ts → packages/shared/src/repo-paths.ts
- `commitPushAndUpdatePrActivity()` --calls--> `commitAndPush()`  [INFERRED]
  workers/temporal/src/activities/index.ts → packages/agents/src/index.ts
- `commitPushAndUpdatePrActivity()` --calls--> `findOpenPullRequest()`  [INFERRED]
  workers/temporal/src/activities/index.ts → packages/agents/src/index.ts

## Communities (32 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (31): results, reviews, ChangeSummaryViewer(), parseChangeSummary(), parseDetailedPlan(), PlanViewer(), parseReviewArtifacts(), ReviewArtifactItem (+23 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (31): loadProjectRepositories(), isMeaningfulDiffText(), listChangedFilesFromDiff(), ParsedDiffFile, parseUnifiedDiffByFile(), files, analyzeMultiRepo(), getMultiRepoDiffSummary() (+23 more)

### Community 2 - "Community 2"
Cohesion: 0.19
Nodes (31): commitPushAndUpdatePrActivity(), bareDir, marker, other, workspace, buildAuthenticatedRepoUrl(), buildPublicRepoUrl(), checkoutBaseBranch() (+23 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (25): createSession(), getSessionToken(), getUserFromSession(), requireUser(), getClient(), signalApprovePlan(), signalApproveReview(), signalRejectPlan() (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (9): PublicProject, AdminSidebar(), nav, api(), Project, ProjectRepository, GhRepo, Project (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (22): formatAppliedChanges(), fallbackDetailedPlan(), formatChangeSummaryForDisplay(), generateDetailedPlan(), generatePlan(), getClient(), reviewCode(), summarizeAppliedChanges() (+14 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (26): 1. Prerequisites, 2. Environment, 3. Start infrastructure, 4. Install & database, 5. Run all services, 6. Sign in, Autonomous Delivery App, Autonomous Delivery App (+18 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (23): AGENT_MAX_RETRIES, AGENT_MAX_REVIEW_ROUNDS, AppliedChangeSummary, AppliedFileChange, DetailedPlan, FileChangePlan, ImplementResult, IntegrationType (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (16): activities, PlanApprovalPayload, PlanRejectionPayload, PlanRevisionPayload, ReviewApprovalPayload, ReviewRejectionPayload, TicketActivities, TicketWorkflowInput (+8 more)

### Community 9 - "Community 9"
Cohesion: 0.36
Nodes (9): assertPortsFree(), __dirname, ensureEnv(), isPortInUse(), loadEnvFile(), main(), root, runSync() (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (8): ARTIFACTS, buildReportHtml(), __dirname, execFileAsync, main(), recordVideo(), ROOT, runTests()

### Community 11 - "Community 11"
Cohesion: 0.2
Nodes (9): Code fixes applied during this session, code:bash (# E2E flow (headed browser + video)), End-to-End Test Report — Total User Dashboard Card, Flow exercised (browser automation), How to replay, Screenshots, Ticket, Unit tests (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.36
Nodes (7): ARTIFACTS, createGithubUserSession(), __dirname, loadEnv(), main(), ROOT, waitForTicketStatus()

### Community 13 - "Community 13"
Cohesion: 0.4
Nodes (3): __dirname, ports, root

## Knowledge Gaps
- **97 isolated node(s):** `__dirname`, `root`, `prisma`, `__dirname`, `ROOT` (+92 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `isMeaningfulDiffText()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **Why does `ChangeSummaryViewer()` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **Why does `normalizeDetailedPlan()` connect `Community 7` to `Community 0`, `Community 5`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **What connects `__dirname`, `root`, `prisma` to the rest of the system?**
  _97 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._