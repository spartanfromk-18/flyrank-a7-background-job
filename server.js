const express = require("express");
const { Inngest } = require("inngest");
const { serve } = require("inngest/express");
const crypto = require("crypto");

const app = express();
app.use(express.json());
const reports = new Map();
const inngest = new Inngest({ id: "report-api" });

const sayHello = inngest.createFunction(
  { id: "say-hello" },
  { event: "test/hello" },
  async ({ step }) => {
    await step.sleep("wait-5-seconds", "5s");
    return "Hello from the background!";
  }
);

const makeReport = inngest.createFunction(
  {
    id: "make-report",
    retries: 2,
    concurrency: { limit: 2 },
    onFailure: async ({ event, error }) => {
      const { id, topic } = event.data.event.data;
      const existing = reports.get(id);
      if (existing) reports.set(id, { ...existing, status: "failed", error: error.message });
      console.error(`[ALERT] Job ${id} failed: ${error.message}`);
    },
  },
  { event: "report/requested" },
  async ({ event, step }) => {
    const { id, topic } = event.data;
    const existing = reports.get(id);
    if (existing && existing.status === "done") return { id, status: "done", result: existing.result, idempotentSkip: true };

    await step.sleep("do-the-slow-work", "8s");
    const result = await step.run("build-report", async () => {
      if (topic === "fail") throw new Error("The report oven is broken!");
      return `AI Executive Report on "${topic}": Generated via background worker.`;
    });
    reports.set(id, { id, topic, status: "done", result, completedAt: new Date().toISOString() });
    return { id, status: "done", result };
  }
);

const heartbeat = inngest.createFunction(
  { id: "heartbeat" },
  { cron: "* * * * *" },
  async ({ step }) => {
    return await step.run("summarize-reports", async () => {
      const all = Array.from(reports.values());
      const summary = `[Heartbeat] pending: ${all.filter(r => r.status === "pending").length}, done: ${all.filter(r => r.status === "done").length}`;
      console.log(summary);
      return { summary };
    });
  }
);

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.post("/reports", async (req, res) => {
  const { topic } = req.body || {};
  if (!topic || typeof topic !== "string" || !topic.trim()) return res.status(400).json({ error: "Missing topic" });
  const id = "rep_" + crypto.randomBytes(4).toString("hex");
  reports.set(id, { id, topic: topic.trim(), status: "pending" });
  await inngest.send({ name: "report/requested", data: { id, topic: topic.trim() } });
  return res.status(202).json({ id, status: "pending" });
});
app.get("/reports/:id", (req, res) => {
  const report = reports.get(req.params.id);
  if (!report) return res.status(404).json({ error: "Not found" });
  return res.status(200).json(report);
});

app.use("/api/inngest", serve({ client: inngest, functions: [sayHello, makeReport, heartbeat] }));
app.listen(3000, () => console.log("API listening on port 3000"));
