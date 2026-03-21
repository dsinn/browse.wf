<?php
/**
 * Renders filter panel for Weekly Missions card
 */
function renderWeeklyMissionsFilters(): void
{
	$missions = [
		'clem' => 'Help Clem',
		'maroo' => 'Ayatan Treasure Hunt',
		'circuit-normal' => 'The Circuit (Normal)',
		'circuit-sp' => 'The Circuit (Steel Path)',
		'netracells' => 'Netracells',
		'kahl' => 'Break Narmer',
	];
?>
	<div class="card-filter-panel" id="weekly-missions-filters" style="display:none">
		<div class="card-body py-2">
			<?php foreach ($missions as $value => $label): ?>
				<div class="form-check">
					<input class="form-check-input" type="checkbox"
					       id="filter-weekly-missions-<?= $value ?>"
					       data-filter-type="<?= $value ?>"
					       checked>
					<label class="form-check-label" for="filter-weekly-missions-<?= $value ?>">
						<?= $label ?>
					</label>
				</div>
			<?php endforeach; ?>
		</div>
	</div>
<?php
}
