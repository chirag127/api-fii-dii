# Contributing

## Setup

```bash
pnpm install
```

## Running the scraper

```bash
node scripts/scrape.mjs
# writes data/<today>.json and data/latest.json
```

## Workflow

- Commit direct to `main` (no feature branches for own repos).
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`.
- CI runs MegaLinter on push — resolve any lint errors before merging.

## Code style

- ESM only (`"type": "module"` in package.json).
- No TypeScript — plain `.mjs` scripts.
- Keep scrape logic in `scripts/scrape.mjs`; data output goes to `data/`.
