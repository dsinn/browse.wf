export function getDaysInMonth(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function localDateToUtcDayTimestamp(date: Date): number {
	return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 1000;
}
