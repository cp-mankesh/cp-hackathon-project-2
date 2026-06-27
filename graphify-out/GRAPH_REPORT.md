# Graph Report - cp-hackathon-project-2  (2026-06-27)

## Corpus Check
- 457 files · ~226,715 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1133 nodes · 3518 edges · 86 communities (73 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f14ce0a7`
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
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 43|Community 43]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 128 edges
2. `routes` - 53 edges
3. `getSessionUser()` - 41 edges
4. `buttonVariants` - 37 edges
5. `userCan()` - 37 edges
6. `Card()` - 33 edges
7. `CardHeader()` - 33 edges
8. `CardTitle()` - 33 edges
9. `CardDescription()` - 33 edges
10. `CardContent()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `parseDetailedPlan()` --calls--> `normalizeDetailedPlan()`  [INFERRED]
  apps/web/src/components/PlanViewer.tsx → packages/shared/src/plan-normalize.ts
- `ChangeSummaryViewer()` --calls--> `isMeaningfulDiffText()`  [INFERRED]
  apps/web/src/components/ChangeSummaryViewer.tsx → packages/shared/src/diff-parse.ts
- `commitPushAndUpdatePrActivity()` --calls--> `commitAndPush()`  [INFERRED]
  workers/temporal/src/activities/index.ts → packages/agents/src/index.ts
- `commitPushAndUpdatePrActivity()` --calls--> `findOpenPullRequest()`  [INFERRED]
  workers/temporal/src/activities/index.ts → packages/agents/src/index.ts
- `commitPushAndUpdatePrActivity()` --calls--> `createPullRequest()`  [INFERRED]
  workers/temporal/src/activities/index.ts → packages/agents/src/index.ts

## Communities (86 total, 13 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (35): AuthActionState, loginAction(), loginSchema, logoutAction(), registerCompanyAction(), registerSchema, HomePage(), AuthCard() (+27 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (35): UserActionState, inviteSchema, inviteUserAction(), removeUserAction(), roleCanAdministerUsers(), updateUserRoleAction(), GET(), parseRangeHeader() (+27 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (85): bareDir, marker, other, workspace, formatAppliedChanges(), isMeaningfulDiffText(), listChangedFilesFromDiff(), ParsedDiffFile (+77 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (60): commitPushAndUpdatePrActivity(), createSession(), getSessionToken(), getUserFromSession(), requireUser(), decryptSecret(), encryptionKey(), encryptSecret() (+52 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (32): Props, Props, RecordingCard(), TranscriptLine(), FILLS, Props, tooltipStyle, DashboardCharts() (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (24): AGENT_SCORE_KEYS, CallAudioTranscript(), CallDetail, CallDetailView(), Props, CallOverviewCharts(), CallsListTable(), Props (+16 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (23): env, AnalysisLogPayload, LOG_ROOT, logAnalysisEvent(), LogLevel, readAudioFile(), resolveAudioPath(), resolveProjectRoot() (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (34): 10. Data model (aligned with UI + SaaS), 11. Background processing (operational contract), 12. Configuration & secrets, 13.1 Scoring (100 points total), 13.2 Deliverables checklist (all required), 13. Evaluation criteria & deliverables (official), 14. Phased delivery (suggested), 15. Success criteria (merged checklist) (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (32): applyEnvDefaults(), buildDevPackages(), checkPrerequisites(), commandExists(), dataDir, __dirname, ensureDataDirs(), ensureTemporalRunning() (+24 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (16): ChangeSummaryViewer(), parseChangeSummary(), parseDetailedPlan(), PlanViewer(), TicketConversationViewer(), ProjectRepository, TicketDetail, TicketDetailPage() (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (33): 1. Prerequisites, 2. Environment, 3. Start infrastructure, 4. Install & database, 5. Run all services, 6. Sign in, Autonomous Delivery App, Autonomous Delivery App (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.17
Nodes (11): setThemeCookieAction(), fontBody, fontHeading, fontMono, metadata, RootLayout(), THEME_COOKIE, ThemeCookieValue (+3 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (24): 10. Data and validation, 11. Naming conventions, 12. Environment and configuration, 13. Security, 14. Performance, 15. Testing and quality, 16. Git and collaboration, 17. Documentation (+16 more)

### Community 13 - "Community 13"
Cohesion: 0.1
Nodes (23): AGENT_MAX_RETRIES, AGENT_MAX_REVIEW_ROUNDS, AppliedChangeSummary, AppliedFileChange, DetailedPlan, FileChangePlan, ImplementResult, IntegrationType (+15 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (16): activities, PlanApprovalPayload, PlanRejectionPayload, PlanRevisionPayload, ReviewApprovalPayload, ReviewRejectionPayload, TicketActivities, TicketWorkflowInput (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.32
Nodes (15): ACTION_POOL, AnalysisPipelineInput, AnalysisPipelineResult, analyzeTranscriptStub(), dimensionScore(), KEYWORD_POOL, NEGATIVE_POOL, POSITIVE_POOL (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.35
Nodes (15): DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuPortal(), DropdownMenuRadioGroup() (+7 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (14): Auth & tenancy, Call analysis flow, Call Intelligence Platform, code:bash (cp .env.example .env), code:bash (npm install), code:bash (npm run db:migrate), code:bash (npm run dev), code:bash (npm run worker) (+6 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (8): Ticket, priorityColor(), statusColor(), GitHubIssue, Project, ProjectRepository, Ticket, TicketHubPage()

### Community 19 - "Community 19"
Cohesion: 0.4
Nodes (8): adminPermissions, memberPermissions, CrudFlags, fullAccess, noAccess, PermissionModule, permissionModules, readOnly

### Community 20 - "Community 20"
Cohesion: 0.19
Nodes (3): AuthUser, PublicProject, api()

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (8): results, reviews, parseReviewArtifacts(), ReviewArtifactItem, ReviewNotesViewer(), parseTestArtifacts(), TestArtifactItem, TestResultsViewer()

### Community 22 - "Community 22"
Cohesion: 0.44
Nodes (10): Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetPortal() (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.29
Nodes (8): ARTIFACTS, buildReportHtml(), __dirname, execFileAsync, main(), recordVideo(), ROOT, runTests()

### Community 25 - "Community 25"
Cohesion: 0.53
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 26 - "Community 26"
Cohesion: 0.2
Nodes (9): Code fixes applied during this session, code:bash (# E2E flow (headed browser + video)), End-to-End Test Report — Total User Dashboard Card, Flow exercised (browser automation), How to replay, Screenshots, Ticket, Unit tests (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.31
Nodes (7): derivePlanStatus(), deriveTestStatus(), parseTestPassed(), RunArtifact, RunLike, TicketLike, TicketStatusChip

### Community 28 - "Community 28"
Cohesion: 0.36
Nodes (7): ARTIFACTS, createGithubUserSession(), __dirname, loadEnv(), main(), ROOT, waitForTicketStatus()

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (5): GhRepo, LocalRepoInfo, PendingLocalRepo, Project, ProjectRepository

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (3): __dirname, ports, root

## Knowledge Gaps
- **173 isolated node(s):** `prisma`, `__dirname`, `ROOT`, `ARTIFACTS`, `__dirname` (+168 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 0` to `Community 32`, `Community 1`, `Community 4`, `Community 5`, `Community 9`, `Community 11`, `Community 16`, `Community 18`, `Community 21`, `Community 22`, `Community 25`, `Community 29`?**
  _High betweenness centrality (0.360) - this node is a cross-community bridge._
- **Why does `isMeaningfulDiffText()` connect `Community 2` to `Community 9`?**
  _High betweenness centrality (0.175) - this node is a cross-community bridge._
- **Why does `ChangeSummaryViewer()` connect `Community 9` to `Community 2`?**
  _High betweenness centrality (0.175) - this node is a cross-community bridge._
- **What connects `prisma`, `__dirname`, `ROOT` to the rest of the system?**
  _173 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._