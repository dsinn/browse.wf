/**
 * Descendia card functionality for browse.wf
 *
 * Handles rendering the Descendia (Devil's Lair) weekly rotation challenges.
 * Displays 21 challenges from the active Descent with mission types, arenas,
 * specs, and auras.
 */

// Declare global functions available from live.ts
declare function getDictPromise(): Promise<Record<string, string>>;

interface IMongoDate {
	$date: {
		$numberLong: string;
	};
}

interface IDescent {
	Activation: IMongoDate;
	Expiry: IMongoDate;
	RandSeed: number;
	Challenges: {
		Index: number;
		Type: string;
		Challenge: string;
		Level: string;
		Specs: string[];
		Auras: string[];
	}[];
}

/**
 * Updates the Descendia table with the currently active Descent rotation
 */
function updateDescendia(): void
{
	// worldState must be available before calling this
	if (!(window as any).worldState?.Descents || (window as any).worldState.Descents.length === 0)
	{
		console.error("worldState.Descents not available for updateDescendia");
		return;
	}

	const now = Date.now();
	// Find the active Descent (Activation <= now < Expiry)
	const activeDescent: IDescent = (window as any).worldState.Descents.find((d: IDescent) =>
		parseInt(d.Activation.$date.$numberLong) <= now && parseInt(d.Expiry.$date.$numberLong) > now
	);

	if (!activeDescent)
	{
		return;
	}

	const dict_promise = getDictPromise();

	dict_promise.then(dict =>
	{
		const tbody = document.createElement("tbody");

		for (const challenge of activeDescent.Challenges)
		{
			const tr = document.createElement("tr");

			// Column 1: Level (Index)
			{
				const td = document.createElement("td");
				td.className = "text-center";
				td.textContent = challenge.Index.toString();
				tr.appendChild(td);
			}

			// Column 2: Mission Type
			{
				const td = document.createElement("td");
				td.textContent = challenge.Type;
				tr.appendChild(td);
			}

			// Column 3: Challenge
			{
				const td = document.createElement("td");
				td.textContent = dict[challenge.Challenge] || challenge.Challenge;
				tr.appendChild(td);
			}

			// Column 4: Arena (Level field with .level trimming and fallback to rightmost /)
			{
				const td = document.createElement("td");
				let level = dict[challenge.Level] || challenge.Level.replace(/.*\//, "");
				td.textContent = level.replace(/\.level$/i, "");
				tr.appendChild(td);
			}

			// Column 5: Specs (array with fallback)
			{
				const td = document.createElement("td");
				if (challenge.Specs && challenge.Specs.length > 0)
				{
					const specs = challenge.Specs.map(spec =>
						dict[spec] || spec.replace(/.*\//, "")
					);
					td.textContent = specs.join(", ");
				}
				else
				{
					td.textContent = "-";
				}
				tr.appendChild(td);
			}

			// Column 6: Auras (array with fallback)
			{
				const td = document.createElement("td");
				if (challenge.Auras && challenge.Auras.length > 0)
				{
					const auras = challenge.Auras.map(aura =>
						dict[aura] || aura.replace(/.*\//, "")
					);
					td.textContent = auras.join(", ");
				}
				else
				{
					td.textContent = "-";
				}
				tr.appendChild(td);
			}

			tbody.appendChild(tr);
		}

		const table = document.getElementById("descendia-table");
		const existingTbody = table.querySelector("tbody");
		if (existingTbody)
		{
			table.removeChild(existingTbody);
		}
		table.appendChild(tbody);
	});
}

// Expose function globally for use by non-module scripts
(window as any).updateDescendia = updateDescendia;
