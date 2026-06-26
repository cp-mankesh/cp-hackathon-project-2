import { Connection, Client } from "@temporalio/client";
import { TEMPORAL_TASK_QUEUE } from "@ados/shared";
import {
  approvePlanSignal,
  approveReviewSignal,
  rejectPlanSignal,
  rejectReviewSignal,
  revisePlanSignal,
} from "./signals";

let clientPromise: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const connection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
      });
      return new Client({
        connection,
        namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
      });
    })();
  }
  return clientPromise;
}

export async function startTicketWorkflow(input: {
  workflowId: string;
  runId: string;
  ticketId: string;
  projectId: string;
  repositories: Array<{
    repoFullName: string;
    defaultBranch: string;
    label?: string | null;
  }>;
  title: string;
  body: string;
  githubToken?: string;
  mode?: "initial" | "revision";
  revisionPrompt?: string;
}) {
  const client = await getClient();
  const handle = await client.workflow.start("ticketWorkflow", {
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowId: input.workflowId,
    args: [
      {
        runId: input.runId,
        ticketId: input.ticketId,
        projectId: input.projectId,
        repositories: input.repositories,
        title: input.title,
        body: input.body,
        githubToken: input.githubToken,
        mode: input.mode ?? "initial",
        revisionPrompt: input.revisionPrompt,
      },
    ],
  });
  return handle.workflowId;
}

export async function signalApproveReview(workflowId: string, payload: { reviewerId?: string; notes?: string }) {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);
  await handle.signal(approveReviewSignal, payload);
}

export async function signalRejectReview(workflowId: string, payload: { reviewerId?: string; notes?: string }) {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);
  await handle.signal(rejectReviewSignal, payload);
}

export async function signalApprovePlan(workflowId: string, payload: { reviewerId?: string; notes?: string }) {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);
  await handle.signal(approvePlanSignal, payload);
}

export async function signalRejectPlan(workflowId: string, payload: { reviewerId?: string; notes?: string }) {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);
  await handle.signal(rejectPlanSignal, payload);
}

export async function signalRevisePlan(
  workflowId: string,
  payload: { reviewerId?: string; prompt: string }
) {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);
  await handle.signal(revisePlanSignal, payload);
}

export async function terminateTicketWorkflow(workflowId: string) {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);
  await handle.terminate("Cancelled by user");
}
