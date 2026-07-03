export function isQuickLoginEnabled(
	value: string | undefined = process.env.ENABLE_QUICK_LOGIN,
): boolean {
	return value === "true";
}
