<?php
// The numbered steps for getting a profile (platform, user ID, fetch or manual download). They are shown and updated by
// src/profile/workflow.ts.
?>
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
			<strong>Provide your user ID / gid.</strong>
			<div class="mt-1">
				<input id="account-id" type="text" class="form-control form-control-sm" placeholder="Example: 55540360384632532d7b23c6" oninput="onAccountIdManualInput()" />
				<div id="account-id-invalid-chars" class="invalid-feedback d-none">Only numbers and letters from A to F are allowed.</div>
				<div id="account-id-feedback" class="invalid-feedback"><span id="account-id-char-count">0</span>/24 characters</div>
			</div>

			<div class="mt-4">
				If you do not know your user ID / gid:

				<ol class="mt-2" style="list-style-type: lower-alpha;">
					<li>Ensure that you are logged in at <a href="https://www.warframe.com/login" target="_blank">warframe.com</a>.</li>
					<li>In a tab showing <a href="https://www.warframe.com/" target="_blank">www.warframe.com</a> (not this page), open your browser's developer tools (Windows/Linux: <kbd>F12</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>&nbsp;; Mac: <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>I</kbd>).</li>
					<li>
						Find the cookie named <code>gid</code> for <code>https://www.warframe.com</code>:
						<ul>
							<li>Chrome / Edge: <strong>Application</strong> tab&nbsp;&rarr; <strong>Cookies</strong>. (<a href="https://developer.chrome.com/docs/devtools/application/cookies" target="_blank">Guide link</a>)</li>
							<li>Firefox: <strong>Storage</strong> tab&nbsp;&rarr; <strong>Cookies</strong>. (<a href="https://firefox-source-docs.mozilla.org/devtools-user/storage_inspector/index.html" target="_blank">Guide link</a>)</li>
						</ul>
					</li>
					<li>Copy its <strong>Value</strong> (looks like <code>505875fb1a4d80894a123456</code>).</li>
					<li>Paste it into the text box above.</li>
				</ol>
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
