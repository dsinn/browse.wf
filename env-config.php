<?php
/**
 * Environment configuration loader
 * Reads .env file and outputs as JavaScript for browser consumption
 */

header('Content-Type: application/javascript');

$envVars = [
	'VITE_DATABASE_URL' => '',
	'VITE_DATABASE_ANON_KEY' => '',
	'WARFRAME_API_FRONT_PROXY_BASE_URL' => '',
	'WARFRAME_API_FRONT_PROXY_TOKEN' => ''
];

// First, try to read from system environment variables (for GitHub Actions build)
foreach (array_keys($envVars) as $key) {
	$value = getenv($key);
	if ($value !== false && $value !== '') {
		$envVars[$key] = $value;
	}
}

// Then, try to read .env file (for local development)
// .env values take precedence over system env vars
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
	$lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
	foreach ($lines as $line) {
		// Skip comments
		if (strpos(trim($line), '#') === 0) {
			continue;
		}

		// Parse key=value
		$parts = explode('=', $line, 2);
		if (count($parts) === 2) {
			$key = trim($parts[0]);
			$value = trim($parts[1]);

			// Remove quotes if present
			$value = trim($value, '"\'');

			if (array_key_exists($key, $envVars)) {
				$envVars[$key] = $value;
			}
		}
	}
}

// Output as JavaScript
echo "window.__ENV__ = " . json_encode($envVars) . ";\n";
?>
