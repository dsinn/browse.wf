<?php require_once "helpers.php"; ?>
<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
	<title>Cetus/Deimos Cycle Schedule | browse.wf</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
	<link rel="icon" href="https://browse.wf/Lotus/Interface/Icons/Categories/GrimoireModIcon.png">
	<?php asyncStylesheet("src/bounty-cycle-schedule.css"); ?>
</head>
<body data-bs-theme="dark">
	<div class="celestial-layer" aria-hidden="true">
		<span class="celestial-icon" id="celestial-sun">☀️</span>
		<span class="celestial-icon" id="celestial-moon">🌙</span>
	</div>
	<?php require "components/navbar.php"; ?>
	<div class="container pt-3">
		<h2 class="mb-4">Cetus/Deimos Cycle Schedule</h2>

		<div id="bounty-cycle-controls" class="d-flex flex-wrap align-items-center gap-3 mb-3 bg-body-secondary rounded p-2">
			<div class="d-flex align-items-center gap-2" id="phase-toggle-group">
				<span id="phase-label-day">Day/Fass</span>
				<div class="form-check form-switch mb-0">
					<input class="form-check-input" type="checkbox" role="switch" id="phase-toggle" checked>
				</div>
				<span id="phase-label-night">Night/Vome</span>
			</div>
			<div class="d-flex align-items-center gap-2">
				<label for="select-tz" class="form-label mb-0">Times in</label>
				<select id="select-tz" class="form-select form-select-sm w-auto">
					<option id="local-time-option" value="local">local time</option>
					<option value="zulu">universal time (UTC+0)</option>
				</select>
			</div>
			<div class="d-flex align-items-center gap-2">
				<label for="select-hourfmt" class="form-label mb-0">using</label>
				<select id="select-hourfmt" class="form-select form-select-sm w-auto">
					<option value="mil">military time</option>
					<option value="24" selected>24-hour time</option>
					<option value="12">12-hour time</option>
				</select>
			</div>
		</div>

		<?php
		// Keep in sync with MAX_WINDOWS_PER_DAY in src/bounty-cycle-schedule.ts (verified there
		// by a 10-year brute-force test) and DAY_COUNT in src/bounty-cycle-schedule-page.ts.
		// Cells are addressed by position (th/td index within their row) rather than data
		// attributes, so header/row/column order here must match what render() expects.
		$dayCount = 7;
		$maxWindowsPerDay = 10;
		?>
		<div class="table-responsive">
			<table class="table table-bordered table-sm" id="schedule-table">
				<thead>
					<tr id="schedule-table-headings">
						<?php foreach (range(1, $dayCount) as $_day): ?>
							<th></th>
						<?php endforeach; ?>
					</tr>
				</thead>
				<tbody id="schedule-table-body">
					<?php foreach (range(1, $maxWindowsPerDay) as $_slot): ?>
						<tr>
							<?php foreach (range(1, $dayCount) as $_day): ?>
								<td></td>
							<?php endforeach; ?>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
		</div>
	</div>
	<?php require "components/commonjs.html"; ?>
	<script type="module" src="typestripped/src/bounty-cycle-schedule-page.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
</body>
</html>
