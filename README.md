# FlyRank Backend Track W4-A7: Background Jobs & Durable Workflows

A production-grade, fast-accepting API (`202 Accepted`) that offloads slow 8-second AI report generation to an **Inngest** background worker. It features robust status polling (`GET /reports/:id`), automatic backoff retries (`retries: 2`) with failure alerts, concurrency limits, idempotency guards, and a scheduled cron summary (`* * * * *`).

---

## 1. Architecture & Features

* **Fast-Accept Door (`POST /reports`):** Validates input (`400 Bad Request` on missing/invalid topics), writes a `pending` state to memory, emits an Inngest event, and returns `202 Accepted` in `<50ms`.
* **Asynchronous Background Worker (`make-report`):** Processes the 8-second synthesis step out-of-band using durable execution steps.
* **Resilience & Safety:** Configured with `retries: 2`, a concurrency cap (`limit: 2`), idempotency checks (`existing.status === "done"`), and an `onFailure` handler to catch permanent failures and alert operators.
* **Cron Heartbeat (`heartbeat`):** Runs every minute (`* * * * *`) to log live operational counts of pending, completed, and failed tasks.

---

## 2. How to Run

Install dependencies once, then open **two separate terminal tabs**:

```bash
# Terminal 1: Start the Express API server on port 3000
npm install
npm start

# Terminal 2: Start the Inngest Dev Server (Access Dashboard at http://localhost:8288)
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
