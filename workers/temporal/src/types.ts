export const approveReviewSignal = "approveReview";
export const rejectReviewSignal = "rejectReview";
export const approvePlanSignal = "approvePlan";
export const rejectPlanSignal = "rejectPlan";
export const revisePlanSignal = "revisePlan";

export interface TicketWorkflowInput {
  ticketId: string;
  projectId: string;
  repositories: Array<{
    repoFullName: string;
    defaultBranch: string;
    label?: string | null;
    sourceType?: "github" | "local";
    localPath?: string | null;
    remoteUrl?: string | null;
    gitUsername?: string | null;
    gitToken?: string | null;
  }>;
  title: string;
  body: string;
  githubToken?: string;
  mode?: "initial" | "revision";
  revisionPrompt?: string;
}

export interface ReviewApprovalPayload {
  reviewerId?: string;
  notes?: string;
}

export interface ReviewRejectionPayload {
  reviewerId?: string;
  notes?: string;
}

export interface PlanApprovalPayload {
  reviewerId?: string;
  notes?: string;
}

export interface PlanRejectionPayload {
  reviewerId?: string;
  notes?: string;
}

export interface PlanRevisionPayload {
  reviewerId?: string;
  prompt: string;
}

export interface TicketWorkflowResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

export type TicketActivities = {
  claimTicket(ticketId: string, runId: string): Promise<void>;
  updateTicketStatus(ticketId: string, status: string, step?: string): Promise<void>;
  logEvent(runId: string, step: string, message: string, payload?: unknown): Promise<void>;
  saveArtifact(runId: string, type: string, content: string): Promise<void>;
  cloneRepo(input: TicketWorkflowInput & { runId: string }): Promise<void>;
  loadTicketContext(
    ticketId: string,
    excludeRunId?: string
  ): Promise<{
    activityTranscript: string;
    previousPlan?: string;
    previousChangeSummary?: string;
    previousDiffSummary?: string;
    branchName?: string;
    prUrl?: string;
  }>;
  syncAgentBranch(input: {
    ticketId: string;
    branchName: string;
    repositories: TicketWorkflowInput["repositories"];
    githubToken?: string;
  }): Promise<void>;
  createBranches(
    ticketId: string,
    branchName: string,
    repositories: TicketWorkflowInput["repositories"],
    githubToken?: string
  ): Promise<string>;
  analyzeRepos(
    ticketId: string,
    repositories: TicketWorkflowInput["repositories"],
    ticket?: { title: string; body: string }
  ): Promise<{ fileTree: string; keyFiles: string; relevantFiles: string[] }>;
  generateDetailedPlan(input: {
    title: string;
    body: string;
    fileTree: string;
    keyFiles: string;
    relevantFiles?: string[];
    revisionNotes?: string;
    previousPlan?: string;
    conversationHistory?: string;
    previousChangeSummary?: string;
    previousDiffSummary?: string;
  }): Promise<{
    plainLanguageSummary: string;
    approach: string[];
    estimatedFiles: string[];
    fileChanges: Array<{
      file: string;
      plainSummary: string;
      whatWeWillAdd: string[];
      whatWeWillRemove: string[];
      diffPreview: string;
    }>;
    formattedDiff: string;
  }>;
  setAwaitingPlanApproval(runId: string, ticketId: string): Promise<void>;
  resumeAfterPlanApproval(runId: string, ticketId: string): Promise<void>;
  summarizeAppliedChanges(input: {
    title: string;
    body: string;
    diffSummary: string;
  }): Promise<{
    plainLanguageSummary: string;
    files: Array<{
      file: string;
      whatItDoes: string;
      beforeDescription: string;
      afterDescription: string;
      diffPreview: string;
    }>;
    formattedDiff: string;
  }>;
  implementCode(input: {
    ticketId: string;
    repositories: TicketWorkflowInput["repositories"];
    plan: string;
    title: string;
    body: string;
    attempt: number;
    reviewFeedback?: string;
    conversationHistory?: string;
    previousChangeSummary?: string;
    previousDiffSummary?: string;
  }): Promise<{ success: boolean; filesChanged: string[]; summary: string }>;
  runTests(
    ticketId: string,
    repositories: TicketWorkflowInput["repositories"]
  ): Promise<{ passed: boolean; output: string; command: string }>;
  reviewCode(input: {
    title: string;
    body: string;
    plan: string;
    diffSummary: string;
    testOutput: string;
  }): Promise<{ approved: boolean; feedback: string; changesRequested: boolean }>;
  getDiffSummary(
    ticketId: string,
    repositories: TicketWorkflowInput["repositories"]
  ): Promise<string>;
  validateChanges(
    ticketId: string,
    repositories: TicketWorkflowInput["repositories"]
  ): Promise<{
    hasChanges: boolean;
    meaningful: boolean;
    files: string[];
  }>;
  setAwaitingHumanReview(runId: string, ticketId: string): Promise<void>;
  commitPushAllRepos(input: {
    ticketId: string;
    runId: string;
    branchName: string;
    repositories: TicketWorkflowInput["repositories"];
    title: string;
    body: string;
    githubToken?: string;
  }): Promise<Array<{ number: number; url: string; repoFullName: string }>>;
  commitPushAndCreatePr(input: {
    workspacePath: string;
    branchName: string;
    repoFullName: string;
    defaultBranch: string;
    title: string;
    body: string;
    ticketId: string;
    runId: string;
    githubToken?: string;
  }): Promise<{ number: number; url: string }>;
  commitPushAndUpdatePr(input: {
    workspacePath: string;
    branchName: string;
    repoFullName: string;
    defaultBranch: string;
    title: string;
    body: string;
    ticketId: string;
    runId: string;
    githubToken?: string;
  }): Promise<{ number: number; url: string }>;
  markCompleted(ticketId: string, runId: string, prUrl?: string): Promise<void>;
  markFailed(ticketId: string, runId: string, error: string): Promise<void>;
  markRejected(ticketId: string, runId: string, notes?: string): Promise<void>;
};
