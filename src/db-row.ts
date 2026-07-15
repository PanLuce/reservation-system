import type { Value } from "@libsql/client";

export type { Row } from "@libsql/client";

export function str(v: Value | undefined): string {
	return String(v ?? "");
}

export function optStr(v: Value | undefined): string | undefined {
	return v == null ? undefined : String(v);
}

export function num(v: Value | undefined): number {
	return Number(v ?? 0);
}
