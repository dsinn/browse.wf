/**
 A small declarative schema language for describing what we expect from worldState,
 plus a validator that turns violations into readable error/warning messages.

 The schema itself lives in ./schema.ts. Severities:
 - error: worldState breaks an assumption the app (or the game's design) makes, or has
 information the schema doesn't know about yet. The test fails.
 - warning: informational only, e.g. a key we don't read has disappeared.
 */

export type Severity = 'error' | 'warning';

type Context = {
	/**
	The whole worldState document
	*/
	root: any;
	/**
	Wall-clock time (ms) to compare against, e.g. for staleness checks
	*/
	now: number;
};

export type Invariant = {
	/**
	Human-readable statement of what should hold, e.g. "exactly one CT_LAB entry"
	*/
	expected: string;
	holds: (value: any, context: Context) => boolean;
	severity?: Severity;
};

type CommonOptions = {
	/**
	The value may be absent (undefined). Present-but-wrong-type is still reported.
	*/
	optional?: boolean;
	/**
	Severity for a missing value or a wrong type. Defaults to error.
	*/
	severity?: Severity;
	/**
	Where the site reads this value, shown in messages to help triage
	*/
	usedBy?: string;
	/**
	Extra cross-field checks
	*/
	invariants?: Invariant[];
};

export type StringRule = CommonOptions & {
	kind: 'string';
	pattern?: RegExp;
	oneOf?: readonly string[];
};

/**
WorldState only has integers, so every number is checked to be one
*/
export type IntegerRule = CommonOptions & {kind: 'number'};

export type BooleanRule = CommonOptions & {kind: 'boolean'};

export type Count = {min?: number; max?: number};

export type ArrayRule = CommonOptions & {
	kind: 'array';
	item: Rule;
	/**
	Expected number of items. Out of range is an error.
	*/
	count?: Count;
};

export type ObjectRule = CommonOptions & {
	kind: 'object';
	fields: Record<string, Rule>;
	/**
	Fields we know about but don't read. They're never checked, but they aren't reported as new either.
	Any key in neither `fields` nor `unusedFields` is an error.
	*/
	unusedFields?: readonly string[];
};

export type AnyRule = CommonOptions & {kind: 'any'};

/**
Value must match one of several shapes, chosen by its JSON type
*/
export type ShapesRule = CommonOptions & {kind: 'shapes'; shapes: Rule[]};

export type Rule = StringRule | IntegerRule | BooleanRule | ArrayRule | ObjectRule | AnyRule | ShapesRule;

type Options<R extends Rule> = Omit<R, 'kind'>;

// ---------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------

export const string = (options: Options<StringRule> = {}): StringRule => ({kind: 'string', ...options});
export const integer = (options: Options<IntegerRule> = {}): IntegerRule => ({kind: 'number', ...options});
export const boolean = (options: Options<BooleanRule> = {}): BooleanRule => ({kind: 'boolean', ...options});
export const anything = (options: Options<AnyRule> = {}): AnyRule => ({kind: 'any', ...options});

export const array = (item: Rule, options: Omit<Options<ArrayRule>, 'item'> = {}): ArrayRule => ({
	kind: 'array',
	item,
	...options,
});

export const object = (
	fields: Record<string, Rule>,
	options: Omit<Options<ObjectRule>, 'fields'> = {},
): ObjectRule => ({kind: 'object', fields, ...options});

export const shapes = (rules: Rule[]): ShapesRule => ({kind: 'shapes', shapes: rules});

export const optional = <R extends Rule>(rule: R): R => ({...rule, optional: true});

/**
 A top-level key the site doesn't read. Only its presence is checked (a warning if it disappears),
 but it stays listed so genuinely new keys still stand out.
 */
export const unused = (): AnyRule => ({kind: 'any', severity: 'warning'});

/**
`{$oid: "..."}`. The site treats the ID as an opaque string.
*/
export const oid = (): ObjectRule => object({$oid: string()});

/**
`{$date: {$numberLong: "<ms since epoch>"}}`. The site parseInt()s the string.
*/
export const mongoDate = (): ObjectRule => object({
	$date: object({
		$numberLong: string({pattern: /^\d{12,14}$/u}),
	}),
});

export const mongoDateMs = (value: any): number => Number(value?.$date?.$numberLong);

/**
True if the entry's Activation/Expiry window contains worldState.Time
*/
export const isActiveAtWorldStateTime = (entry: any, context: Context): boolean => {
	const time = typeof context.root?.Time === 'number' ? context.root.Time * 1000 : context.now;
	return mongoDateMs(entry?.Activation) <= time && time < mongoDateMs(entry?.Expiry);
};

/**
Invariant: some array entry is active at worldState.Time
*/
export const someEntryActive: Invariant = {
	expected: 'an entry whose Activation–Expiry window contains worldState.Time',
	holds: (list: any[], context) => list.some(entry => isActiveAtWorldStateTime(entry, context)),
};

// ---------------------------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------------------------

export type Issue = {
	severity: Severity;
	/**
	JSON-ish path with array indices collapsed, e.g. `Invasions[*].Faction`
	*/
	path: string;
	message: string;
	usedBy?: string;
	/**
	Distinct offending values (truncated), when relevant
	*/
	examples: string[];
	/**
	How many times this exact issue occurred (e.g. across array items)
	*/
	occurrences: number;
};

const jsonType = (value: unknown): string => {
	if (value === null) {
		return 'null';
	}

	return Array.isArray(value) ? 'array' : typeof value;
};

const describeType = (value: unknown): string => (Array.isArray(value) ? `array(${value.length})` : jsonType(value));

const ruleJsonType = (rule: Rule): string | undefined => (rule.kind === 'any' || rule.kind === 'shapes' ? undefined : rule.kind);

const truncate = (text: string, max = 60): string => (text.length > max ? text.slice(0, max - 1) + '…' : text);

class Collector {
	readonly #issues = new Map<string, Issue>();

	add(issue: Omit<Issue, 'examples' | 'occurrences'>, example?: unknown): void {
		const key = `${issue.severity}\0${issue.path}\0${issue.message}`;
		let existing = this.#issues.get(key);
		if (!existing) {
			existing = {...issue, examples: [], occurrences: 0};
			this.#issues.set(key, existing);
		}

		existing.occurrences++;
		if (example === undefined || existing.examples.length >= 5) {
			return;
		}

		const text = truncate(JSON.stringify(example) ?? typeof example);
		if (!existing.examples.includes(text)) {
			existing.examples.push(text);
		}
	}

	get issues(): Issue[] {
		return this.#issues.values().toArray();
	}
}

type Walker = {context: Context; out: Collector};

type Checker<R extends Rule> = (value: any, rule: R, path: string, walker: Walker) => void;

const describeCount = ({min, max}: Count): string => {
	if (max === undefined) {
		return `at least ${min ?? 0}`;
	}

	return min === max ? `exactly ${max}` : `${min ?? 0}–${max}`;
};

const checkString: Checker<StringRule> = (text: string, rule, path, {out}) => {
	const {usedBy} = rule;
	if (rule.pattern && !rule.pattern.test(text)) {
		out.add({
			severity: rule.severity ?? 'error', path, message: `does not match ${String(rule.pattern)}`, usedBy,
		}, text);
	}

	if (rule.oneOf && !rule.oneOf.includes(text)) {
		out.add({
			severity: rule.severity ?? 'error',
			path,
			message: `has a value outside the known set (${rule.oneOf.join(', ')})`,
			usedBy,
		}, text);
	}
};

const checkInteger: Checker<IntegerRule> = (value: number, rule, path, {out}) => {
	if (!Number.isSafeInteger(value)) {
		out.add({
			severity: rule.severity ?? 'error', path, message: 'expected an integer', usedBy: rule.usedBy,
		}, value);
	}
};

const checkArray: Checker<ArrayRule> = (list: unknown[], rule, path, walker) => {
	const {count} = rule;
	if (count && (list.length < (count.min ?? 0) || list.length > (count.max ?? Infinity))) {
		walker.out.add({
			severity: 'error',
			path,
			message: `has ${list.length} items, expected ${describeCount(count)}`,
			usedBy: rule.usedBy,
		});
	}

	for (const item of list) {
		validateValue(item, rule.item, `${path}[*]`, walker);
	}
};

const checkObject: Checker<ObjectRule> = (record: Record<string, unknown>, rule, path, walker) => {
	const childPath = (key: string) => (path ? `${path}.${key}` : key);
	for (const [key, fieldRule] of Object.entries(rule.fields)) {
		validateValue(record[key], fieldRule, childPath(key), walker);
	}

	for (const [key, fieldValue] of Object.entries(record)) {
		if (!Object.hasOwn(rule.fields, key) && !rule.unusedFields?.includes(key)) {
			walker.out.add({severity: 'error', path: childPath(key), message: `is new (not in the schema): ${describeType(fieldValue)}`});
		}
	}
};

const checkShapes: Checker<ShapesRule> = (value, rule, path, walker) => {
	const match = rule.shapes.find(shape => ruleJsonType(shape) === jsonType(value));
	if (match) {
		validateValue(value, match, path, walker);
		return;
	}

	const expected = rule.shapes.map(shape => ruleJsonType(shape)).join(' or ');
	walker.out.add({
		severity: rule.severity ?? 'error', path, message: `expected ${expected}, got ${jsonType(value)}`, usedBy: rule.usedBy,
	});
};

const noChecks = () => undefined;

const checkers: {[K in Rule['kind']]: Checker<Extract<Rule, {kind: K}>>} = {
	string: checkString,
	number: checkInteger,
	boolean: noChecks,
	array: checkArray,
	object: checkObject,
	any: noChecks,
	shapes: checkShapes,
};

function validateValue(value: unknown, rule: Rule, path: string, walker: Walker): void {
	const severity = rule.severity ?? 'error';
	const {usedBy} = rule;

	if (value === undefined) {
		if (!rule.optional) {
			walker.out.add({
				severity, path, message: 'is missing', usedBy,
			});
		}

		return;
	}

	const expectedType = ruleJsonType(rule);
	if (expectedType !== undefined && jsonType(value) !== expectedType) {
		walker.out.add({
			severity, path, message: `expected ${expectedType}, got ${jsonType(value)}`, usedBy,
		}, value);
		return;
	}

	(checkers[rule.kind] as Checker<Rule>)(value, rule, path, walker);

	for (const invariant of rule.invariants ?? []) {
		if (!invariant.holds(value, walker.context)) {
			walker.out.add({
				severity: invariant.severity ?? 'error', path: path || '(root)', message: `expected ${invariant.expected}`, usedBy,
			});
		}
	}
}

const severityRank: Record<Severity, number> = {error: 0, warning: 1};

export function validate(value: unknown, rule: Rule, options: {now?: number} = {}): Issue[] {
	const out = new Collector();
	validateValue(value, rule, '', {context: {root: value, now: options.now ?? Date.now()}, out});
	return out.issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

function formatIssue(issue: Issue): string {
	const icon = issue.severity === 'error' ? '✖ ERROR  ' : '⚠ WARNING';
	let line = `${icon} ${issue.path} ${issue.message}`;
	if (issue.examples.length > 0) {
		line += `; got ${issue.examples.join(', ')}`;
	}

	if (issue.occurrences > 1) {
		line += ` (×${issue.occurrences})`;
	}

	if (issue.usedBy) {
		line += `\n            used by: ${issue.usedBy}`;
	}

	return line;
}

export function formatReport(issues: Issue[]): string {
	if (issues.length === 0) {
		return 'worldState: matches the schema (no errors or warnings)';
	}

	const errors = issues.filter(issue => issue.severity === 'error').length;
	const warnings = issues.length - errors;
	return [`worldState: ${errors} error(s), ${warnings} warning(s)`, ...issues.map(issue => formatIssue(issue))].join('\n');
}
