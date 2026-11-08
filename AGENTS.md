# mcp-core

Shared core for the Doist MCP servers (`@doist/todoist-mcp`, `@doist/comms-mcp`, `@doist/automations-mcp`): the tool contract, tool registration, how a result is shaped for the wire, and contract test suites. TypeScript, ESM-only, Node ≥ 24.

> For where things are, read [`CODEBASE.md`](./CODEBASE.md). This file covers the _rules_.

## Definition of done

- **Done means proven:** a test that failed before the change and passes after, at the module's public interface. For a refactor: tests that pin the behaviour, passing before and after. Reading code or a passing compile is not proof.
- **Run `npm run verify` before calling a change done.** It runs every check CI runs, in about five seconds, and records the pass. It prints what it cannot see, and when only docs changed it checks just their formatting.
- **Never weaken a check to pass it.** Don't skip, delete or loosen tests, edit lint, type or test config to get green, or use `--no-verify`. If a check looks wrong, say so and stop.
- **Report honestly:** what ran, what it showed, and what you did not verify.

## Skills

Use the matching skill without being asked. They live in `.agents/skills/` (Claude Code reads them through `.claude/skills/`).

- `verify`: before saying a change is done, fixed or ready.
- `fix-bug`: something is broken or wrong.
- `build-feature`: a new module, export, option or behaviour.
- `refactor`: changing structure without changing behaviour. Other tasks send restructuring here, as a separate change.
- `write-tests`: writing or changing tests; `.agents/skills/write-tests/references/test-rules.md` is the quality bar.
- `learn`: after a correction, to turn it into a check.
- `review-changes`: when the owner says a change is ready for a PR, or asks for a review.

## Review checks

Reviewers, Doistbot included, apply these to every change:

- [Tests](.agents/checks/tests.md): not weakened, new behaviour tested.
- [Architecture](.agents/checks/architecture.md): rules lint can't express.
- [Security](.agents/checks/security.md): tokens and arguments in logs, errors reaching the model.
- [Privacy and secrets](.agents/checks/privacy.md): this repository is public.
- [Public API](.agents/checks/public-api.md): what the MCP servers and their clients see.
- [Evidence](.agents/checks/evidence.md): claims backed by what ran.

## Build & Run

```bash
npm run build       # compile TypeScript to dist/
npm run dev         # watch mode
npm run type-check  # tsc --noEmit for src/ and the agent tooling (.agents/scripts)
npm run check       # oxlint + oxfmt --check
npm run fix         # oxlint --fix + oxfmt
npm test            # vitest run
npm run verify      # every check CI runs (lint, format, types, build, tests)
```

`npm run verify` is the gate: run it before opening a PR. It includes `npm run check`, which reads the whole tree: the local pre-commit hook only formats _staged_ files, so it can't catch a pre-existing off-format file.

## Git hooks and agent tooling

- Commits and pushes to `main` are refused by the git hooks. Work on a branch.
- When a turn changes code that `npm run verify` has not passed, the end-of-turn hook (Claude Code, Codex, Cursor) sends you back once. Run verify, or stop on purpose and say what is unverified.
- Agent tooling lives in `.agents/scripts/`. It never ships: `package.json#files` lists only `dist`, and a test checks the packed tarball.
- How it all fits together: [`docs/agents.md`](docs/agents.md).

## What belongs here

Code every MCP server needs in the same form, and nothing that names a product. A server's API client, its error formatting, request tagging, instructions and output schemas stay in the server, and reach the core through options and hooks (`createContext`, `formatError`, `wrapExecute`, `onError`). When one server needs different behaviour, add a hook, not a flag naming that server.

The MCP SDK and Zod are peer dependencies, never dependencies. A host such as todoist-ai-integrations unwraps the servers it is handed with `instanceof McpServer`, which fails against a second copy of the SDK; the schema cache reads Zod's Standard Schema internals, which a second copy of Zod would not share. `@modelcontextprotocol/client` and `vitest` are imported only from `./testing` and are not peers at all: a peer of a production dependency is installed in production, so declaring them would put vitest in every server's `npm ci --omit=dev`. `src/package-manifest.test.ts` allows only peers the root entry imports.

## Code style

- **Prefer `type` over `interface`.** Use `type` aliases for every object-shape declaration we own. `interface` is reserved for the rare case where declaration merging is genuinely needed (none today).
- **No emojis in source files.**
- **No comments that restate the code.** Comments earn their place by explaining _why_: non-obvious constraints, invariants, edge cases, or workarounds.
- **No dead exports.** If something isn't reached from `src/index.ts`, `src/testing/index.ts` or a test, delete it.

## Module layout

Each module lives at `src/<area>.ts` with a colocated `<area>.test.ts`. The `./testing` subpath lives in `src/testing/`, with the same colocated-test rule. The public API is every `export` re-exported through `src/index.ts`, plus `src/testing/index.ts` for the `./testing` subpath declared in `package.json#exports`. `src/subpath.test.ts` checks each built entry exports exactly what its source barrel does.

## README maintenance

`README.md` documents the public API. When a commit adds, removes, or meaningfully changes that surface, update the README in the same commit:

- a new module reachable from `src/index.ts` or a subpath barrel
- a new, renamed, or removed export
- a new subpath in `package.json#exports`
- a change to what a tool result looks like on the wire
- a change to peer-dependency ranges, install steps, or the supported Node version

## Releases

Every push to `main` runs semantic-release (`release.yml`), with conventional commits and npm provenance; `next` is the pre-release branch. A release publishes to npm, tags `v<version>` and writes a GitHub release. It commits nothing back to `main`, which requires signed commits, so `package.json` keeps `0.0.0-development` and there is no changelog file. Do not enable broader triggers than `main` and `next`.
