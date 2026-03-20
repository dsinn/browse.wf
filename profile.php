<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
	<title>Profile Viewer | browse.wf</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
	<link rel="icon" href="https://browse.wf/Lotus/Interface/Icons/Categories/GrimoireModIcon.png">
	<style>
		.form-select
		{
			display: inline-block;
			width: fit-content;
		}

		.colour-blob
		{
			display: inline-block;
			height: 1em;
			width: 1em;
			position: relative;
			top: 3px;
			left: -1px;
		}

		.hide-if-none-slotted:not(:has(> ul:first-of-type > li:not(.d-none)))
		{
			display: none;
		}
	</style>
	<link rel="stylesheet" href="src/profile.css">
</head>
<body data-bs-theme="dark">
	<?php require "components/navbar.php"; ?>
	<div class="container-fluid pt-3">
		<div id="refresh-alert" class="alert alert-info d-none">
			Showing cached profile data.
		</div>
		<ol id="steps" class="list-group list-group-numbered mb-3 d-none">
			<li class="list-group-item" id="step1-container">
				<span class="step-status me-2"></span>
				<strong>Select your platform:</strong>
				<select id="platform-select" class="form-select form-select-sm mt-2" onchange="onPlatformChange()">
					<option value="">-- Select Platform --</option>
					<option value="pc">PC</option>
					<option value="ps4">PlayStation</option>
					<option value="xb1">Xbox</option>
					<option value="swi">Switch</option>
					<option value="mob">iOS</option>
					<option value="and">Android</option>
				</select>
			</li>
			<li class="list-group-item" id="step2-container">
				<span class="step-status me-2"></span>
				<div>
					<strong>Provide your account ID.</strong>
					<div class="mt-1">
						First, <button type="button" class="btn btn-sm btn-primary me-1" onclick="copyWarframePath(event)">Click Me</button> to copy the <code>%localappdata%\Warframe</code> path to your clipboard.
					</div>
					<div class="mt-4">
						<strong>Option A:</strong>
						<div class="alert alert-secondary mt-2 mb-2">
							⚠️ The <a href="https://wiki.warframe.com/w/EE.log" target="_blank">EE.log</a> file contains sensitive information, so you can either trust the maintainer of this browse.wf fork, or use Option B below.
						</div>
						<div>
							Click "Browse...", paste the path you copied into your file browser's address bar, hit enter, and select EE.log.
						</div>
						<div class="mt-1">
							<input id="ee-log-file" type="file" class="form-control form-control-sm" accept=".log" onchange="loadEELog(this.files[0]);" />
						</div>
					</div>
					<div class="mt-4">
						<strong>Option B:</strong>
						<div class="mt-1">
							Use a file explorer or text editor to navigate to the path that you copied, open EE.log as a text document, search for the text "Logged in", and copy the hexadecimal ID inside the parentheses on that line.
						</div>
						<div class="mt-1">
							<input id="account-id" type="text" class="form-control form-control-sm" placeholder="Example: 55540360384632532d7b23c6" oninput="onAccountIdManualInput()" />
							<div id="account-id-invalid-chars" class="invalid-feedback d-none">Only numbers and letters from A to F are allowed.</div>
							<div id="account-id-feedback" class="invalid-feedback"><span id="account-id-char-count">0</span>/24 characters</div>
						</div>
					</div>
				</div>
			</li>
			<li class="list-group-item" id="step3-auto-container">
				<span class="step-status me-2"></span>
				<button type="button" class="btn btn-sm btn-primary" onclick="fetchProfile()">Fetch Profile</button>
			</li>
			<li class="list-group-item" id="step3-manual-container">
				<span class="step-status me-2"></span>
				<div>
					<div id="rate-limit-notice" class="mb-2 d-none">Rate limited. Next fetch available in <span id="rate-limit-countdown"></span> or use the manual download below.</div>
					<a id="download-link" class="btn btn-sm btn-primary" href="#" target="_blank"
					   onclick="onDownloadLinkLeftClick(event)" oncontextmenu="onDownloadLinkRightClick(event)">
						Right-click and select "Save Link As..."
					</a>
					<div id="download-warning" class="d-none mt-1 text-warning small">Please right-click the button and choose "Save link as..." to download the file.</div>
				</div>
			</li>
			<li class="list-group-item" id="step4-container">
				<span class="step-status me-2"></span>
				<strong>Select the downloaded profile data file:</strong>
				<div class="w-100 mt-2">
					<input id="profile-file" type="file" class="form-control form-control-sm" onchange="loadProfile(this.files[0]);" />
				</div>
			</li>
		</ol>
		<div id="status" class="alert alert-light"><div class="spinner-border spinner-border-sm me-2"></div><span>Loading</span></div>
		<h3 class="mb-0"><span id="profile-name"></span><span class="text-body-secondary" id="profile-discriminator"></span></h3>
		<p id="mr" class="mb-1 d-none">Mastery Rank <b></b>, Registered <span></span></p>
		<p id="profile-fetched" class="mb-1 text-muted d-none"><small>Profile data from: <span></span></small></p>
		<p id="accolades" class="mb-1 d-none"><b>Accolades:</b> <span></span></p>
		<p id="clan" class="mb-1 d-none"><b>Clan:</b> <span></span></p>
		<ul id="profile-nav" class="nav nav-underline d-none">
			<li class="nav-item"><a class="nav-link" href="#" data-tab="fashion" onclick="tabulate(this, event)">Fashion</a></li>
			<li class="nav-item"><a class="nav-link active" href="#" data-tab="syndicates" onclick="tabulate(this, event)">Syndicates</a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-tab="missions" onclick="tabulate(this, event)">Missions</a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-tab="achievements" onclick="tabulate(this, event)">Achievements</a></li>
			<li class="nav-item"><a class="nav-link" href="#" data-tab="stats" onclick="tabulate(this, event)">Stats</a></li>
		</ul>
		<div id="syndicates" class="tab row p-2 d-none"></div>
		<div id="achievements" class="tab row p-2 d-none"></div>
		<div id="missions" class="tab pt-2 d-none">
			<table class="table table-hover">
				<thead>
					<tr>
						<th>Location</th>
						<th>Completions</th>
						<th>Steel Path</th>
						<th>Note</th>
					</tr>
				</thead>
				<tbody></tbody>
			</table>
		</div>
		<div id="fashion" class="tab row pt-2 d-none">
			<div class="col-md-6">
				<h4>Warframe: <span id="Suits-name"></span> <select id="Suits-config" class="form-select" onchange="updateFashion();"></select></h4>
				<ul>
					<li id="Suits-skin-0" class="d-none">Helmet: <span></span></li>
					<li id="Suits-skin-7" class="d-none">Skin: <span></span></li>
					<li id="Suits-skin-5" class="d-none">Animation Set: <span></span></li>
				</ul>
				<h6>Material Structures & Colors</h6>
				<ul>
					<li>
						<span id="Suits-pricol-t0">Primary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></span>
						<ul>
							<li id="Suits-skin-17" class="d-none">Material Structure: <span></span></li>
						</ul>
					</li>
					<li>
						<span id="Suits-pricol-t1">Secondary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></span>
						<ul>
							<li id="Suits-skin-18" class="d-none">Material Structure: <span></span></li>
						</ul>
					</li>
					<li>
						<span id="Suits-pricol-t2">Tertiary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></span>
						<ul>
							<li id="Suits-skin-19" class="d-none">Material Structure: <span></span></li>
						</ul>
					</li>
					<li>
						<span id="Suits-pricol-t3">Accents: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></span>
						<ul>
							<li id="Suits-skin-20" class="d-none">Material Structure: <span></span></li>
						</ul>
					</li>
					<li id="Suits-pricol-m0">Emissive 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
					<li id="Suits-pricol-m1">Emissive 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
					<li id="Suits-pricol-en">Energy 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
					<li id="Suits-pricol-e1">Energy 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
				</ul>
				<div class="hide-if-none-slotted">
					<h5>Attachments</h5>
					<ul>
						<li id="Suits-skin-8" class="d-none">Chest: <span></span></li>
						<li id="Suits-skin-1" class="d-none">Left Shoulder: <span></span></li>
						<li id="Suits-skin-9" class="d-none">Right Shoulder: <span></span></li>
						<li id="Suits-skin-16" class="d-none">Ephemera: <span></span></li>
						<li id="Suits-skin-2" class="d-none">Left Leg: <span></span></li>
						<li id="Suits-skin-10" class="d-none">Right Leg: <span></span></li>
						<li id="Suits-skin-11" class="d-none">Auxiliary: <span></span></li>
						<li id="Suits-skin-16" class="d-none">Ephemera: <span></span></li>
						<li id="Suits-skin-25" class="d-none">Signa: <span></span></li>
					</ul>
					<h6>Colors</h6>
					<ul>
						<li id="Suits-attcol-t0">Primary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-attcol-t1">Secondary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-attcol-t2">Tertiary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-attcol-t3">Accents: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-attcol-m0">Emissive 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-attcol-m1">Emissive 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-attcol-en">Energy 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-attcol-e1">Energy 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
					</ul>
				</div>
				<div id="Suits-skin-6">
					<h5>Syandana: <span></span></h5>
					<ul>
						<li id="Suits-syancol-t0">Primary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-syancol-t1">Secondary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-syancol-t2">Tertiary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-syancol-t3">Accents: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-syancol-m0">Emissive 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-syancol-m1">Emissive 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-syancol-en">Energy 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Suits-syancol-e1">Energy 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
					</ul>
				</div>
				<div class="hide-if-none-slotted">
					<h5>Sigils</h5>
					<ul>
						<li id="Suits-skin-3" class="d-none">Left Sigil: <span></span></li>
						<li id="Suits-skin-4" class="d-none">Right Sigil: <span></span></li>
						<li id="Suits-skin-12" class="d-none">
							Front Sigil: <span></span>
							<ul>
								<li id="Suits-sigcol-t0">Color 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
								<li id="Suits-sigcol-m0">Color 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
							</ul>
						</li>
						<li id="Suits-skin-13" class="d-none">
							Back Sigil: <span></span>
							<ul>
								<li id="Suits-sigcol-t2">Color 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
								<li id="Suits-sigcol-m1">Color 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
							</ul>
						</li>
					</ul>
				</div>
			</div>
			<div class="col-md-6">
				<div id="LongGuns-div">
					<h4>Primary: <span id="LongGuns-name"></span> <select id="LongGuns-config" class="form-select" onchange="updateFashion();"></select></h4>
					<ul>
						<li id="LongGuns-hide">Hidden When Holstered</li>
						<li id="LongGuns-skin-0">Skin: <span></span></li>
						<li id="LongGuns-pricol-t0">Primary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="LongGuns-pricol-t1">Secondary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="LongGuns-pricol-t2">Tertiary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="LongGuns-pricol-t3">Accents: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="LongGuns-pricol-m0">Emissive 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="LongGuns-pricol-m1">Emissive 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="LongGuns-pricol-en">Energy 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="LongGuns-pricol-e1">Energy 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
					</ul>
				</div>
				<div id="Pistols-div">
					<h4>Secondary: <span id="Pistols-name"></span> <select id="Pistols-config" class="form-select" onchange="updateFashion();"></select></h4>
					<ul>
						<li id="Pistols-hide">Hidden When Holstered</li>
						<li id="Pistols-skin-0">Skin: <span></span></li>
						<li id="Pistols-pricol-t0">Primary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Pistols-pricol-t1">Secondary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Pistols-pricol-t2">Tertiary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Pistols-pricol-t3">Accents: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Pistols-pricol-m0">Emissive 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Pistols-pricol-m1">Emissive 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Pistols-pricol-en">Energy 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Pistols-pricol-e1">Energy 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
					</ul>
				</div>
				<div id="Melee-div">
					<h4>Melee: <span id="Melee-name"></span> <select id="Melee-config" class="form-select" onchange="updateFashion();"></select></h4>
					<ul>
						<li id="Melee-hide">Hidden When Holstered</li>
						<li id="Melee-skin-0">Skin: <span></span></li>
						<li id="Melee-skin-2">Holster Style: <span></span></li>
						<li id="Melee-pricol-t0">Primary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Melee-pricol-t1">Secondary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Melee-pricol-t2">Tertiary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Melee-pricol-t3">Accents: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Melee-pricol-m0">Emissive 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Melee-pricol-m1">Emissive 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Melee-pricol-en">Energy 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						<li id="Melee-pricol-e1">Energy 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
					</ul>
					<div id="Melee-skin-6">
						<h5>Attachment: <span></span></h5>
						<ul>
							<li id="Melee-attcol-t0">Primary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
							<li id="Melee-attcol-t1">Secondary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
							<li id="Melee-attcol-t2">Tertiary: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
							<li id="Melee-attcol-t3">Accents: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
							<li id="Melee-attcol-m0">Emissive 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
							<li id="Melee-attcol-m1">Emissive 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
							<li id="Melee-attcol-en">Energy 1: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
							<li id="Melee-attcol-e1">Energy 2: <span class="hex"></span> <span class="colour-blob"></span> <span class="palettes"></span></li>
						</ul>
					</div>
				</div>
			</div>
			<!--<div>
				<h3>Operator</h3>
				<ul>
					<li id="Operator-skin-0">Head: <span></span></li>
					<li id="Operator-skin-1">Body: <span></span></li>
					<li id="Operator-skin-2">Hair: <span></span></li>
					<li id="Operator-skin-3">Face Markings: <span></span></li>
					<li id="Operator-skin-4">Signia(?): <span></span></li>
					<li id="Operator-skin-5">Hood: <span></span></li>
					<li id="Operator-skin-6">Suit: <span></span></li>
					<li id="Operator-skin-7">Sleeves: <span></span></li>
					<li id="Operator-skin-8">Legging: <span></span></li>
					<li id="Operator-skin-9">Voice: <span></span></li>
					<li id="Operator-skin-10">Skirt: <span></span></li>
					<li id="Operator-skin-11">Animation Set: <span></span></li>
					<li id="Operator-skin-12">Sigil: <span></span></li>
					<li id="Operator-skin-13">Head 2: <span></span></li>
					<li id="Operator-skin-14">Earrings: <span></span></li>
					<li id="Operator-skin-15">Glasses: <span></span></li>
					<li id="Operator-skin-16">Ephemera: <span></span></li>
				</ul>
			</div>-->
		</div>
		<div id="stats" class="tab pt-2 d-none">
			<div class="row">
				<div class="col-md-4">
					<span class="d-block">Time Played: <span id="stat-TimePlayedSec"></span></span>
					<span class="d-block">Gross Income: <span id="stat-Income"></span></span>

					<span class="d-block">Revives: <span id="stat-ReviveCount"></span></span>
					<span class="d-block">Heals: <span id="stat-HealCount"></span></span>
					<span class="d-block">Deaths: <span id="stat-Deaths"></span></span>
					<!--<span class="d-block">Melee Kills: <span id="stat-MeleeKills"></span></span>-->
				</div>
				<div class="col-md-4">
					<span class="d-block">Missions Completed: <span id="stat-MissionsCompleted"></span></span>
					<span class="d-block">Missions Failed: <span id="stat-MissionsFailed"></span></span>
					<span class="d-block">Missions Quit: <span id="stat-MissionsQuit"></span></span>
					<span class="d-block">Missions Interrupted: <span id="stat-MissionsInterrupted"></span></span>
					<span class="d-block">Missions Dumped: <span id="stat-MissionsDumped"></span></span>
				</div>
				<div class="col-md-4">
					<span class="d-block">Ciphers Solved: <span id="stat-CiphersSolved"></span></span>
					<span class="d-block">Ciphers Failed: <span id="stat-CiphersFailed"></span></span>
					<span class="d-block">Total Cipher Time: <span id="stat-CipherTime"></span></span>
					<span class="d-block">Average Cipher Time: <span id="stat-CipherTimeAvg"></span></span>
				</div>
			</div>
			<div class="row mt-3">
				<div class="col-lg-6 border-end">
					<h4>Equipment</h4>
					<div id="equipment-filter-bar" class="stats-filter-bar"></div>
					<div class="table-responsive"><table class="table table-hover table-sort">
						<thead>
							<tr>
								<th class="disable-sort">#</th>
								<th>Item</th>
								<th class="numeric-sort order-by-desc">Used</th>
								<th class="numeric-sort order-by-desc">Hours</th>
								<th class="numeric-sort order-by-desc">Kills</th>
								<th class="numeric-sort order-by-desc"><abbr title="Headshots">H.S.</abbr></th>
								<th class="numeric-sort order-by-desc">Assists</th>
								<th class="numeric-sort order-by-desc">Affinity</th>
							</tr>
						</thead>
						<tbody id="equipment-stats"></tbody>
					</table></div>
				</div>
				<div class="col-lg-6">
					<h4>Enemies</h4>
					<div id="enemy-filter-bar" class="stats-filter-bar"></div>
					<div class="table-responsive"><table class="table table-hover table-sort">
						<thead>
							<tr>
								<th class="disable-sort">#</th>
								<th>Enemy</th>
								<th class="numeric-sort order-by-desc">Kills</th>
								<th class="numeric-sort order-by-desc">Assists</th>
								<th class="numeric-sort order-by-desc"><abbr title="Headshots">H.S.</abbr></th>
								<th class="numeric-sort order-by-desc"><abbr title="Finishers">Fin.</abbr></th>
								<th class="numeric-sort order-by-desc">Deaths</th>
								<th class="numeric-sort order-by-desc">Scans</th>
							</tr>
						</thead>
						<tbody id="enemy-stats"></tbody>
					</table></div>
				</div>
			</div>
		</div>
	</div>
	<?php require "components/commonjs.html"; ?>
	<script src="https://pluto-lang.org/wasm-builds/out/libpluto/0.9.5/libpluto.js"></script>
	<script src="https://pluto-lang.org/PlutoScript/plutoscript.js"></script>
	<link rel="stylesheet" href="src/profile-stats-filters.css">
	<script src="typestripped/profile.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
	<script src="https://cdn.jsdelivr.net/npm/table-sort-js@1.22.3/table-sort.js" integrity="sha384-2H8QgKuUCS7jhXxYcrxnd2XJiqEFR3T5KXvVBKbahxhKffvxT9LDnYRH+CRcdujv" crossorigin="anonymous"></script>
</body>
</html>
