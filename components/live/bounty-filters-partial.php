<?php
$syndicates = [
	'ZarimanSyndicate' => [
		'label' => 'The Holdfasts',
		'maxTier' => 5,
		'missionTypes' => [
			'MT_EXTERMINATION'  => 'Exterminate',
			'MT_MOBILE_DEFENSE' => 'Mobile Defense',
			'MT_ARMAGEDDON'     => 'Void Armageddon',
			'MT_VOID_CASCADE'   => 'Void Cascade',
			'MT_CORRUPTION'     => 'Void Flood',
		],
	],
	'EntratiLabSyndicate' => [
		'label' => 'Cavia',
		'maxTier' => 5,
		'missionTypes' => [
			'MT_ALCHEMY'       => 'Alchemy',
			'MT_ASSASSINATION' => 'Assassination',
			'MT_ARTIFACT'      => 'Disruption',
			'MT_EXTERMINATION' => 'Exterminate',
			'MT_DEFENSE'       => 'Mirror Defense',
			'MT_SURVIVAL'      => 'Survival',
		],
	],
	'HexSyndicate' => [
		'label' => 'The Hex',
		'maxTier' => 7,
		'missionTypes' => [
			'MT_ASSASSINATION'   => 'Assassination',
			'MT_DEFENSE'         => 'Defense',
			'MT_EXTERMINATION'   => 'Exterminate',
			'MT_ENDLESS_CAPTURE' => 'Legacyte Harvest',
			'MT_SURVIVAL'        => 'Survival',
		],
	],
];
?>
<div class="card-filter-panel" id="bounties-filters" style="display: none">
	<div class="card-body">
		<div class="row g-3">
			<?php foreach ($syndicates as $tag => $syndicate): ?>
			<div class="col-12 col-sm-6 col-md-4">
				<h6 class="small fw-semibold border-bottom pb-1 mb-2"><?= $syndicate['label'] ?></h6>
				<div class="mb-2">
					<select class="form-select form-select-sm w-auto" id="bounty-filter-<?= $tag ?>">
						<option value="1">Show all tiers</option>
						<?php foreach (range(2, $syndicate['maxTier'] - 1) as $tier): ?>
							<option value="<?= $tier ?>">Show Tier <?= $tier ?> and up</option>
						<?php endforeach ?>
						<option value="<?= $syndicate['maxTier'] ?>">Show Tier <?= $syndicate['maxTier'] ?> only</option>
						<option value="-1">Hide all tiers</option>
					</select>
				</div>
				<?php foreach ($syndicate['missionTypes'] as $value => $label): ?>
				<div class="form-check">
					<input class="form-check-input" type="checkbox"
					       id="bounty-filter-<?= $tag ?>-<?= $value ?>"
					       data-bounty-syndicate="<?= $tag ?>"
					       data-filter-type="<?= $value ?>"
					       checked>
					<label class="form-check-label" for="bounty-filter-<?= $tag ?>-<?= $value ?>">
						<?= $label ?>
					</label>
				</div>
				<?php endforeach ?>
			</div>
			<?php endforeach ?>
		</div>
	</div>
</div>
