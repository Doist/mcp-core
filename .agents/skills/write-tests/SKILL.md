---
name: write-tests
description: Writes or changes tests in this repository to its quality bar, with the right helpers and layer. Use when adding, fixing or reviewing tests, when a change "needs a test", or when deciding whether a test may change.
---

# Write tests

## Where tests live

- Next to the code: `src/sanitize.ts` → `src/sanitize.test.ts`, `src/testing/nullable-output.ts` → `src/testing/nullable-output.test.ts`. Vitest, globals on, `restoreMocks: true` (spies restore themselves), `TZ=UTC`.
- Tests import the module under test directly, not through `src/index.ts` or a subpath barrel. The barrels are checked by the type check, and the built entries by `src/subpath.test.ts`.
- Registration is tested end to end: register the tool on a real `McpServer`, connect a `Client` over `InMemoryTransport`, and call `listTools` or `callTool` (see `src/register-tool.test.ts`). Assert what the client receives, not what was passed to a stubbed `registerTool`.
- A `./testing` suite is tested twice: its helper directly, with inputs that should and should not be reported, and the suite itself run over fixture tools (see `src/testing/advertised-schemas.test.ts`).
- Agent tooling tests live in `.agents/scripts/` and run copies of the tools in throwaway repos (`.agents/scripts/lib/test-repo.ts`).

## Helpers

From `src/testing/` (the public `./testing` subpath, which the MCP servers use too): `listAdvertisedTools`, `findNullablePaths`, `describeOutputSchemaNullability`, `describeAdvertisedToolSchemas`. A change to one changes the servers' tests too.

## The quality bar

Read [references/test-rules.md](references/test-rules.md) before writing or reviewing a test. In short: a test counts only if it can fail. It asserts outcomes, takes expected values from outside the code under test, mocks only real boundaries, and you saw it fail once.

Done when each new test has failed once for the right reason, and then passes.

## When an existing test may change

- **The behaviour changed on purpose** (a feature or a fix): change the assertions that describe it, and say which in the report.
- **A refactor:** only how the test reaches the code (imports, names, call sites). Never its inputs or assertions, including expected output strings.
- **Never** to make a failing check pass without a behaviour change: no `.skip`, no deleted test, no looser matcher (`toEqual` → `toMatchObject`, exact arguments → `toHaveBeenCalled()`).
