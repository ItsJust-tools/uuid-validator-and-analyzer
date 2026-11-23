'use client';

import React from 'react';
import { analyzeInput, versionLabel, type ToolState } from '../types';
import { reportText, reportCsv, reportJson } from '../report';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

const badgeClass =
  'inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide';

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Copy"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onSaveHistory }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const analysis = React.useMemo(() => analyzeInput(state), [state]);
  const hasInput = state.input.trim().length > 0;

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="uuid-canvas">
      <div>
        <label
          className="block text-xs font-medium text-gray-700 dark:text-gray-300"
          htmlFor="uuid-input"
        >
          UUIDs — one per line, or comma separated
        </label>
        <textarea
          id="uuid-input"
          data-testid="uuid-input"
          rows={6}
          value={state.input}
          onChange={(e) => update({ input: e.target.value })}
          placeholder={
            '550e8400-e29b-41d4-a716-446655440000\nurn:uuid:123e4567-e89b-12d3-a456-426614174000'
          }
          className={`${inputClass} font-mono`}
          spellCheck={false}
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            data-testid="strip-decorations"
            checked={state.stripDecorations}
            onChange={(e) => update({ stripDecorations: e.target.checked })}
            className="rounded border-gray-300"
          />
          Strip braces, urn:uuid prefix and quotes before validating
        </label>
      </div>

      <div
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        data-testid="summary-card"
        role="status"
      >
        <span className="mb-2 block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Summary
        </span>
        {hasInput ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="summary-stats">
            <div>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Total</span>
              <span className="text-lg font-bold" data-testid="stat-total">
                {analysis.summary.total}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Valid</span>
              <span
                className="text-lg font-bold text-green-700 dark:text-green-400"
                data-testid="stat-valid"
              >
                {analysis.summary.valid}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Invalid</span>
              <span
                className={`text-lg font-bold ${analysis.summary.invalid > 0 ? 'text-red-700 dark:text-red-400' : ''}`}
                data-testid="stat-invalid"
              >
                {analysis.summary.invalid}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Duplicates</span>
              <span
                className={`text-lg font-bold ${analysis.summary.duplicateEntries > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}
                data-testid="stat-duplicates"
              >
                {analysis.summary.duplicateEntries}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="summary-empty">
            Paste UUIDs above to validate, normalize and analyze them.
          </p>
        )}
        {Object.keys(analysis.summary.byVersion).length > 0 ? (
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-300" data-testid="by-version">
            By version:{' '}
            {Object.entries(analysis.summary.byVersion)
              .sort()
              .map(([v, count]) => `${versionLabel(Number(v) as never)}=${count}`)
              .join(', ')}
          </p>
        ) : null}
      </div>

      {hasInput ? (
        <>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Valid UUIDs
            </h3>
            {analysis.valid.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="valid-empty">
                No valid UUIDs found.
              </p>
            ) : (
              <ul className="space-y-1" data-testid="valid-list">
                {analysis.valid.map((entry, i) => {
                  const dup = analysis.duplicates.find((d) => d.canonical === entry.canonical);
                  return (
                    <li
                      key={`${entry.canonical}-${i}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs dark:border-gray-800 dark:bg-gray-900"
                    >
                      <span
                        className="font-mono text-gray-700 dark:text-gray-300"
                        data-testid="valid-uuid"
                      >
                        {entry.canonical}
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className={`${badgeClass} bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200`}
                        >
                          {versionLabel(entry.version)}
                        </span>
                        <span
                          className={`${badgeClass} bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200`}
                        >
                          {entry.variant}
                        </span>
                        {entry.isNil ? (
                          <span className={`${badgeClass} bg-gray-200 text-gray-700`}>nil</span>
                        ) : null}
                        {entry.isMax ? (
                          <span className={`${badgeClass} bg-gray-200 text-gray-700`}>max</span>
                        ) : null}
                        {dup ? (
                          <span
                            className={`${badgeClass} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200`}
                            data-testid="dup-badge"
                          >
                            ×{dup.count}
                          </span>
                        ) : null}
                        <CopyButton value={entry.canonical} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {analysis.invalid.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-red-700 dark:text-red-300">
                Invalid entries
              </h3>
              <ul className="space-y-1" data-testid="invalid-list">
                {analysis.invalid.map((entry, i) => (
                  <li
                    key={`${entry.raw}-${i}`}
                    data-testid="invalid-entry"
                    className="flex justify-between gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs dark:border-red-900 dark:bg-gray-900"
                  >
                    <span className="font-mono text-red-800 dark:text-red-300">{entry.raw}</span>
                    <span className="text-red-600 dark:text-red-400">{entry.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.duplicates.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Duplicates
              </h3>
              <ul className="space-y-1" data-testid="duplicates-list">
                {analysis.duplicates.map((d) => (
                  <li
                    key={d.canonical}
                    className="flex justify-between gap-2 rounded-md border border-amber-200 bg-white px-3 py-1.5 text-xs dark:border-amber-900 dark:bg-gray-900"
                  >
                    <span className="font-mono text-gray-700 dark:text-gray-300">
                      {d.canonical}
                    </span>
                    <span className="text-amber-700 dark:text-amber-400">
                      {d.count}× (v{d.version === 'unknown' ? '?' : d.version})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Export report
            </h3>
            <div className="flex flex-wrap gap-2" data-testid="export-buttons">
              <CopyButton value={reportText(analysis)} testid="copy-report-text" />
              <CopyButton value={reportCsv(analysis)} testid="copy-report-csv" />
              <CopyButton value={reportJson(analysis)} testid="copy-report-json" />
              <button
                type="button"
                data-testid="btn-dedupe"
                disabled={analysis.valid.length === 0}
                onClick={() => {
                  const seen = new Set<string>();
                  const out: string[] = [];
                  for (const entry of analysis.valid) {
                    if (!seen.has(entry.canonical)) {
                      seen.add(entry.canonical);
                      out.push(entry.canonical);
                    }
                  }
                  const text = out.join('\n');
                  update({ input: text });
                  onSaveHistory?.(`Deduped: ${out.length} unique UUIDs`);
                }}
                className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Replace input with deduped list
              </button>
            </div>
          </div>
        </>
      ) : null}

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        Everything is computed locally in your browser; no network calls.
      </p>
    </div>
  );
};
