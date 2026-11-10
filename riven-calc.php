<?php require_once "helpers.php"; ?>
<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
	<title>Riven Calculator | browse.wf</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" integrity="sha384-XGjxtQfXaH2tnPFa9x+ruJTuLE3Aa6LhHSWRr1XeTyhezb4abCG4ccI5AkVDxqC+" crossorigin="anonymous">
	<link rel="icon" href="https://browse.wf/Lotus/Interface/Icons/Categories/GrimoireModIcon.png">
	<?php asyncStylesheet("src/riven-calc/riven-calc.css"); ?>
</head>
<body data-bs-theme="dark">
	<?php require "components/navbar.php"; ?>
	<div class="container p-3">
		<h2 class="mb-3">Riven Calculator</h2>
		<p>Every trait (positive and negative) on your Riven has a random multiplier between 0.9x and 1.1x (or -10% to +10%). This tool shows the range each trait can roll, and grades the values on a Riven you own.</p>
		<p class="text-body-secondary">Riven Dispositions were retired in Hotfix 44.1.3: every weapon now uses the same 1.2x multiplier, so only the kind of weapon matters.</p>
		<div class="row g-3 mb-4">
			<div class="col-md-6">
				<div class="card h-100">
					<h5 class="card-header">Weapon</h5>
					<div class="card-body">
						<label for="weapon-name" class="form-label">Weapon</label>
						<input class="form-control" placeholder="Enter name..." id="weapon-name" list="weapons-datalist" autocomplete="off" />
						<div class="mt-3">
							<label for="riven-class" class="form-label">or Riven type</label>
							<select class="form-select" id="riven-class"></select>
						</div>
					</div>
				</div>
			</div>
			<div class="col-md-6">
				<div class="card h-100">
					<h5 class="card-header">Stats</h5>
					<div class="card-body">
						<div class="row">
							<div class="col-12 col-sm-4 mb-2 mb-sm-0">
								<label for="rank" class="form-label">Rank</label>
								<div class="input-group riven-stepper">
									<button type="button" class="btn btn-outline-secondary" data-riven-step="-1" aria-label="Decrease Rank">&minus;</button>
									<input id="rank" type="number" class="form-control text-center" min="0" max="8" value="8" />
									<button type="button" class="btn btn-outline-secondary" data-riven-step="1" aria-label="Increase Rank">+</button>
								</div>
							</div>
							<div class="col-12 col-sm-4 mb-2 mb-sm-0">
								<label for="positive-traits" class="form-label">Buffs<span aria-hidden="true">*</span></label>
								<div class="input-group riven-stepper">
									<button type="button" class="btn btn-outline-secondary" data-riven-step="-1" aria-label="Decrease Buffs">&minus;</button>
									<input id="positive-traits" type="number" class="form-control text-center" min="2" max="3" value="3" aria-describedby="positive-traits-note" />
									<button type="button" class="btn btn-outline-secondary" data-riven-step="1" aria-label="Increase Buffs">+</button>
								</div>
							</div>
							<div class="col-12 col-sm-4 mb-2 mb-sm-0">
								<label for="negative-traits" class="form-label">Curses</label>
								<div class="input-group riven-stepper">
									<button type="button" class="btn btn-outline-secondary" data-riven-step="-1" aria-label="Decrease Curses">&minus;</button>
									<input id="negative-traits" type="number" class="form-control text-center" min="0" max="1" value="1" />
									<button type="button" class="btn btn-outline-secondary" data-riven-step="1" aria-label="Increase Curses">+</button>
								</div>
							</div>
						</div>
						<p id="positive-traits-note" class="form-text mt-3 mb-0"><span aria-hidden="true">*</span> A spliced trait counts as one of the buffs.</p>
					</div>
				</div>
			</div>
		</div>
		<div class="row g-3">
			<div class="col-lg-6">
				<div class="card h-100" data-riven-card="buffs">
					<div class="card-header d-flex align-items-center justify-content-between gap-2">
						<h5 class="mb-0">Base buffs</h5>
						<button type="button" class="btn btn-sm btn-outline-secondary riven-reset-all" data-riven-reset-all disabled aria-label="Reset all" title="Reset all"><i class="bi bi-arrow-counterclockwise me-1"></i>All</button>
					</div>
					<div class="card-body" data-riven-section="buffs">Loading...</div>
				</div>
			</div>
			<div class="col-lg-6">
				<div class="card h-100" data-riven-card="curses">
					<div class="card-header d-flex align-items-center justify-content-between gap-2">
						<h5 class="mb-0">Curses</h5>
						<button type="button" class="btn btn-sm btn-outline-secondary riven-reset-all" data-riven-reset-all disabled aria-label="Reset all" title="Reset all"><i class="bi bi-arrow-counterclockwise me-1"></i>All</button>
					</div>
					<div class="card-body" data-riven-section="curses">Loading...</div>
				</div>
			</div>
			<div class="col-lg-6">
				<div class="card h-100" data-riven-card="spliced">
					<div class="card-header d-flex align-items-center justify-content-between gap-2">
						<h5 class="mb-0">Spliced traits</h5>
						<button type="button" class="btn btn-sm btn-outline-secondary riven-reset-all" data-riven-reset-all disabled aria-label="Reset all" title="Reset all"><i class="bi bi-arrow-counterclockwise me-1"></i>All</button>
					</div>
					<div class="card-body">
						<p class="form-text mt-0">A Riven can hold one spliced trait, which is always positive. Per the Warframe Wiki, a spliced trait keeps the higher roll of the two traits it was made from, so a high grade is likely.</p>
						<div data-riven-section="spliced"></div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<datalist id="weapons-datalist"></datalist>
	<?php require "components/commonjs.html"; ?>
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
	<script type="module" src="typestripped/src/riven-calc/main.js"></script>
</body>
</html>
