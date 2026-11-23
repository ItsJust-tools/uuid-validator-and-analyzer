# UUID Validator and Analyzer

Paste one or many UUIDs to validate format, detect the RFC 4122 version and variant, normalize casing, and spot duplicates — all locally in your browser.

**Live:** [uuid-validator-and-analyzer.itsjust.tools](https://uuid-validator-and-analyzer.itsjust.tools)

## Features

- Validate single or bulk UUID lists (newline/comma separated) with per-item pass or fail
- Detect UUID version (RFC 4122 v1–v8) and variant bits for each valid entry
- Normalize to lowercase canonical form with optional brace and `urn:uuid:` stripping
- Highlight duplicates with occurrence counts and one-click dedupe export
- Summary stats: total, valid, invalid, unique, and count per version
- Copy the report as plain text, CSV, or JSON
- Inline error hints explaining why an entry is invalid
- Shareable state via URL and `.itsjust.json` import/export, plus image/PDF export
- 100% client-side — no network calls

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t itsjust-uuid-validator-and-analyzer .
docker run -p 3000:3000 itsjust-uuid-validator-and-analyzer
```

## License

MIT
