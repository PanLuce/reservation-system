#!/usr/bin/env node
// Bootstrap script to run TypeScript server
// Simply import and run the server - use with: node --import tsx/esm start.mjs

console.log("BOOT: start.mjs running, Node", process.version);
console.log("BOOT: NODE_ENV =", process.env.NODE_ENV);
console.log("BOOT: PORT =", process.env.PORT);
console.log("BOOT: TURSO_DATABASE_URL set?", !!process.env.TURSO_DATABASE_URL);

try {
	console.log("BOOT: importing server.ts via tsx...");
	await import("./server.ts");
	console.log("BOOT: server.ts loaded successfully");
} catch (error) {
	console.error("FATAL: server.ts failed to load:", error);
	process.exit(1);
}
