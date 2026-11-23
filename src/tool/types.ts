/**
 * UUID parsing and analysis utilities (RFC 4122 / RFC 9562).
 */

export type UuidVersion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'unknown';

export type UuidVariant = 'rfc4122' | 'microsoft' | 'future' | 'reserved' | 'unknown';

export interface HistoryEntry {
  /** Short human readable description of the saved snapshot. */
  text: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

export interface ParsedUuid {
  /** Canonical lowercase 8-4-4-4-12 form. */
  canonical: string;
  version: UuidVersion;
  variant: UuidVariant;
  /** True when the UUID is the nil UUID. */
  isNil: boolean;
  /** True when the UUID is the max UUID. */
  isMax: boolean;
}

export interface InvalidEntry {
  /** Original trimmed token as entered. */
  raw: string;
  /** Human-readable reason the token is not a valid UUID. */
  reason: string;
}

export interface DuplicateInfo {
  canonical: string;
  version: UuidVersion;
  count: number;
}

export interface AnalysisSummary {
  total: number;
  valid: number;
  invalid: number;
  unique: number;
  duplicateEntries: number;
  byVersion: Record<string, number>;
}

export interface Analysis {
  valid: ParsedUuid[];
  invalid: InvalidEntry[];
  duplicates: DuplicateInfo[];
  summary: AnalysisSummary;
}

export interface ToolState {
  /** Raw pasted input (newline and/or comma separated). */
  input: string;
  /** Strip surrounding braces/urn:uuid prefixes before validating. */
  stripDecorations: boolean;
  /** Saved report snapshots, newest first. */
  history: HistoryEntry[];
}

export const DEFAULT_STATE: ToolState = {
  input: '',
  stripDecorations: true,
  history: [],
};

export const MAX_HISTORY = 20;

const CANONICAL_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isCanonicalForm(value: string): boolean {
  return CANONICAL_RE.test(value);
}

/** Detect the RFC 4122 version nibble from the canonical string. */
export function detectVersion(canonical: string): UuidVersion {
  const nibble = canonical[14];
  switch (nibble) {
    case '1':
      return 1;
    case '2':
      return 2;
    case '3':
      return 3;
    case '4':
      return 4;
    case '5':
      return 5;
    case '6':
      return 6;
    case '7':
      return 7;
    case '8':
      return 8;
    default:
      return 'unknown';
  }
}

/** Detect the variant from the clock-seq-and-reserved bits (first hex of group 4). */
export function detectVariant(canonical: string): UuidVariant {
  const nibble = canonical[19];
  const value = Number.parseInt(nibble ?? 'z', 16);
  if (Number.isNaN(value)) return 'unknown';
  if ((value & 0x8) === 0) return 'reserved';
  if ((value & 0xc) === 0x8) return 'rfc4122';
  if ((value & 0xe) === 0xc) return 'microsoft';
  return 'future';
}

/**
 * Strip common decorations: urn:uuid prefix, surrounding braces,
 * surrounding quotes, and a bare hyphen prefix.
 */
export function stripDecorationsFrom(value: string): string {
  let out = value.trim();
  if (/^urn:uuid:/i.test(out)) out = out.slice(9);
  if (out.startsWith('{') && out.endsWith('}')) out = out.slice(1, -1);
  if (out.startsWith('"') && out.endsWith('"')) out = out.slice(1, -1);
  return out.trim();
}

/** Parse one token into a ParsedUuid, or null when it is not a valid UUID. */
export function parseUuid(raw: string, strip: boolean): ParsedUuid | null {
  let token = raw.trim();
  if (strip) token = stripDecorationsFrom(token);
  const canonical = token.toLowerCase().replace(/-/g, '');
  if (canonical.length !== 32 || !/^[0-9a-f]+$/.test(canonical)) return null;
  const hyphenated = [
    canonical.slice(0, 8),
    canonical.slice(8, 12),
    canonical.slice(12, 16),
    canonical.slice(16, 20),
    canonical.slice(20, 32),
  ].join('-');
  return {
    canonical: hyphenated,
    version: detectVersion(hyphenated),
    variant: detectVariant(hyphenated),
    isNil: /^0+$/.test(canonical),
    isMax: /^f+$/.test(canonical),
  };
}

/**
 * Split raw input on newlines and commas, dropping empty tokens.
 * Handles \r\n line endings.
 */
export function tokenize(input: string): string[] {
  return input
    .split(/[\n\r]+|,/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Give a reason why a token is invalid, or null when it is (or may be) valid.
 * Only decorative forms are rejected; plain token formatting is lenient.
 */
export function invalidReason(raw: string, strip: boolean): string | null {
  let token = raw.trim();
  if (strip) token = stripDecorationsFrom(token);
  if (token.length === 0) return null;
  const compact = token.toLowerCase().replace(/-/g, '');
  if (/^[0-9a-f]+$/.test(compact) && compact.length === 32) return null;
  if (/^[0-9a-f]{4}(-[0-9a-f]{1,12}){1,4}$/i.test(token)) {
    return 'wrong length: a UUID has 32 hex digits in 5 hyphen-separated groups';
  }
  if (/[^0-9a-fA-F-]/.test(token)) {
    return 'contains non-hex characters';
  }
  if (/^[0-9a-f]+$/i.test(compact)) {
    return `wrong length: ${compact.length} hex digits instead of 32`;
  }
  return 'not a valid UUID format';
}

/** Analyze the whole input: valid entries, invalid reasons, duplicates, stats. */
export function analyzeInput(state: ToolState): Analysis {
  const tokens = tokenize(state.input);
  const valid: ParsedUuid[] = [];
  const invalid: InvalidEntry[] = [];
  const byVersion: Record<string, number> = {};

  for (const token of tokens) {
    const parsed = parseUuid(token, state.stripDecorations);
    if (parsed) {
      valid.push(parsed);
      const key = String(parsed.version);
      byVersion[key] = (byVersion[key] ?? 0) + 1;
    } else {
      const reason = invalidReason(token, state.stripDecorations) ?? 'not a valid UUID format';
      invalid.push({ raw: token, reason });
    }
  }

  const counts = new Map<string, DuplicateInfo>();
  for (const entry of valid) {
    const existing = counts.get(entry.canonical);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(entry.canonical, { canonical: entry.canonical, version: entry.version, count: 1 });
    }
  }
  const duplicates = [...counts.values()]
    .filter((d) => d.count > 1)
    .sort((a, b) => b.count - a.count || a.canonical.localeCompare(b.canonical));

  const duplicateEntries = duplicates.reduce((sum, d) => sum + d.count - 1, 0);

  return {
    valid,
    invalid,
    duplicates,
    summary: {
      total: tokens.length,
      valid: valid.length,
      invalid: invalid.length,
      unique: counts.size,
      duplicateEntries,
      byVersion,
    },
  };
}

/**
 * Deduplicated valid UUIDs (first occurrence order, lowercase canonical),
 * or null when the input contains no valid UUIDs.
 */
export function dedupeCanonical(state: ToolState): string[] | null {
  const analysis = analyzeInput(state);
  if (analysis.valid.length === 0) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of analysis.valid) {
    if (!seen.has(entry.canonical)) {
      seen.add(entry.canonical);
      out.push(entry.canonical);
    }
  }
  return out;
}

/** Version label for display. */
export function versionLabel(version: UuidVersion): string {
  return version === 'unknown' ? 'unknown' : `v${version}`;
}

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return typeof v.input === 'string' && typeof v.stripDecorations === 'boolean';
}
