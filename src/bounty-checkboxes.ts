/**
 * Daily completion checkboxes for Cavia and The Hex bounty headings.
 * Resets at midnight UTC, matching the Steel Path Incursions timer.
 */


let dailyResetTimer: ReturnType<typeof setTimeout> | null = null;

export function updateBountyCheckboxes(): void
{
	// lastDailyReset in seconds since epoch at start of UTC day — matches incursions_expiry calculation
	const lastDailyReset = Math.trunc(Date.now() / 86400000) * 86400;

	for (const headingId of ["EntratiLabSyndicate-name", "HexSyndicate-name"])
	{
		const heading = document.getElementById(headingId);
		if (!heading) continue;

		const spanId = headingId.replace("-name", "-check");
		let span = document.getElementById(spanId);
		if (span)
		{
			span.querySelectorAll("[data-bs-toggle=tooltip]").forEach(x => window.bootstrap?.Tooltip.getInstance(x)?.dispose());
			span.innerHTML = "";
		}
		else
		{
			heading.classList.add("d-flex", "align-items-center");
			span = document.createElement("span");
			span.id = spanId;
			span.className = "ms-2";
			heading.appendChild(span);
		}
		span.appendChild(createCompletionToggle(`${spanId}-${lastDailyReset}`));
	}

	// Schedule reset at next daily reset (UTC) — memoized so multiple calls don't stack timers
	if (!dailyResetTimer)
	{
		const nextDailyReset = (lastDailyReset + 86400) * 1000;
		dailyResetTimer = setTimeout(() =>
		{
			dailyResetTimer = null;
			updateBountyCheckboxes();
		}, nextDailyReset - Date.now());
	}
}

(window as any).updateBountyCheckboxes = updateBountyCheckboxes;
