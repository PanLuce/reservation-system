export async function withEnv(
	overrides: Record<string, string | undefined>,
	run: () => Promise<void>,
) {
	const saved = new Map(
		Object.keys(overrides).map((key) => [key, process.env[key]]),
	);
	for (const [key, value] of Object.entries(overrides)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	try {
		await run();
	} finally {
		for (const [key, value] of saved) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}
