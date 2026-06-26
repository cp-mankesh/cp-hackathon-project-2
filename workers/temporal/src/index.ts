import path from "node:path";
import { config } from "dotenv";
import { NativeConnection, Worker } from "@temporalio/worker";
import { TEMPORAL_TASK_QUEUE } from "@ados/shared";
import { activities as activityImplementations } from "./activities";

config({ path: path.resolve(__dirname, "../../../.env") });
config({ path: path.resolve(__dirname, "../../../.env.local") });

async function run() {
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowsPath: require.resolve("./workflows"),
    activities: activityImplementations,
  });

  console.log(`Temporal worker started on queue: ${TEMPORAL_TASK_QUEUE}`);
  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
