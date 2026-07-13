// Base URL for the app server under test, resolved per Playwright worker.
// Each parallel slot runs against its own server on a distinct port so the
// suite can run in parallel without cross-worker interference. TEST_PARALLEL_INDEX
// is the bounded slot id (0..workers-1), stable and reused across worker respawns —
// unlike TEST_WORKER_INDEX, which increments unboundedly. It is 0 for a single worker.
const parallelIndex = Number(process.env.TEST_PARALLEL_INDEX ?? 0);

export const PORT = 3000 + parallelIndex;
export const BASE = `http://localhost:${PORT}`;
