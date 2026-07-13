// Base URL for the app server under test, resolved per Playwright worker.
// Each worker runs against its own server on a distinct port so the suite can
// run in parallel without cross-worker interference. Playwright sets
// TEST_WORKER_INDEX in every worker process; it is 0 for a single-worker run.
const workerIndex = Number(process.env.TEST_WORKER_INDEX ?? 0);

export const PORT = 3000 + workerIndex;
export const BASE = `http://localhost:${PORT}`;
