import path from 'node:path';
import {fileURLToPath} from 'node:url';
import xo from 'xo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ignores = [
	// Upstream files that exist on the senpai branch
	'arbys.ts',
	'common.js',
	'index.ts',
	'live.ts',
	'prime-vault.ts',
	'profile.ts',
	'supplemental-data/arbyTiers.js',
	'typestripped/**',
	// Build artifacts
	'public/**',
];

const xoConfigs = xo.xoToEslintConfig([]);

const config = [
	{ignores},
	...xoConfigs,
	// Require 'u' flag (not 'v') — v requires ES2024, incompatible with tsconfig.json target of ES2021
	{rules: {'require-unicode-regexp': ['error', {requireFlag: 'u'}]}},
	// Enforce LF line endings in JS/TS files
	{files: ['**/*.js', '**/*.ts'], rules: {'@stylistic/linebreak-style': 'error'}},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parserOptions: {
				// Test/ and e2e/ are excluded from tsconfig.json; tsconfig.lint.json covers all fork dirs
				projectService: false,
				project: path.join(__dirname, 'tsconfig.lint.json'),
			},
		},
		rules: {
			// Requires strictNullChecks, which is not enabled in this project's tsconfig
			'@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
			'@typescript-eslint/no-useless-default-assignment': 'off',
			'@typescript-eslint/prefer-nullish-coalescing': 'off',
			// Upstream Warframe API data is untyped (any) by nature; typing it fully is out of scope
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			// Intentional as any casts exist for upstream globals and API data
			'@typescript-eslint/no-unsafe-type-assertion': 'off',
			// Build tooling (esbuild/Vitest) resolves extensionless imports; explicit .js not needed
			'import-x/extensions': 'off',
			// Src/ modules are browser-only by design (they touch document, localStorage, HTMLElement,
			// etc.) and will never run in Node, workers, or Deno. The rule's motivation —
			// environment-agnostic code — doesn't apply here. Disabling it allows `window.foo` for
			// typed global property access, which TypeScript can enforce via `interface Window`
			// augmentation. Using `globalThis.foo` instead would require `as any` to satisfy the
			// compiler under strict mode, which defeats the purpose of having typed globals at all.
			'unicorn/prefer-global-this': 'off',
			// Array#toSorted() requires ES2023 but tsconfig targets ES2021
			'unicorn/no-array-sort': 'off',
			// Array#at() requires ES2022 but tsconfig targets ES2021
			'unicorn/prefer-at': 'off',
			// Allow SCREAMING_SNAKE_CASE for module-level constants; disable for object properties
			// since Warframe API uses PascalCase keys that can't be renamed
			'@typescript-eslint/naming-convention': [
				'error',
				{selector: 'default', format: ['camelCase']},
				{selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allowDouble'},
				{
					selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow', trailingUnderscore: 'allow',
				},
				{selector: 'typeLike', format: ['PascalCase']},
				{selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE']},
				{selector: 'objectLiteralProperty', format: null},
				{selector: 'typeProperty', format: null},
			],
		},
	},
	// No-await-in-loop is often intentional for sequential processing in tests
	{
		files: ['test/**/*.ts', 'test/**/*.js', 'e2e/**/*.ts', 'src/**/*.test.ts', 'scripts/**/*.test.ts'],
		rules: {
			'no-await-in-loop': 'off',
			'@typescript-eslint/restrict-plus-operands': 'off',
		},
	},
	// Allows a blanket eslint-disable around code intentionally copied verbatim from an
	// upstream file (e.g. live.ts, which is itself unlinted) rather than restyled to fork
	// conventions, so the copy stays diffable against its upstream source.
	{
		files: ['src/teshin/index.ts'],
		rules: {'unicorn/no-abusive-eslint-disable': 'off'},
	},
];

export default config;
