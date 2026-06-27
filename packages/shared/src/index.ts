export type TicketSource = "github" | "jira" | "manual";
export type TicketPriority = "P0" | "P1" | "P2" | "P3";
export type TicketStatus =
  | "pending"
  | "claimed"
  | "cloning"
  | "planning"
  | "awaiting_plan_approval"
  | "implementing"
  | "testing"
  | "reviewing"
  | "awaiting_human_review"
  | "approved"
  | "pushing"
  | "pr_created"
  | "completed"
  | "failed"
  | "rejected";

export type WorkflowRunStatus =
  | "running"
  | "awaiting_plan_approval"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "rejected";

export type IntegrationType = "github" | "jira";

export type UserRole = "super_admin" | "admin" | "developer" | "viewer";

export interface TicketWorkflowInput {
  ticketId: string;
  projectId: string;
  repoFullName: string;
  defaultBranch: string;
  title: string;
  body: string;
  githubToken?: string;
}

export interface PlanResult {
  summary: string;
  steps: string[];
  filesToModify: string[];
}

export interface FileChangePlan {
  file: string;
  plainSummary: string;
  whatWeWillAdd: string[];
  whatWeWillRemove: string[];
  diffPreview: string;
}

export interface DetailedPlan {
  plainLanguageSummary: string;
  approach: string[];
  estimatedFiles: string[];
  fileChanges: FileChangePlan[];
  formattedDiff: string;
}

export interface AppliedFileChange {
  file: string;
  whatItDoes: string;
  beforeDescription: string;
  afterDescription: string;
  diffPreview: string;
}

export interface AppliedChangeSummary {
  plainLanguageSummary: string;
  files: AppliedFileChange[];
  formattedDiff: string;
}

export interface ImplementResult {
  success: boolean;
  filesChanged: string[];
  summary: string;
}

export interface TestResult {
  passed: boolean;
  output: string;
  command: string;
}

export interface ReviewResult {
  approved: boolean;
  feedback: string;
  changesRequested: boolean;
}

export const AGENT_MAX_RETRIES = Number(process.env.AGENT_MAX_RETRIES ?? 3);
export const AGENT_MAX_REVIEW_ROUNDS = Number(process.env.AGENT_MAX_REVIEW_ROUNDS ?? 2);
export const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? "ados-ticket-queue";

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  P0: "Critical",
  P1: "Important",
  P2: "Standard",
  P3: "Low",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  pending: "Pending",
  claimed: "Claimed",
  cloning: "Cloning Repo",
  planning: "Planning",
  awaiting_plan_approval: "Awaiting Plan Approval",
  implementing: "Implementing",
  testing: "Running Tests",
  reviewing: "Code Review",
  awaiting_human_review: "Awaiting Review",
  approved: "Approved",
  pushing: "Pushing Changes",
  pr_created: "PR Created",
  completed: "Completed",
  failed: "Failed",
  rejected: "Rejected",
};

export { asStringList, normalizeDetailedPlan, normalizeFileChangePlan } from "./plan-normalize";
export {
  encodeRepoFilePath,
  decodeRepoFilePath,
  repoWorkspaceDirName,
  ticketRepoWorkspace,
  resolveRepoWorkspace,
  groupFilesByRepo,
  resolveProjectRepositories,
  type ProjectRepositoryInfo,
  type RepoSourceType,
} from "./repo-paths";
export {
  localRepoId,
  isGitHubRemoteUrl,
  parseGitHubRepoFromRemote,
  isLocalRepository,
} from "./local-repo";
export {
  parseUnifiedDiffByFile,
  listChangedFilesFromDiff,
  isMeaningfulDiffText,
  type ParsedDiffFile,
} from "./diff-parse";
