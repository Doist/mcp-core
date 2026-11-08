# Contributing

## Setup

```bash
npm install
```

This installs dependencies and registers lefthook git hooks through the `prepare` script: commits and pushes to `main` are refused, pre-commit lints, formats and type-checks, pre-push runs the tests.

## Scripts

- `npm run build`: compile TypeScript to `dist/`
- `npm run dev`: watch-mode build
- `npm test`: run vitest
- `npm run type-check`: typecheck without emit
- `npm run check`: oxlint + oxfmt --check
- `npm run fix`: oxlint --fix + oxfmt
- `npm run verify`: every check CI runs (lint, format, types, build, tests) in about five seconds; run it before opening a PR

## Trying a change in an MCP server

```bash
npm run build && npm pack
# in the server's checkout
npm install --no-save /path/to/doist-mcp-core-0.0.0-development.tgz
npm test
```

## Commit messages

Conventional Commits are required: semantic-release uses them to decide version bumps. Examples:

- `feat: add a progress reporter for long tool calls`
- `fix(output): keep content items ahead of the JSON block`
- `chore: bump deps`

PR titles are validated against the same convention.

## Releases

semantic-release publishes to npm with provenance and updates the changelog. Until npm publishing is set up for `@doist/mcp-core`, the release workflow runs only when started by hand.
