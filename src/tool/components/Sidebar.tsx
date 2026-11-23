'use client';

import React from 'react';
import type { ToolState, HistoryEntry } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

const VERSIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: '1', label: 'v1', hint: 'time-based (MAC address)' },
  { id: '2', label: 'v2', hint: 'DCE security' },
  { id: '3', label: 'v3', hint: 'MD5 name-based' },
  { id: '4', label: 'v4', hint: 'random' },
  { id: '5', label: 'v5', hint: 'SHA-1 name-based' },
  { id: '6', label: 'v6', hint: 'reordered time-based' },
  { id: '7', label: 'v7', hint: 'Unix time + random' },
  { id: '8', label: 'v8', hint: 'custom/vendor' },
];

export const Sidebar: React.FC<SidebarProps> = ({ state }) => {
  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="uuid-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">How it works</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Paste UUIDs separated by newlines or commas. Each entry is validated for format, and its
          RFC 4122 version and variant bits are decoded. Duplicates are flagged with occurrence
          counts.
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Versions</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {VERSIONS.map((v) => (
            <li key={v.id} className="flex justify-between gap-2">
              <span>{v.label}</span>
              <span className="text-gray-500 dark:text-gray-400">{v.hint}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Variants</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li className="flex justify-between gap-2">
            <span>rfc4122</span>
            <span className="text-gray-500 dark:text-gray-400">standard (10xx bits)</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>microsoft</span>
            <span className="text-gray-500 dark:text-gray-400">legacy COM/CLR GUIDs</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>reserved / future</span>
            <span className="text-gray-500 dark:text-gray-400">non-standard variants</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Saved snapshots</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} entr{state.history.length === 1 ? 'y' : 'ies'} in history
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
        <HistoryList history={state.history} />
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Shortcuts</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <kbd>A</kbd> — analyze the pasted list
          </li>
          <li>
            <kbd>C</kbd> — copy report
          </li>
          <li>
            <kbd>X</kbd> — clear input
          </li>
        </ul>
      </div>
    </div>
  );
};

function HistoryList({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <p
        className="mt-2 text-xs text-gray-500 dark:text-gray-400"
        data-testid="sidebar-history-empty"
      >
        No saved snapshots yet.
      </p>
    );
  }
  return (
    <ul className="mt-2 space-y-1" data-testid="sidebar-history-list">
      {history.map((entry, i) => (
        <li
          key={`${entry.createdAt}-${i}`}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 dark:border-gray-800 dark:text-gray-300"
        >
          {entry.text}
        </li>
      ))}
    </ul>
  );
}
