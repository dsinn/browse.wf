<?php require_once "helpers.php"; ?>
<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
	<title>Weekly Forecast | browse.wf</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
	<link rel="icon" href="https://browse.wf/Lotus/Interface/Icons/Categories/GrimoireModIcon.png">
	<?php asyncStylesheet("src/tooltip.css"); ?>
	<?php asyncStylesheet("src/descendia/descendia.css"); ?>
	<?php asyncStylesheet("src/calendar-seasons/calendar-seasons.css"); ?>
</head>
<body data-bs-theme="dark">
	<?php require "components/navbar.php"; ?>
	<div class="container pt-3">
		<h2 class="mb-4">Weekly Forecast</h2>

		<div class="card mb-4">
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

		<div class="card mb-4">
			<div class="card-header"><h5 class="mb-0">Deep Archimedea</h5></div>
			<div class="card-body">
				<ul class="nav nav-tabs mb-3" id="deep-archimedea-tabs" role="tablist"></ul>
				<div class="tab-content" id="deep-archimedea-content">Loading...</div>
			</div>
		</div>

		<div class="card mb-4">
			<div class="card-header"><h5 class="mb-0">Temporal Archimedea</h5></div>
			<div class="card-body">
				<ul class="nav nav-tabs mb-3" id="temporal-archimedea-tabs" role="tablist"></ul>
				<div class="tab-content" id="temporal-archimedea-content">Loading...</div>
			</div>
		</div>

		<div class="card mb-4">
			<div class="card-header"><h5 class="mb-0">1999 Calendar</h5></div>
			<div class="card-body">
				<div class="d-none d-xl-block" id="calendar-season-columns">Loading...</div>
				<div class="d-xl-none">
					<ul class="nav nav-tabs mb-3" id="calendar-season-tabs" role="tablist"></ul>
					<div class="tab-content" id="calendar-season-content"></div>
				</div>
			</div>
		</div>

		<div class="card mb-4">
			<div class="card-header"><h5 class="mb-0">Clan Weekly Initiatives</h5></div>
			<div class="card-body">
				<div id="clan-weekly-columns">Loading...</div>
			</div>
		</div>
	</div>
	<?php require "components/commonjs.html"; ?>
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
	<script type="module" src="typestripped/src/weekly-forecast.js"></script>
</body>
</html>
