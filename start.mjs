#!/usr/bin/env node
// Bootstrap script to run TypeScript server
// Simply import and run the server - use with: node --import tsx/esm start.mjs

try {
	await import("./server.ts");
} catch (error) {
	console.error("FATAL: server.ts failed to load:", error);
	process.exit(1);
}
