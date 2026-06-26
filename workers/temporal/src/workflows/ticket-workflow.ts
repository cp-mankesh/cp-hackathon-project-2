import {
  condition,
  defineSignal,
  proxyActivities,
  rootCause,
  setHandler,
} from "@temporalio/workflow";
import {
  PlanApprovalPayload,
  PlanRejectionPayload,
  PlanRevisionPayload,
  ReviewApprovalPayload,
  ReviewRejectionPayload,
  TicketActivities,
  TicketWorkflowInput,
  TicketWorkflowResult,
} from "../types";
import {
  approvePlanSignal,
  approveReviewSignal,
  rejectPlanSignal,
  rejectReviewSignal,
  revisePlanSignal,
} from "../types";
import { AGENT_MAX_PLAN_REVISIONS, AGENT_MAX_RETRIES, AGENT_MAX_REVIEW_ROUNDS } from "./constants";

const activities = proxyActivities<TicketActivities>({
  startToCloseTimeout: "30 minutes",
  retry: { maximumAttempts: 2 },
});

const cloneActivities = proxyActivities<Pick<TicketActivities, "cloneRepo">>({
  startToCloseTimeout: "3 minutes",
  retry: { maximumAttempts: 1 },
});

export const approvePlan = defineSignal<[PlanApprovalPayload]>(approvePlanSignal);
export const rejectPlan = defineSignal<[PlanRejectionPayload]>(rejectPlanSignal);
export const revisePlan = defineSignal<[PlanRevisionPayload]>(revisePlanSignal);
export const approveReview = defineSignal<[ReviewApprovalPayload]>(approveReviewSignal);
export const rejectReview = defineSignal<[ReviewRejectionPayload]>(rejectReviewSignal);

export async function ticketWorkflow(
  input: TicketWorkflowInput & { runId: string }
): Promise<TicketWorkflowResult> {
  const isRevision = input.mode === "revision";
  const { repositories } = input;
  const repoLabel = repositories.map((r) => r.label ?? r.repoFullName).join(" + ");
  let branchName = `agent/ticket-${input.ticketId}`;
  let conversationContext = "";
  let previousChangeSummary: string | undefined;
  let previousDiffSummary: string | undefined;
  let planApproved = false;
  let planRejected = false;
  let planReviseRequested = false;
  let planRejectionNotes: string | undefined;
  let planApprovalNotes: string | undefined;
  let planRevisionPrompt: string | undefined;
  let approved = false;
  let rejected = false;
  let rejectionNotes: string | undefined;
  let approvalNotes: string | undefined;

  setHandler(approvePlan, (payload) => {
    planApproved = true;
    planApprovalNotes = payload.notes;
  });

  setHandler(rejectPlan, (payload) => {
    planRejected = true;
    planRejectionNotes = payload.notes;
  });

  setHandler(revisePlan, (payload) => {
    planReviseRequested = true;
    planRevisionPrompt = payload.prompt;
  });

  setHandler(approveReview, (payload) => {
    approved = true;
    approvalNotes = payload.notes;
  });

  setHandler(rejectReview, (payload) => {
    rejected = true;
    rejectionNotes = payload.notes;
  });

  try {
    await activities.claimTicket(input.ticketId, input.runId);
    await activities.logEvent(input.runId, "claimed", "Worker claimed ticket");

    let plan: Awaited<ReturnType<TicketActivities["generateDetailedPlan"]>>;
    let analysis: Awaited<ReturnType<TicketActivities["analyzeRepos"]>>;

    if (isRevision) {
      const priorContext = await activities.loadTicketContext(input.ticketId, input.runId);
      conversationContext = priorContext.activityTranscript;
      previousChangeSummary = priorContext.previousChangeSummary;
      previousDiffSummary = priorContext.previousDiffSummary;
      branchName = priorContext.branchName ?? branchName;

      await activities.logEvent(
        input.runId,
        "revision_requested",
        input.revisionPrompt ?? "User requested plan and code revision after PR delivery"
      );

      await activities.updateTicketStatus(input.ticketId, "planning", "revision_sync");
      await activities.syncAgentBranch({
        ticketId: input.ticketId,
        branchName,
        repositories,
        githubToken: input.githubToken,
      });
      await activities.logEvent(
        input.runId,
        "sync",
        `Loaded agent branch ${branchName} across ${repositories.length} repo(s)`
      );

      analysis = await activities.analyzeRepos(input.ticketId, repositories, {
        title: input.title,
        body: input.body,
      });
      await activities.logEvent(input.runId, "analyze", "Repositories re-analyzed for revision");

      plan = await activities.generateDetailedPlan({
        title: input.title,
        body: input.body,
        fileTree: analysis.fileTree,
        keyFiles: analysis.keyFiles,
        relevantFiles: analysis.relevantFiles,
        revisionNotes: input.revisionPrompt,
        previousPlan: priorContext.previousPlan,
        conversationHistory: conversationContext,
        previousChangeSummary,
        previousDiffSummary,
      });
      const revisionArtifactId = `detailed-plan-revision-${Date.now()}`;
      await activities.saveArtifact(input.runId, revisionArtifactId, JSON.stringify(plan, null, 2));
      await activities.saveArtifact(input.runId, "detailed-plan", JSON.stringify(plan, null, 2));
      await activities.saveArtifact(input.runId, "plan", plan.formattedDiff);
      await activities.logEvent(input.runId, "plan", plan.plainLanguageSummary);
    } else {
      await activities.updateTicketStatus(input.ticketId, "cloning", "clone");
      await cloneActivities.cloneRepo({ ...input, runId: input.runId });
      await activities.logEvent(input.runId, "clone", `Cloned ${repoLabel}`);

      await activities.updateTicketStatus(input.ticketId, "planning", "analyze");
      analysis = await activities.analyzeRepos(input.ticketId, repositories, {
        title: input.title,
        body: input.body,
      });
      await activities.logEvent(input.runId, "analyze", `Analyzed ${repositories.length} repository(ies)`);

      plan = await activities.generateDetailedPlan({
        title: input.title,
        body: input.body,
        fileTree: analysis.fileTree,
        keyFiles: analysis.keyFiles,
        relevantFiles: analysis.relevantFiles,
      });
      await activities.saveArtifact(input.runId, "detailed-plan", JSON.stringify(plan, null, 2));
      await activities.saveArtifact(input.runId, "plan", plan.formattedDiff);
      await activities.logEvent(input.runId, "plan", plan.plainLanguageSummary);
    }

    let planRevisionRound = 0;

    while (true) {
      await activities.setAwaitingPlanApproval(input.runId, input.ticketId);
      await activities.logEvent(
        input.runId,
        "plan_approval",
        planRevisionRound === 0
          ? "Waiting for human approval of the fix plan before making any code changes"
          : "Updated plan ready — waiting for your approval"
      );

      const gotPlanDecision = await condition(
        () => planApproved || planRejected || planReviseRequested,
        "7 days"
      );
      if (!gotPlanDecision) {
        throw new Error("Plan approval timed out after 7 days");
      }

      if (planRejected) {
        await activities.markRejected(
          input.ticketId,
          input.runId,
          planRejectionNotes ?? "Plan rejected by reviewer"
        );
        return { success: false, error: planRejectionNotes ?? "Plan rejected" };
      }

      if (planApproved) {
        break;
      }

      if (planReviseRequested) {
        planRevisionRound += 1;
        if (planRevisionRound > AGENT_MAX_PLAN_REVISIONS) {
          throw new Error(`Plan revision limit reached (${AGENT_MAX_PLAN_REVISIONS} requests)`);
        }

        const revisionPrompt = planRevisionPrompt ?? "Please update the plan.";
        planReviseRequested = false;
        planRevisionPrompt = undefined;

        await activities.updateTicketStatus(input.ticketId, "planning", "plan_revise");
        await activities.logEvent(
          input.runId,
          "plan_revision",
          `Revising plan (round ${planRevisionRound}): ${revisionPrompt}`
        );

        plan = await activities.generateDetailedPlan({
          title: input.title,
          body: input.body,
          fileTree: analysis.fileTree,
          keyFiles: analysis.keyFiles,
          relevantFiles: analysis.relevantFiles,
          revisionNotes: revisionPrompt,
          previousPlan: JSON.stringify(plan, null, 2),
          conversationHistory: conversationContext || undefined,
          previousChangeSummary,
          previousDiffSummary,
        });
        await activities.saveArtifact(
          input.runId,
          `detailed-plan-r${planRevisionRound}`,
          JSON.stringify(plan, null, 2)
        );
        await activities.saveArtifact(input.runId, "detailed-plan", JSON.stringify(plan, null, 2));
        await activities.saveArtifact(input.runId, "plan", plan.formattedDiff);
        await activities.logEvent(input.runId, "plan", plan.plainLanguageSummary);
        continue;
      }
    }

    await activities.logEvent(
      input.runId,
      "plan_approved",
      planApprovalNotes ?? "Plan approved — starting implementation"
    );

    await activities.resumeAfterPlanApproval(input.runId, input.ticketId);

    await activities.updateTicketStatus(input.ticketId, "implementing", "branch");
    if (isRevision) {
      await activities.syncAgentBranch({
        ticketId: input.ticketId,
        branchName,
        repositories,
        githubToken: input.githubToken,
      });
    } else {
      branchName = await activities.createBranches(
        input.ticketId,
        branchName,
        repositories,
        input.githubToken
      );
    }
    await activities.logEvent(input.runId, "branch", `Checked out branch ${branchName}`);

    const planJson = JSON.stringify(plan);
    let reviewFeedback: string | undefined;
    let reviewRound = 0;

    while (reviewRound <= AGENT_MAX_REVIEW_ROUNDS) {
      await activities.updateTicketStatus(input.ticketId, "implementing", "implement");
      let attempt = 0;
      let testPassed = false;
      let testOutput = "";

      while (attempt < AGENT_MAX_RETRIES && !testPassed) {
        attempt += 1;
        const impl = await activities.implementCode({
          ticketId: input.ticketId,
          repositories,
          plan: planJson,
          title: input.title,
          body: input.body,
          attempt,
          reviewFeedback,
          conversationHistory: conversationContext || undefined,
          previousChangeSummary,
          previousDiffSummary,
        });
        await activities.saveArtifact(
          input.runId,
          `implementation-${attempt}`,
          JSON.stringify(impl, null, 2)
        );
        await activities.logEvent(input.runId, "implement", impl.summary);

        if (!impl.success) {
          if (attempt >= AGENT_MAX_RETRIES) {
            throw new Error(`Implementation failed after ${AGENT_MAX_RETRIES} attempts`);
          }
          continue;
        }

        await activities.updateTicketStatus(input.ticketId, "testing", "test");
        const testResult = await activities.runTests(input.ticketId, repositories);
        testOutput = testResult.output;
        await activities.saveArtifact(input.runId, `test-${attempt}`, JSON.stringify(testResult, null, 2));
        await activities.logEvent(
          input.runId,
          "test",
          testResult.passed ? "Tests passed" : "Tests failed",
          testResult
        );
        testPassed = testResult.passed;

        if (!testPassed && attempt >= AGENT_MAX_RETRIES) {
          throw new Error(`Tests failed after ${AGENT_MAX_RETRIES} attempts`);
        }
      }

      await activities.updateTicketStatus(input.ticketId, "reviewing", "review");
      const diffSummary = await activities.getDiffSummary(input.ticketId, repositories);
      const review = await activities.reviewCode({
        title: input.title,
        body: input.body,
        plan: planJson,
        diffSummary,
        testOutput,
      });
      await activities.saveArtifact(input.runId, `review-${reviewRound}`, JSON.stringify(review, null, 2));
      await activities.logEvent(input.runId, "review", review.feedback);

      if (review.approved && !review.changesRequested) {
        break;
      }

      reviewFeedback = review.feedback;
      reviewRound += 1;
      if (reviewRound > AGENT_MAX_REVIEW_ROUNDS) {
        throw new Error(`Code review failed after ${AGENT_MAX_REVIEW_ROUNDS} rounds`);
      }
    }

    const changeCheck = await activities.validateChanges(input.ticketId, repositories);
    if (!changeCheck.meaningful) {
      throw new Error(
        `No meaningful code changes detected (files: ${changeCheck.files.join(", ") || "none"}). ` +
          "Set OPENAI_API_KEY in .env for the agent to modify source files."
      );
    }

    const finalDiff = await activities.getDiffSummary(input.ticketId, repositories);
    const changeSummary = await activities.summarizeAppliedChanges({
      title: input.title,
      body: input.body,
      diffSummary: finalDiff,
    });
    await activities.saveArtifact(
      input.runId,
      "change-summary",
      JSON.stringify(changeSummary, null, 2)
    );
    await activities.logEvent(input.runId, "changes", changeSummary.plainLanguageSummary);

    await activities.setAwaitingHumanReview(input.runId, input.ticketId);
    await activities.logEvent(
      input.runId,
      "human_review",
      "Waiting for human approval in Review Queue before creating PR"
    );

    const gotDecision = await condition(() => approved || rejected, "7 days");
    if (!gotDecision) {
      throw new Error("Human review timed out after 7 days");
    }

    if (rejected) {
      await activities.markRejected(input.ticketId, input.runId, rejectionNotes);
      return { success: false, error: rejectionNotes ?? "Rejected by reviewer" };
    }

    await activities.updateTicketStatus(input.ticketId, "approved", "approved");
    await activities.logEvent(input.runId, "approved", approvalNotes ?? "Approved by human reviewer");

    await activities.updateTicketStatus(input.ticketId, "pushing", "push");
    const prs = await activities.commitPushAllRepos({
      ticketId: input.ticketId,
      runId: input.runId,
      branchName,
      repositories,
      title: input.title,
      body: `${input.body}\n\n${approvalNotes ?? ""}`,
      githubToken: input.githubToken,
    });

    const prSummary = prs.map((p) => `${p.repoFullName}: ${p.url}`).join("; ");
    await activities.markCompleted(input.ticketId, input.runId, prs[0]?.url);
    await activities.logEvent(
      input.runId,
      isRevision ? "pr_updated" : "done",
      isRevision ? `PR(s) updated: ${prSummary}` : `PR(s) created: ${prSummary}`
    );

    return { success: true, prUrl: prs[0]?.url, prNumber: prs[0]?.number };
  } catch (err) {
    const root = rootCause(err) as unknown;
    let message: string;
    if (root instanceof Error) {
      message = root.message;
    } else if (typeof root === "string") {
      message = root;
    } else if (err instanceof Error) {
      message = err.message;
    } else {
      message = String(err);
    }
    await activities.markFailed(input.ticketId, input.runId, message);
    await activities.logEvent(input.runId, "failed", message);
    return { success: false, error: message };
  }
}
