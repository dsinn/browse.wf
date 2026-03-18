/**
 * Returns `count` followed by the correctly pluralized form of `word`.
 * By default appends "s" for the plural; pass a custom plural as the third argument.
 *
 * Examples:
 *   pluralize(1, "day")       → "1 day"
 *   pluralize(2, "day")       → "2 days"
 *   pluralize(1, "minute")    → "1 minute"
 *   pluralize(0, "hour")      → "0 hours"
 */
export function pluralize(count: number, singular: string, plural: string = singular + 's'): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

(globalThis as any).pluralize = pluralize;
