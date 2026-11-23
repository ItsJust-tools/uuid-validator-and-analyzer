import type { ExportFormat } from '@itsjust/core';

export const toolConfig = {
  id: 'uuid-validator-and-analyzer',
  name: 'UUID Validator and Analyzer',
  category: 'Utility',
  description:
    'Paste one or many UUIDs to validate format/version/variant, normalize casing, detect duplicates, and get a quick breakdown report.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf', 'json'] satisfies ExportFormat[],
  features: {
    export: true,
    autoSave: true,
    undoRedo: false,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#8b5cf6',
    accentHover: '#7c3aed',
    accentSubtle: 'rgba(139, 92, 246, 0.15)',
    brand: 'UUID Validator and Analyzer',
    icon: '🆔',
  },
  shortcuts: [
    {
      title: 'UUID Validator and Analyzer',
      shortcuts: [
        {
          keys: 'A',
          label: 'Analyze',
          description: 'analyze the pasted UUID list',
        },
        { keys: 'C', label: 'Copy report', description: 'copy the report as plain text' },
        { keys: 'X', label: 'Clear input', description: 'clear the UUID input' },
      ],
    },
  ],
};

export default toolConfig;
