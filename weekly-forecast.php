<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
	<title>Weekly Forecast | browse.wf</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
	<link rel="icon" href="https://browse.wf/Lotus/Interface/Icons/Categories/GrimoireModIcon.png">
	<link rel="stylesheet" href="src/tooltip.css">
	<link rel="stylesheet" href="src/descendia/descendia.css">
	<link rel="stylesheet" href="src/calendar-seasons/calendar-seasons.css">
	<link rel="stylesheet" href="src/teshin/teshin.css">
	<link rel="stylesheet" href="src/weekly-forecast-toc.css">
	<link rel="stylesheet" href="src/weekly-forecast.css">
</head>
<body data-bs-theme="dark">
	<?php require "components/navbar.php"; ?>
	<div class="container pt-3 d-flex flex-column">
		<h2 class="mb-4">Weekly Forecast</h2>

		<div class="card mb-4 weekly-forecast-section" id="descendia">
			<div class="card-header"><h5 class="mb-0">Descendia</h5></div>
			<div class="card-body">
				<?php require "components/untranslated-notice.php"; ?>
				<ul class="nav nav-tabs mb-3" id="descendia-tabs" role="tablist"></ul>
				<div class="tab-content" id="descendia-content">Loading...</div>
			</div>
		</div>

		<div class="alert alert-info mb-4" role="alert">
			The forecast for the weeklies below will update in <span id="weekly-missions-timer"></span>
		</div>

		<div class="card mb-4 weekly-forecast-section" id="deep-archimedea">
			<div class="card-header"><h5 class="mb-0">Deep Archimedea</h5></div>
			<div class="card-body">
				<ul class="nav nav-tabs mb-3" id="deep-archimedea-tabs" role="tablist"></ul>
				<div class="tab-content" id="deep-archimedea-content">Loading...</div>
			</div>
		</div>

		<div class="card mb-4 weekly-forecast-section" id="temporal-archimedea">
			<div class="card-header"><h5 class="mb-0">Temporal Archimedea</h5></div>
			<div class="card-body">
				<ul class="nav nav-tabs mb-3" id="temporal-archimedea-tabs" role="tablist"></ul>
				<div class="tab-content" id="temporal-archimedea-content">Loading...</div>
			</div>
		</div>

		<div class="card mb-4 weekly-forecast-section" id="calendar-1999">
			<div class="card-header"><h5 class="mb-0">1999 Calendar</h5></div>
			<div class="card-body">
				<div class="d-none d-xl-block" id="calendar-season-columns">Loading...</div>
				<div class="d-xl-none">
					<ul class="nav nav-tabs mb-3" id="calendar-season-tabs" role="tablist"></ul>
					<div class="tab-content" id="calendar-season-content"></div>
				</div>
			</div>
		</div>

		<div class="card mb-4 weekly-forecast-section" id="clan-weekly">
			<div class="card-header"><h5 class="mb-0">Clan Weekly Initiatives</h5></div>
			<div class="card-body">
				<div id="clan-weekly-columns">Loading...</div>
			</div>
		</div>

		<div class="card mb-4 weekly-forecast-section" id="circuit">
			<div class="card-header"><h5 class="mb-0">The Circuit</h5></div>
			<div class="card-body">
				<table class="table table-sm table-borderless table-hover mb-0">
					<thead><tr><th>Date</th><th>Normal Rewards</th><th>Steel Path Rewards</th></tr></thead>
					<tbody id="circuit-forecast-body">
						<tr><td colspan="3">Loading...</td></tr>
					</tbody>
				</table>
			</div>
		</div>

		<div class="card mb-4 weekly-forecast-section" id="steel-path-honors">
			<div class="card-header"><h5 class="mb-0">Steel Path Honors</h5></div>
			<div class="card-body">
				<table class="table table-sm table-borderless table-hover w-auto text-nowrap mb-0">
					<thead><tr id="teshin-forecast-header"><th>Offer</th></tr></thead>
					<tbody id="teshin-forecast-body">
						<tr><td>Loading...</td></tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Last in the document to avoid a FOUC -->
		<nav class="weekly-forecast-toc order-first order-lg-0" id="weekly-forecast-toc" aria-label="Sections">
			<div class="nav flex-nowrap flex-lg-column text-nowrap overflow-x-auto">
				<a class="nav-link" href="#descendia">Descendia</a>
				<a class="nav-link" href="#deep-archimedea">Deep Archimedea</a>
				<a class="nav-link" href="#temporal-archimedea">Temporal Archimedea</a>
				<a class="nav-link" href="#calendar-1999">1999 Calendar</a>
				<a class="nav-link" href="#clan-weekly">Clan Weekly Initiatives</a>
				<a class="nav-link" href="#circuit">The Circuit</a>
				<a class="nav-link" href="#steel-path-honors">Steel Path Honors</a>
			</div>
		</nav>
	</div>
	<?php require "components/commonjs.html"; ?>
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
	<script type="module" src="typestripped/src/weekly-forecast.js"></script>
</body>
</html>
