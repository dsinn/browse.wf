<?php
// The Equipment, Enemies, Abilities and Races panels of the profile Stats tab. The Overview panel is in profile.php,
// since it holds the stat lines that profile.ts fills in. The tables here are filled in by src/profile/*.ts, and are
// written out in full (not built in JS) so that table-sort-js picks them up when the page loads.
?>
<div id="stats-equipment" class="stats-panel d-none">
	<div id="equipment-unnamed-toggle" class="mb-3"></div>
	<div id="equipment-aggregates" class="mb-4 d-none">
		<h6 class="text-body-secondary">Totals by category</h6>
		<div class="table-responsive-lg"><table class="table table-hover table-sort sticky-header">
			<thead>
				<tr>
					<th class="disable-sort">#</th>
					<th>Item</th>
					<th class="data-sort numeric-sort order-by-desc">Hours</th>
					<th class="data-sort numeric-sort order-by-desc">Kills</th>
					<th class="data-sort numeric-sort order-by-desc">Assists</th>
					<th class="data-sort numeric-sort order-by-desc">Headshots</th>
					<th class="data-sort numeric-sort order-by-desc">Fired</th>
					<th class="data-sort numeric-sort order-by-desc">Hit %</th>
					<th class="data-sort numeric-sort order-by-desc">Affinity</th>
				</tr>
			</thead>
			<tbody id="equipment-aggregate-rows"></tbody>
			<tfoot id="equipment-aggregate-total" class="fw-bold"></tfoot>
		</table></div>
	</div>
	<div id="equipment-filter-bar" class="stats-filter-bar"></div>
	<div class="table-responsive-lg min-vh-100"><table class="table table-hover table-sort sticky-header">
		<thead>
			<tr>
				<th class="disable-sort">#</th>
				<th>Item</th>
				<th class="data-sort numeric-sort order-by-desc">Used</th>
				<th class="numeric-sort order-by-desc">Hours</th>
				<th class="numeric-sort order-by-desc">Kills</th>
				<th class="numeric-sort order-by-desc">Assists</th>
				<th class="numeric-sort order-by-desc">Headshots</th>
				<th class="data-sort numeric-sort order-by-desc">Fired</th>
				<th class="data-sort numeric-sort order-by-desc"><abbr title="Hits / shots fired">Hit %</abbr></th>
				<th class="numeric-sort order-by-desc">Affinity</th>
			</tr>
		</thead>
		<tbody id="equipment-stats"></tbody>
	</table></div>
</div>
<div id="stats-enemies" class="stats-panel d-none">
	<div id="enemy-unnamed-toggle" class="mb-3"></div>
	<div id="enemy-aggregates" class="mb-4 d-none">
		<h6 class="text-body-secondary">Totals by faction</h6>
		<div class="table-responsive-lg"><table class="table table-hover table-sort sticky-header">
			<thead>
				<tr>
					<th class="disable-sort">#</th>
					<th>Enemy</th>
					<th class="data-sort numeric-sort order-by-desc">Kills</th>
					<th class="data-sort numeric-sort order-by-desc">Assists</th>
					<th class="data-sort numeric-sort order-by-desc">Headshots</th>
					<th class="data-sort numeric-sort order-by-desc">Finishers</th>
					<th class="data-sort numeric-sort order-by-desc">Deaths</th>
					<th class="data-sort numeric-sort order-by-desc">Scans</th>
				</tr>
			</thead>
			<tbody id="enemy-aggregate-rows"></tbody>
			<tfoot id="enemy-aggregate-total" class="fw-bold"></tfoot>
		</table></div>
	</div>
	<div id="enemy-filter-bar" class="stats-filter-bar"></div>
	<div class="table-responsive-lg min-vh-100"><table class="table table-hover table-sort sticky-header">
		<thead>
			<tr>
				<th class="disable-sort">#</th>
				<th>Enemy</th>
				<th class="numeric-sort order-by-desc">Kills</th>
				<th class="numeric-sort order-by-desc">Assists</th>
				<th class="numeric-sort order-by-desc">Headshots</th>
				<th class="numeric-sort order-by-desc">Finishers</th>
				<th class="numeric-sort order-by-desc">Deaths</th>
				<th class="numeric-sort order-by-desc">Scans</th>
			</tr>
		</thead>
		<tbody id="enemy-stats"></tbody>
	</table></div>
</div>
<div id="stats-abilities" class="stats-panel d-none">
	<div id="ability-filter-bar" class="stats-filter-bar"></div>
	<div class="table-responsive-lg min-vh-100"><table class="table table-hover table-sort sticky-header">
		<thead>
			<tr>
				<th class="disable-sort">#</th>
				<th class="data-sort">Warframe</th>
				<th class="data-sort">Ability</th>
				<th class="numeric-sort order-by-desc">Casts</th>
			</tr>
		</thead>
		<tbody id="ability-stats"></tbody>
	</table></div>
</div>
<div id="stats-races" class="stats-panel d-none">
	<div class="table-responsive"><table class="table table-hover table-sort">
		<thead>
			<tr>
				<th>Location</th>
				<th>Race</th>
				<th class="numeric-sort order-by-desc">High Score</th>
			</tr>
		</thead>
		<tbody id="race-stats"></tbody>
	</table></div>
</div>
