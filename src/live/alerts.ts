/**
 Alerts card helpers (fork-specific)
 */

/**
 Joins an alert's reward names into one comma-delimited line.
 Credits always come last, regardless of how many other rewards there are.

 @param rewardNames - Display names of the non-credit rewards, in display order
 @param credits - The credit reward
 */
export function formatAlertRewards(rewardNames: string[], credits: number): string {
	return [...rewardNames, `${credits.toLocaleString()} Credits`].join(', ');
}

(window as any).formatAlertRewards = formatAlertRewards;
