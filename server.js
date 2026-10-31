const express = require("express");
const { Inngest } = require("inngest");
const { serve } = require("inngest/express");

const app = express();
app.use(express.json());
const inngest = new Inngest({ id: "report-api" });

const sayHello = inngest.createFunction(
  { id: "say-hello" },
  { event: "test/hello" },
  async ({ step }) => {
    await step.sleep("wait-5-seconds", "5s");
    return "Hello from the background!";
  }
);

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.use("/api/inngest", serve({ client: inngest, functions: [sayHello] }));
app.listen(3000, () => console.log("API listening on http://localhost:3000"));
