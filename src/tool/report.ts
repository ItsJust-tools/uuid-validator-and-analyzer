import {
  DEFAULT_STATE,
  analyzeInput,
  type ToolState,
  type Analysis,
  type ParsedUuid,
} from './types';

export { DEFAULT_STATE };
export type { ToolState, Analysis, ParsedUuid };

/** Compact summary used by the status bar and copy actions. */
export function summaryText(state: ToolState): string {
  if (!state.input.trim()) return 'Paste UUIDs to analyze';
  const analysis = analyzeInput(state);
  const dup =
    analysis.summary.duplicateEntries > 0 ? `, ${analysis.summary.duplicateEntries} duplicate` : '';
  const bad = analysis.summary.invalid > 0 ? `, ${analysis.summary.invalid} invalid` : '';
  return `${analysis.summary.valid} valid${dup}${bad}`;
}

/** Serialize a full report as plain text. */
export function reportText(analysis: Analysis): string {
  const lines: string[] = [];
  lines.push('UUID Validator and Analyzer — report');
  lines.push(
    `Total: ${analysis.summary.total}, valid: ${analysis.summary.valid}, invalid: ${analysis.summary.invalid}, unique: ${analysis.summary.unique}, duplicates: ${analysis.summary.duplicateEntries}`
  );
  const versions = Object.entries(analysis.summary.byVersion).sort();
  if (versions.length > 0) {
    lines.push(`By version: ${versions.map(([k, v]) => `v${k}=${v}`).join(', ')}`);
  }
  if (analysis.duplicates.length > 0) {
    lines.push('Duplicates:');
    for (const d of analysis.duplicates) {
      lines.push(`  ${d.canonical} ×${d.count} (v${d.version})`);
    }
  }
  if (analysis.invalid.length > 0) {
    lines.push('Invalid entries:');
    for (const entry of analysis.invalid) {
      lines.push(`  ${entry.raw}: ${entry.reason}`);
    }
  }
  return lines.join('\n');
}

/** CSV serialization of the analysis. */
export function reportCsv(analysis: Analysis): string {
  const rows: string[] = ['type,value,version_or_reason,count'];
  for (const entry of analysis.valid) {
    rows.push(csvRow('valid', entry.canonical, String(entry.version), countOf(analysis, entry)));
  }
  for (const entry of analysis.invalid) {
    rows.push(csvRow('invalid', entry.raw, entry.reason, '1'));
  }
  return rows.join('\n');
}

function countOf(analysis: Analysis, entry: ParsedUuid): string {
  const dup = analysis.duplicates.find((d) => d.canonical === entry.canonical);
  return String(dup ? dup.count : 1);
}

function csvRow(type: string, value: string, extra: string, count: string): string {
  return [type, `"${value.replace(/"/g, '""')}"`, `"${extra.replace(/"/g, '""')}"`, count].join(
    ','
  );
}

/** JSON serialization of the analysis. */
export function reportJson(analysis: Analysis): string {
  return JSON.stringify(
    {
      summary: analysis.summary,
      valid: analysis.valid.map((v) => ({
        uuid: v.canonical,
        version: v.version,
        variant: v.variant,
        isNil: v.isNil,
        isMax: v.isMax,
      })),
      invalid: analysis.invalid,
      duplicates: analysis.duplicates,
    },
    null,
    2
  );
}

/** Parse a CSV report back into a simplified analysis-like object. */
export function parseReportCsv(csv: string): Array<{ type: string; value: string; extra: string }> {
  const lines = csv.split(/\r?\n/).slice(1);
  const out: Array<{ type: string; value: string; extra: string }> = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    out.push({ type: cells[0] ?? '', value: cells[1] ?? '', extra: cells[2] ?? '' });
  }
  return out;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

/** Parse the JSON report back into an object. */
export function parseReportJson(json: string): unknown {
  return JSON.parse(json);
}
