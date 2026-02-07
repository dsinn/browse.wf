<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
	<title>Invigorations | browse.wf</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
	<link rel="icon" href="https://browse.wf/Lotus/Interface/Icons/Categories/GrimoireModIcon.png">
</head>
<body data-bs-theme="dark">
	<?php require "components/navbar.php"; ?>
	<div class="container pt-3">
		<form onsubmit="doSubmit();return false;">
			<input id="username" class="form-control mb-3" placeholder="Username (case-sensitive)" minlength="4" required />
			<div class="form-check mb-3">
				<input class="form-check-input" type="checkbox" id="peek">
				<label class="form-check-label" for="peek">I've already visited Helminth this week</label>
			</div>
			<h5 id="input-header">Previous Offerings</h5>
			<div class="row g-2 mb-2">
				<div class="col-4">
					<select class="form-control suit-select"></select>
				</div>
				<div class="col-4">
					<select class="form-control suit-select"></select>
				</div>
				<div class="col-4">
					<select class="form-control suit-select"></select>
				</div>
			</div>
			<p id="inventory-upsell">You can <a href="inventory#for=invigorations">sync your inventory with browse.wf</a> to fill in the offerings automatically.</p>
			<p id="inventory-status" class="d-none">Offerings were automatically filled in from your inventory. <a href="inventory#for=invigorations">Need to update your inventory?</a></p>
			<input type="submit" class="btn btn-primary mb-3" value="Calculate Offerings" />
			<div id="cache-alert" class="alert d-none mb-3" role="alert"></div>
			<div id="results" class="d-none">
				<h4 class="mb-0">Current Offerings</h4>
				<p id="explain-noprev" class="explainer text-secondary-emphasis">Due to incomplete input data, these results can only be considered 100% correct if you have never visited Helminth before and your username is <b></b>.</p>
				<p id="explain-current" class="explainer text-secondary-emphasis">Assuming the previous offerings are correct for your account and your username is <b></b> as of this week.</p>
				<p id="explain-peek" class="explainer text-secondary-emphasis">Assuming the current offerings are correct for your account and your username is or will be <b></b>.</p>
				<div class="row text-center">
					<div class="col-4">
						<h5 id="out-suit-0"></h5>
						<p id="out-off-0" class="m-0"></p>
						<p id="out-def-0"></p>
					</div>
					<div class="col-4">
						<h5 id="out-suit-1"></h5>
						<p id="out-off-1" class="m-0"></p>
						<p id="out-def-1"></p>
					</div>
					<div class="col-4">
						<h5 id="out-suit-2"></h5>
						<p id="out-off-2" class="m-0"></p>
						<p id="out-def-2"></p>
					</div>
				</div>
			</div>
		</form>
	</div>
	<?php require "components/commonjs.html"; ?>
	<script>
		Promise.all([
			getDictPromise(),
			fetch("warframe-public-export-plus/ExportWarframes.json").then(res => res.json())
		]).then(([_dict, ExportWarframes]) =>
		{
			window.dict = _dict;

			onLanguageUpdate = function()
			{
				window.baseSuitTypes = {};
				const warframes = Object.values(ExportWarframes);
				warframes.sort((a, b) => dict[a.name].localeCompare(dict[b.name]));
				warframes.forEach(suit =>
				{
					if (suit.productCategory == "Suits" && suit.name.indexOf("Prime") == -1 && suit.name.indexOf("Umbra") == -1)
					{
						baseSuitTypes[suit.parentName] = {
							name: suit.name,
							codename: suit.parentName.split("/")[3]
						};
					}
				});

				document.querySelectorAll(".suit-select").forEach(select =>
				{
					const value = select.value || "---";
					select.innerHTML = "<option>---</option>";
					for (const [uniqueName, data] of Object.entries(baseSuitTypes))
					{
						const option = document.createElement("option");
						option.value = uniqueName;
						option.textContent = dict[data.name];
						if (data.codename != option.textContent)
						{
							option.textContent += " (\"" + data.codename + "\")";
						}
						select.appendChild(option);
					}
					select.value = value;
				});
			};
			onLanguageUpdate();

			let inventoryDataUsed = false;
			if (localStorage.getItem("inventory"))
			{
				document.getElementById("inventory-upsell").classList.add("d-none");
				document.getElementById("inventory-status").classList.remove("d-none");

				const inventory = JSON.parse(localStorage.getItem("inventory"));
				if (inventory.InfestedFoundry)
				{
					if (inventory.InfestedFoundry.InvigorationIndex)
					{
						document.getElementById("peek").checked = (inventory.InfestedFoundry.InvigorationIndex == Math.trunc(((Date.now() / 1000) - 1391990400) / 604800));
						document.getElementById("peek").onchange();
						inventoryDataUsed = true;
					}
					if (inventory.InfestedFoundry.InvigorationSuitOfferings)
					{
						const selects = document.querySelectorAll(".suit-select");
						for (let i = 0; i != 3; ++i)
						{
							selects[i].value = inventory.InfestedFoundry.InvigorationSuitOfferings[i];
						}
						inventoryDataUsed = true;
					}
				}
			}

			// Load from cache on page load (only if inventory data wasn't used)
			const cacheStr = localStorage.getItem("invigorations.cache");
			if (cacheStr && !inventoryDataUsed)
			{
				try
				{
					const cache = JSON.parse(cacheStr);
					const currentWeek = getWeekIndex(Date.now());
					const cachedWeek = getWeekIndex(cache.timestamp);
					const weekDiff = currentWeek - cachedWeek;

					if (weekDiff === 0)
					{
						// Scenario 1: Same week - fresh cache
						// Pre-fill form
						document.getElementById("username").value = cache.request.n;
						document.getElementById("peek").checked = cache.request.p;
						document.getElementById("peek").onchange();
						const selects = document.querySelectorAll(".suit-select");
						cache.request.s.forEach((suit, i) => selects[i].value = suit);

						// Display results
						showResults(cache.response, cache.request);

						// Show success alert
						showCacheAlert("success", `Loaded fresh data from this week's cache (${formatTimestamp(cache.timestamp)})`);
					}
					else if (weekDiff === 1)
					{
						// Scenario 2: One week later - pre-fill form
						document.getElementById("username").value = cache.request.n;
						document.getElementById("peek").checked = cache.request.p;
						document.getElementById("peek").onchange();
						const selects = document.querySelectorAll(".suit-select");
						cache.response.suits.forEach((suit, i) => selects[i].value = suit);

						// Show info alert with historical data if peek was enabled
						if (cache.request.p)
						{
							// Peek was enabled - request suits were last week's actual offerings
							const suitNames = cache.request.s.map(suit => dict[baseSuitTypes[suit].name]).join(", ");
							const alertHtml = `<div>Pre-filled form with stale data from last week's cache (${formatTimestamp(cache.timestamp)})</div>` +
								`<div class="mt-1">Last week's offerings: ${suitNames}</div>`;
							showCacheAlert("info", null, alertHtml);
						}
						else
						{
							showCacheAlert("info", `Pre-filled form with stale data from last week's cache (${formatTimestamp(cache.timestamp)})`);
						}
					}
					else if (weekDiff >= 2)
					{
						// Scenario 3: Too stale - only username
						document.getElementById("username").value = cache.request.n;

						// Show warning alert
						showCacheAlert("warning", `Cached data too stale to pre-fill form (${formatTimestamp(cache.timestamp)})`);
					}
				}
				catch (e)
				{
					// Invalid cache, ignore it
					console.error("Failed to load invigoration cache:", e);
				}
			}
		});

		document.getElementById("peek").onchange = function()
		{
			document.getElementById("input-header").textContent = this.checked ? "Current Offerings" : "Previous Offerings";
		};

		const invigorationNames = {
			"/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerStrength": "+200% Ability Strength",
			"/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerRange": "+100% Ability Range",
			"/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerDuration": "+100% Ability Duration",
			"/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationMeleeDamage": "+250% Melee Damage",
			"/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPrimaryDamage": "+250% Primary Damage",
			"/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationSecondaryDamage": "+250% Secondary Damage",
			"/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPrimaryCritChance": "+200% Primary Critical Chance",
			"/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationSecondaryCritChance": "+200% Secondary Critical Chance",
			"/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationMeleeCritChance": "+200% Melee Critical Chance",
			"/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationPowerEfficiency": "+75% Ability Efficiency",
			"/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationMovementSpeed": "+75% Sprint Speed",
			"/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationParkourSpeed": "+75% Parkour Velocity",
			"/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationHealth": "+1000 Health",
			"/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationEnergy": "+200% Energy Max",
			"/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationStatusResistance": "Status Immunity",
			"/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationReloadSpeed": "+75% Reload Speed",
			"/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationHealthRegen": "+25 Health Regen/s",
			"/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationArmor": "+1000 Armor",
			"/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationJumps": "5 Jump Resets",
			"/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationEnergyRegen": "+2 Energy Regen",
		};

		// Helper function to get week index from timestamp
		function getWeekIndex(timestamp)
		{
			return Math.trunc(((timestamp / 1000) - 1391990400) / 604800);
		}

		// Helper function to format timestamp
		function formatTimestamp(timestamp)
		{
			const date = new Date(timestamp);
			const options = {
				weekday: 'long',
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			};
			return date.toLocaleString(undefined, options);
		}

		// Helper function to show cache alert
		function showCacheAlert(type, message, htmlContent = null)
		{
			const alert = document.getElementById("cache-alert");
			alert.className = `alert alert-${type} mb-3`;
			if (htmlContent)
			{
				alert.innerHTML = htmlContent;
			}
			else
			{
				alert.textContent = message;
			}
			alert.classList.remove("d-none");
		}

		// Helper function to display results
		function showResults(response, request)
		{
			document.getElementById("results").classList.remove("d-none");
			document.querySelector("#results h4").textContent = request.p ? "Next Week's Offerings" : "Current Offerings";
			document.querySelectorAll(".explainer").forEach(x => { x.classList.add("d-none") });
			if (request.s.length != response.suits.length)
			{
				document.querySelector("#explain-noprev").classList.remove("d-none");
			}
			else if (!request.p)
			{
				document.querySelector("#explain-current").classList.remove("d-none");
			}
			else
			{
				document.querySelector("#explain-peek").classList.remove("d-none");
			}
			document.querySelectorAll("#results b").forEach(x => { x.textContent = request.n });
			for (let i = 0; i != response.suits.length; ++i)
			{
				const suitData = baseSuitTypes[response.suits[i]];
				// Fall back to untranslated response in case of new content
				const suitName = suitData ? dict[suitData.name] : response.suits[i];
				document.getElementById("out-suit-" + i).textContent = suitName;
				document.getElementById("out-off-" + i).textContent = invigorationNames[response.offensiveUpgrades[i]] || response.offensiveUpgrades[i];
				document.getElementById("out-def-" + i).textContent = invigorationNames[response.defensiveUpgrades[i]] || response.defensiveUpgrades[i];
			}
		}

		function doSubmit()
		{
			// Hide alert on manual submission
			document.getElementById("cache-alert").classList.add("d-none");

			const request = {
				n: document.getElementById("username").value.split("#")[0],
				s: [],
				p: document.getElementById("peek").checked
			};
			document.querySelectorAll(".suit-select").forEach(select =>
			{
				if (select.value != "---")
				{
					request.s.push(select.value);
				}
			});
			fetch("https://oracle.browse.wf/invigorations?" + encodeURIComponent(JSON.stringify(request))).then(res => res.json()).then(res =>
			{
				// Display results
				showResults(res, request);

				// Save to cache
				const cache = {
					request: request,
					response: res,
					timestamp: Date.now()
				};
				localStorage.setItem("invigorations.cache", JSON.stringify(cache));
				if (window.triggerCloudSync)
				{
					window.triggerCloudSync();
				}
			});
		};
	</script>
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
</body>
</html>
