<div id="history" class="d-none mt-4">
	<p class="text-secondary-emphasis">New invigorations will become available in <span id="invigoration-timer"></span></p>
	<h4>Invigoration History</h4>
	<?php foreach (['this-week' => 'This Week', 'last-week' => 'Last Week'] as $prefix => $label): ?>
	<div id="history-<?= $prefix ?>" class="d-none mb-3">
		<h5 class="mb-2"><?= $label ?></h5>
		<div class="row text-center">
			<?php for ($i = 0; $i < 3; $i++): ?>
			<div class="col-4">
				<h6 id="<?= $prefix ?>-suit-<?= $i ?>"></h6>
				<p id="<?= $prefix ?>-off-<?= $i ?>" class="m-0"></p>
				<p id="<?= $prefix ?>-def-<?= $i ?>"></p>
			</div>
			<?php endfor; ?>
		</div>
	</div>
	<?php endforeach; ?>
</div>
