# Graph Report - cp-hackathon-project-2  (2026-06-27)

## Corpus Check
- 265 files · ~181,578 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 900 nodes · 2119 edges · 66 communities (53 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `66098e29`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 39|Community 39]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 69 edges
2. `routes` - 26 edges
3. `Project Rules — Next.js, Prisma & PostgreSQL` - 21 edges
4. `execGit()` - 20 edges
5. `getSessionUser()` - 20 edges
6. `Call Analyser — Project Plan` - 19 edges
7. `buttonVariants` - 18 edges
8. `userCan()` - 18 edges
9. `Quick Start` - 18 edges
10. `api()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `parseDetailedPlan()` --calls--> `normalizeDetailedPlan()`  [INFERRED]
  apps/web/src/components/PlanViewer.tsx → packages/shared/src/plan-normalize.ts
- `ChangeSummaryViewer()` --calls--> `isMeaningfulDiffText()`  [INFERRED]
  apps/web/src/components/ChangeSummaryViewer.tsx → packages/shared/src/diff-parse.ts
- `TicketHubPage()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/app/admin/tickets/page.tsx → workers/temporal/data/workspaces/cmqvwtrd60004cactf709yvgh/cp-mankesh__cp-hackathon-project-1/src/lib/utils.ts
- `loadProjectRepositories()` --calls--> `resolveProjectRepositories()`  [INFERRED]
  apps/api/src/routes/tickets.ts → packages/shared/src/repo-paths.ts
- `commitPushAndUpdatePrActivity()` --calls--> `commitAndPush()`  [INFERRED]
  workers/temporal/src/activities/index.ts → packages/agents/src/index.ts

## Communities (66 total, 13 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (84): commitPushAndUpdatePrActivity(), loadProjectRepositories(), bareDir, marker, other, workspace, formatAppliedChanges(), isMeaningfulDiffText() (+76 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (44): setThemeCookieAction(), HomePage(), GET(), parseRangeHeader(), RouteParams, AuthCard(), getSessionUser(), CallDetailPage() (+36 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (62): UserActionState, inviteSchema, inviteUserAction(), removeUserAction(), roleCanAdministerUsers(), updateUserRoleAction(), Props, AGENT_SCORE_KEYS (+54 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (40): ACTION_POOL, AnalysisPipelineInput, AnalysisPipelineResult, analyzeTranscriptStub(), dimensionScore(), KEYWORD_POOL, NEGATIVE_POOL, POSITIVE_POOL (+32 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (32): AuthActionState, loginAction(), loginSchema, logoutAction(), registerCompanyAction(), registerSchema, adminPermissions, memberPermissions (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (28): createSession(), getSessionToken(), getUserFromSession(), requireUser(), getClient(), signalApprovePlan(), signalApproveReview(), signalRejectPlan() (+20 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (34): 10. Data model (aligned with UI + SaaS), 11. Background processing (operational contract), 12. Configuration & secrets, 13.1 Scoring (100 points total), 13.2 Deliverables checklist (all required), 13. Evaluation criteria & deliverables (official), 14. Phased delivery (suggested), 15. Success criteria (merged checklist) (+26 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (32): applyEnvDefaults(), buildDevPackages(), checkPrerequisites(), commandExists(), dataDir, __dirname, ensureDataDirs(), ensureTemporalRunning() (+24 more)

### Community 8 - "Community 8"
Cohesion: 0.1
Nodes (16): ChangeSummaryViewer(), parseChangeSummary(), parseDetailedPlan(), PlanViewer(), TicketConversationViewer(), ProjectRepository, TicketDetail, TicketDetailPage() (+8 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (33): 1. Prerequisites, 2. Environment, 3. Start infrastructure, 4. Install & database, 5. Run all services, 6. Sign in, Autonomous Delivery App, Autonomous Delivery App (+25 more)

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (23): AGENT_MAX_RETRIES, AGENT_MAX_REVIEW_ROUNDS, AppliedChangeSummary, AppliedFileChange, DetailedPlan, FileChangePlan, ImplementResult, IntegrationType (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (24): 10. Data and validation, 11. Naming conventions, 12. Environment and configuration, 13. Security, 14. Performance, 15. Testing and quality, 16. Git and collaboration, 17. Documentation (+16 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (16): activities, PlanApprovalPayload, PlanRejectionPayload, PlanRevisionPayload, ReviewApprovalPayload, ReviewRejectionPayload, TicketActivities, TicketWorkflowInput (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.19
Nodes (10): fontBody, fontHeading, fontMono, metadata, RootLayout(), THEME_COOKIE, ThemeCookieValue, AppProviders() (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (8): Ticket, priorityColor(), statusColor(), GitHubIssue, Project, ProjectRepository, Ticket, TicketHubPage()

### Community 15 - "Community 15"
Cohesion: 0.16
Nodes (5): PublicProject, api(), GhRepo, Project, ProjectRepository

### Community 16 - "Community 16"
Cohesion: 0.22
Nodes (15): DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuPortal(), DropdownMenuRadioGroup() (+7 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (14): Auth & tenancy, Call analysis flow, Call Intelligence Platform, code:bash (cp .env.example .env), code:bash (npm install), code:bash (npm run db:migrate), code:bash (npm run dev), code:bash (npm run worker) (+6 more)

### Community 18 - "Community 18"
Cohesion: 0.19
Nodes (8): results, reviews, parseReviewArtifacts(), ReviewArtifactItem, ReviewNotesViewer(), parseTestArtifacts(), TestArtifactItem, TestResultsViewer()

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (8): ARTIFACTS, buildReportHtml(), __dirname, execFileAsync, main(), recordVideo(), ROOT, runTests()

### Community 20 - "Community 20"
Cohesion: 0.2
Nodes (9): Code fixes applied during this session, code:bash (# E2E flow (headed browser + video)), End-to-End Test Report — Total User Dashboard Card, Flow exercised (browser automation), How to replay, Screenshots, Ticket, Unit tests (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.31
Nodes (7): derivePlanStatus(), deriveTestStatus(), parseTestPassed(), RunArtifact, RunLike, TicketLike, TicketStatusChip

### Community 22 - "Community 22"
Cohesion: 0.36
Nodes (7): ARTIFACTS, createGithubUserSession(), __dirname, loadEnv(), main(), ROOT, waitForTicketStatus()

### Community 23 - "Community 23"
Cohesion: 0.43
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 24 - "Community 24"
Cohesion: 0.48
Nodes (5): Progress(), ProgressIndicator(), ProgressLabel(), ProgressTrack(), ProgressValue()

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (3): __dirname, ports, root

## Knowledge Gaps
- **167 isolated node(s):** `prisma`, `__dirname`, `ROOT`, `ARTIFACTS`, `__dirname` (+162 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 1` to `Community 2`, `Community 4`, `Community 8`, `Community 13`, `Community 14`, `Community 16`, `Community 18`, `Community 23`, `Community 24`, `Community 28`?**
  _High betweenness centrality (0.306) - this node is a cross-community bridge._
- **Why does `isMeaningfulDiffText()` connect `Community 0` to `Community 8`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Why does `ChangeSummaryViewer()` connect `Community 8` to `Community 0`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **What connects `prisma`, `__dirname`, `ROOT` to the rest of the system?**
  _167 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._