import { describe, it, expect } from 'vitest';
import {
  tokenize,
  parseUuid,
  stripDecorationsFrom,
  detectVersion,
  detectVariant,
  invalidReason,
  analyzeInput,
  dedupeCanonical,
  isCanonicalForm,
  isState,
  DEFAULT_STATE,
  type ToolState,
} from '@/tool/types';
import {
  serializeState,
  deserializeState,
  withHistory,
  roundTrips,
  uuidTool,
} from '@/tool/tool-definition';
import {
  reportText,
  reportCsv,
  reportJson,
  parseReportCsv,
  parseReportJson,
  summaryText,
} from '@/tool/report';

const V1 = 'c232ab00-9414-11ec-b3c8-9f6b8ba1a1a1'; // RFC 4122 sample v1
const V3 = '3d813cbb-47fb-32ba-91df-831e1593ac29'; // v3 (md5, example.com)
const V4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const V4_B = '9F0C2D4A-3E1B-4C5D-8E9F-0A1B2C3D4E5F';
const V5 = '21f7f8de-8051-5b89-8680-0195ef798b6a'; // v5 (dns, example.com)
const V7 = '017f22e2-79b0-7cc3-98c4-dc0c0c07398f';
const BRACED = '{123E4567-E89B-12D3-A456-426614174000}';
const URNED = 'urn:uuid:123e4567-e89b-12d3-a456-426614174000';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('tokenize', () => {
  it('parses newline and comma separated mixed input', () => {
    expect(tokenize(`${V4}, ${V1}\n${V5},\r\n${V7}`)).toEqual([V4, V1, V5, V7]);
  });

  it('drops empty tokens and trims whitespace', () => {
    expect(tokenize('  \n\n  ')).toEqual([]);
    expect(tokenize(`  ${V4}  `)).toEqual([V4]);
  });
});

describe('parseUuid', () => {
  it('identifies known versions', () => {
    expect(parseUuid(V1, true)?.version).toBe(1);
    expect(parseUuid(V3, true)?.version).toBe(3);
    expect(parseUuid(V4, true)?.version).toBe(4);
    expect(parseUuid(V5, true)?.version).toBe(5);
    expect(parseUuid(V7, true)?.version).toBe(7);
  });

  it('detects the rfc4122 variant for standard UUIDs', () => {
    expect(parseUuid(V4, true)?.variant).toBe('rfc4122');
    expect(parseUuid(V1, true)?.variant).toBe('rfc4122');
    expect(parseUuid(V7, true)?.variant).toBe('rfc4122');
  });

  it('detects non-rfc4122 variants from variant bits', () => {
    // first nibble of group 4 = 0 => reserved (NCS)
    expect(parseUuid('c232ab00-9414-11ec-03c8-9f6b8ba1a1a1', true)?.variant).toBe('reserved');
    // 110x => microsoft
    expect(parseUuid('c232ab00-9414-11ec-d3c8-9f6b8ba1a1a1', true)?.variant).toBe('microsoft');
    // 111x => future
    expect(parseUuid('c232ab00-9414-11ec-f3c8-9f6b8ba1a1a1', true)?.variant).toBe('future');
  });

  it('normalizes uppercase input to canonical lowercase', () => {
    const parsed = parseUuid(V4_B, true);
    expect(parsed?.canonical).toBe(V4_B.toLowerCase());
  });

  it('rejects malformed input', () => {
    expect(parseUuid('not-a-uuid', true)).toBeNull();
    expect(parseUuid('', true)).toBeNull();
    expect(parseUuid('123e4567-e89b-12d3-a456-42661417400g', true)).toBeNull();
    expect(parseUuid('123e456789b12d3a456426614174000', true)).toBeNull();
  });

  it('detects nil and max UUIDs', () => {
    expect(parseUuid('00000000-0000-0000-0000-000000000000', true)?.isNil).toBe(true);
    expect(parseUuid('ffffffff-ffff-ffff-ffff-ffffffffffff', true)?.isMax).toBe(true);
    expect(parseUuid(V4, true)?.isNil).toBe(false);
  });

  it('honors stripDecorations=false for decorated tokens', () => {
    expect(parseUuid(BRACED, false)).toBeNull();
    expect(parseUuid(BRACED, true)?.canonical).toBe('123e4567-e89b-12d3-a456-426614174000');
  });
});

describe('stripDecorationsFrom', () => {
  it('strips braces, urn prefix and quotes', () => {
    expect(stripDecorationsFrom(BRACED)).toBe('123E4567-E89B-12D3-A456-426614174000');
    expect(stripDecorationsFrom(URNED)).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(stripDecorationsFrom('"abc"')).toBe('abc');
    expect(stripDecorationsFrom('  x  ')).toBe('x');
  });
});

describe('detectVersion', () => {
  it('returns unknown for non-version nibbles', () => {
    expect(detectVersion('c232ab00-9414-11ec-b3c8-9f6b8ba1a1a1')).toBe(1);
    expect(detectVersion('00000000-0000-0000-0000-000000000000')).toBe('unknown');
  });
});

describe('detectVariant', () => {
  it('classifies all bit patterns', () => {
    expect(detectVariant('00000000-0000-0000-8000-000000000000')).toBe('rfc4122');
    expect(detectVariant('00000000-0000-0000-b000-000000000000')).toBe('rfc4122');
    expect(detectVariant('00000000-0000-0000-d000-000000000000')).toBe('microsoft');
    expect(detectVariant('00000000-0000-0000-0000-000000000000')).toBe('reserved');
    expect(detectVariant('00000000-0000-0000-e000-000000000000')).toBe('future');
    expect(detectVariant('00000000-0000-0000-f000-000000000000')).toBe('future');
  });
});

describe('invalidReason', () => {
  it('gives reasons for common mistakes', () => {
    expect(invalidReason(V4, true)).toBeNull();
    expect(invalidReason('123e4567-e89b-12d3-a456-42661417400', true)).toMatch(/wrong length/);
    expect(invalidReason('xyz', true)).toMatch(/non-hex/);
    expect(invalidReason('123e4567-e89b-12d3-a456-426614174000-extra', true)).toBeTruthy();
    expect(invalidReason('', true)).toBeNull();
  });

  it('decorated entries fail only when stripping is disabled', () => {
    expect(invalidReason(BRACED, true)).toBeNull();
    expect(invalidReason(BRACED, false)).toBeTruthy();
  });
});

describe('analyzeInput', () => {
  it('summarizes valid, invalid and duplicates', () => {
    const analysis = analyzeInput(state({ input: `${V4}\n${V4}\n${V1}\nnope` }));
    expect(analysis.summary.total).toBe(4);
    expect(analysis.summary.valid).toBe(3);
    expect(analysis.summary.invalid).toBe(1);
    expect(analysis.summary.unique).toBe(2);
    expect(analysis.summary.duplicateEntries).toBe(1);
    expect(analysis.duplicates).toEqual([{ canonical: V4, version: 4, count: 2 }]);
  });

  it('counts per version', () => {
    const analysis = analyzeInput(state({ input: `${V1}\n${V4}\n${V4}\n${V5}\n${V7}` }));
    expect(analysis.summary.byVersion).toEqual({ '1': 1, '4': 2, '5': 1, '7': 1 });
  });

  it('flag invalid entries with reasons', () => {
    const analysis = analyzeInput(state({ input: 'hello world' }));
    expect(analysis.invalid).toHaveLength(1);
    expect(analysis.invalid[0]?.raw).toBe('hello world');
    expect(analysis.invalid[0]?.reason).toBeTruthy();
  });

  it('normalizes braces and urn prefixes before dedupe', () => {
    const analysis = analyzeInput(state({ input: `${BRACED}\n${URNED}` }));
    expect(analysis.summary.unique).toBe(1);
    expect(analysis.summary.duplicateEntries).toBe(1);
  });

  it('handles empty input', () => {
    const analysis = analyzeInput(state({ input: '' }));
    expect(analysis.summary.total).toBe(0);
    expect(analysis.valid).toEqual([]);
    expect(analysis.invalid).toEqual([]);
    expect(analysis.duplicates).toEqual([]);
  });
});

describe('dedupeCanonical', () => {
  it('returns unique canonical UUIDs in first-seen order', () => {
    expect(dedupeCanonical(state({ input: `${V4}\n${V1}\n${V4}` }))).toEqual([V4, V1]);
  });
  it('returns null when nothing valid', () => {
    expect(dedupeCanonical(state({ input: 'junk' }))).toBeNull();
  });
});

describe('state serialization', () => {
  it('round-trips through serialize/deserialize', () => {
    const s = state({ input: `${V4}\n${BRACED}`, stripDecorations: false });
    expect(roundTrips(s)).toBe(true);
    const restored = deserializeState(JSON.parse(serializeState(s)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(s);
    }
  });

  it('repairs invalid payloads', () => {
    const restored = deserializeState({ input: 42, stripDecorations: 'yes', history: 'bad' });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.input).toBe('');
      expect(restored.data.stripDecorations).toBe(true);
      expect(restored.data.history).toEqual([]);
    }
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    expect(deserializeState('nope').success).toBe(false);
  });

  it('caps history at MAX_HISTORY', () => {
    let s = state({ input: V4 });
    for (let i = 0; i < 25; i++) {
      s = withHistory(s, `snapshot ${i}`, new Date(2026, 0, 1, 12, 0, i));
    }
    expect(s.history).toHaveLength(20);
    expect(s.history[0]?.text).toBe('snapshot 24');
  });
});

describe('uuidTool definition', () => {
  it('exposes config identity', () => {
    expect(uuidTool.id).toBe('uuid-validator-and-analyzer');
    expect(uuidTool.name).toBe('UUID Validator and Analyzer');
    expect(uuidTool.deserialize({ input: V4 }).success).toBe(true);
  });
});

describe('isState and isCanonicalForm', () => {
  it('guards state shape', () => {
    expect(isState(state())).toBe(true);
    expect(isState({ input: 'x' })).toBe(false);
    expect(isState(null)).toBe(false);
  });
  it('checks canonical form strictly', () => {
    expect(isCanonicalForm(V4)).toBe(true);
    expect(isCanonicalForm(V4.toUpperCase())).toBe(false);
    expect(isCanonicalForm(BRACED)).toBe(false);
  });
});

describe('report serialization', () => {
  const analysis = analyzeInput(state({ input: `${V4}\n${V4}\nnope` }));

  it('serializes CSV and parses it back', () => {
    const csv = reportCsv(analysis);
    const rows = parseReportCsv(csv);
    expect(rows[0]).toEqual({ type: 'valid', value: V4, extra: '4' });
    expect(rows.filter((r) => r.type === 'invalid')).toHaveLength(1);
  });

  it('serializes JSON and parses it back', () => {
    const parsed = parseReportJson(reportJson(analysis)) as {
      summary: { total: number; valid: number };
      valid: Array<{ uuid: string; version: number }>;
    };
    expect(parsed.summary.total).toBe(3);
    expect(parsed.summary.valid).toBe(2);
    expect(parsed.valid[0]?.version).toBe(4);
  });

  it('produces plain text report with duplicates and invalid entries', () => {
    const text = reportText(analysis);
    expect(text).toContain('Duplicates:');
    expect(text).toContain('Invalid entries:');
    expect(text).toContain('nope');
  });

  it('summary text reflects state', () => {
    expect(summaryText(state({ input: '' }))).toBe('Paste UUIDs to analyze');
    expect(summaryText(state({ input: `${V4}\n${V4}\nbad` }))).toBe(
      '2 valid, 1 duplicate, 1 invalid'
    );
  });
});
