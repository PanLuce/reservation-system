#!/usr/bin/env node
// Bootstrap script to run TypeScript server
// Simply import and run the server - use with: node --import tsx/esm start.mjs

try {
	await import("./server.ts");
} catch (error) {
	process.stderr.write(`FATAL: server.ts failed to load: ${error}\n`);
	if (error instanceof Error && error.stack) {
		process.stderr.write(`${error.stack}\n`);
	}
	process.exit(1);
}
