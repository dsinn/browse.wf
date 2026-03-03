<div class="card-filter-panel" id="invasions-filters" style="display:none">
	<div class="card-body py-2">
		<div class="form-check">
			<input class="form-check-input" type="checkbox"
			       id="filter-invasions-randomized-missions"
			       data-filter-type="randomized-missions"
			       checked>
			<label class="form-check-label" for="filter-invasions-randomized-missions">
				Show randomized mission types
			</label>
		</div>
		<hr class="my-2">
		<div class="row g-2">
			<?php
			// Keys are the last path segment of the Oracle API ItemType, with the
			// part-name suffix stripped for weapons — matching invasionRewardFilterKey()
			// in src/invasions.ts.
			// @TODO: derive labels from warframe-items instead of hardcoding them
			$groups = [
				'Resources' => [
					'EnergyComponent'           => 'Fieldron',
					'ChemComponent'             => 'Detonite Injector',
					'BioComponent'              => 'Mutagen Mass',
					'InfestedAladCoordinate'    => 'Mutalist Alad V Nav Coordinate',
				],
				'Blueprints' => [
					'Forma'                     => 'Forma',
					'OrokinCatalyst'            => 'Orokin Catalyst',
					'OrokinReactor'             => 'Orokin Reactor',
					'ExilusAdapter'             => 'Exilus Warframe Adapter',
				],
				'Weapon parts' => [
					'DeraVandal'                => 'Dera Vandal',
					'KarakWraith'               => 'Karak Wraith',
					'LatronWraith'              => 'Latron Wraith',
					'GrineerCombatKnife'        => 'Sheev',
					'SnipetronVandal'           => 'Snipetron Vandal',
					'StrunWraith'               => 'Strun Wraith',
					'TwinVipersWraith'          => 'Twin Vipers Wraith',
				],
			];
			foreach ($groups as $heading => $items): ?>
			<div class="col-auto me-3">
				<p class="mb-1 text-body-secondary small"><?= $heading ?></p>
				<?php foreach ($items as $key => $label): ?>
				<div class="form-check">
					<input class="form-check-input" type="checkbox"
					       id="filter-invasions-reward-<?= $key ?>"
					       data-filter-type="reward-<?= $key ?>"
					       checked>
					<label class="form-check-label" for="filter-invasions-reward-<?= $key ?>">
						<?= $label ?>
					</label>
				</div>
				<?php endforeach; ?>
			</div>
			<?php endforeach; ?>
		</div>
	</div>
</div>
