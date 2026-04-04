<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
	<title>Steel Path Incursion Schedule | browse.wf</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
	<link rel="icon" href="https://browse.wf/Lotus/Interface/Icons/Categories/GrimoireModIcon.png">
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" integrity="sha384-XGjxtQfXaH2tnPFa9x+ruJTuLE3Aa6LhHSWRr1XeTyhezb4abCG4ccI5AkVDxqC+" crossorigin="anonymous">
	<link rel="stylesheet" href="src/incursions.css">
</head>
<body data-bs-theme="dark">
	<?php require "components/navbar.php"; ?>
	<div class="p-3">
		<div id="incursions-controls" class="d-flex align-items-center gap-5 mb-3 bg-body-secondary rounded p-2">
			<button id="btn-today" class="btn btn-sm btn-primary">Today</button>
			<div class="btn-group btn-group-sm" role="group" aria-label="Navigate">
				<button id="btn-prev" class="btn btn-sm btn-secondary"><i class="bi bi-chevron-left"></i></button>
				<button id="btn-next" class="btn btn-sm btn-secondary"><i class="bi bi-chevron-right"></i></button>
			</div>
			<div class="d-flex gap-2">
				<select id="select-month" class="form-select form-select-sm w-auto">
					<option value="0">January</option>
					<option value="1">February</option>
					<option value="2">March</option>
					<option value="3">April</option>
					<option value="4">May</option>
					<option value="5">June</option>
					<option value="6">July</option>
					<option value="7">August</option>
					<option value="8">September</option>
					<option value="9">October</option>
					<option value="10">November</option>
					<option value="11">December</option>
				</select>
				<select id="select-year" class="form-select form-select-sm w-auto">
					<!-- Populated dynamically from data range -->
				</select>
			</div>
			<div class="btn-group btn-group-sm" role="group" aria-label="View mode">
				<button id="btn-view-list" type="button" class="btn btn-secondary" data-bs-toggle="tooltip" data-bs-placement="bottom" title="List view"><i class="bi bi-list-ul"></i></button>
				<button id="btn-view-table" type="button" class="btn btn-secondary" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Table view"><i class="bi bi-table"></i></button>
				<button id="btn-view-calendar" type="button" class="btn btn-secondary" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Calendar view"><i class="bi bi-calendar3"></i></button>
			</div>
		</div>
		<div id="schedule">
			<p>Loading, please wait...</p>
		</div>
	</div>
	<?php require "components/commonjs.html"; ?>
	<script type="module" src="typestripped/src/incursions.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
</body>
</html>
