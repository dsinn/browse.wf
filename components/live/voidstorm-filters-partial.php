<?php
/**
 * Renders filter panel for Void Storms (Railjack) card
 *
 * @param string $keyPrefix Card name for localStorage keys (e.g., "rj-fissures")
 */
function renderVoidStormFilters(string $keyPrefix): void
{
	$tiers = [
		'VoidT1' => 'Lith',
		'VoidT2' => 'Meso',
		'VoidT3' => 'Neo',
		'VoidT4' => 'Axi',
	];

	$missionTypes = [
		'RailjackExterminate' => 'Exterminate',
		'Railjack' => 'Skirmish',
		'RailjackSpy' => 'Spy',
		'RailjackSurvival' => 'Survival',
		'RailjackVolatile' => 'Volatile',
	];
?>
	<div class="card-filter-panel" id="<?= $keyPrefix ?>-filters" style="display:none">
		<div class="card-body py-2">
			<!-- Tier Group (visual grouping only) -->
			<h6 class="small fw-semibold border-bottom pb-1 mb-2">Tier</h6>
			<div class="filter-grid-vertical-tier">
				<?php foreach ($tiers as $value => $label): ?>
					<div class="form-check">
						<input class="form-check-input" type="checkbox"
						       id="filter-<?= $keyPrefix ?>-<?= $value ?>"
						       data-filter-type="<?= $value ?>"
						       checked>
						<label class="form-check-label" for="filter-<?= $keyPrefix ?>-<?= $value ?>">
							<?= $label ?>
						</label>
					</div>
				<?php endforeach; ?>
			</div>

			<!-- Mission Type Group (visual grouping only) -->
			<h6 class="small fw-semibold border-bottom pb-1 mb-2 mt-3">Mission Type</h6>
			<div class="filter-grid-vertical-missions">
				<?php foreach ($missionTypes as $value => $label): ?>
					<div class="form-check">
						<input class="form-check-input" type="checkbox"
						       id="filter-<?= $keyPrefix ?>-<?= $value ?>"
						       data-filter-type="<?= $value ?>"
						       checked>
						<label class="form-check-label" for="filter-<?= $keyPrefix ?>-<?= $value ?>">
							<?= $label ?>
						</label>
					</div>
				<?php endforeach; ?>
			</div>
		</div>
	</div>
<?php
}
