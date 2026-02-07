/**
 * @file Version utilities for semver comparison
 */

/**
 * Compare two semver version strings.
 * Returns true if `current` is newer than `previous`.
 */
export function isVersionNewer(current: string, previous: string): boolean {
	const parse = (v: string): number[] =>
		v.split('.').map(n => parseInt(n, 10) || 0);

	const cur = parse(current);
	const prev = parse(previous);
	const len = Math.max(cur.length, prev.length);

	for (let i = 0; i < len; i++) {
		const c = cur[i] ?? 0;
		const p = prev[i] ?? 0;
		if (c > p) return true;
		if (c < p) return false;
	}

	return false;
}
