# Check: architecture

Rules lint and types can't express. Most are written in `AGENTS.md` and `CODEBASE.md`; report where a change works around one.

## Report

- An export not reached from its barrel (`src/index.ts` or `src/testing/index.ts`), a new subpath without its `package.json#exports` entry (`types` and `import`), or a dead export: one nothing re-exports or tests.
- A public export added, renamed, removed or meaningfully changed without the `README.md` update in the same change ("README maintenance" in `AGENTS.md`).
- Any runtime dependency (there are none), or the MCP SDK or Zod moved from `peerDependencies` to `dependencies`. A second copy of the SDK breaks the hosts' `instanceof McpServer` check, and a second copy of Zod breaks the schema cache.
- `@modelcontextprotocol/client` or `vitest` imported from the root entry, or declared in `peerDependencies`. Only `./testing` imports them, from the server's devDependencies.
- Behaviour that belongs to one product: its API client, error tags, usage-tracking headers, instructions or output schemas. The core takes these as options or hooks (`createContext`, `formatError`, `wrapExecute`, `onError`); it never imports a product SDK.
- A per-product flag where a hook would do, such as `stripEmails: true` instead of doing it in `wrapExecute`.
- `interface` for an object shape we own, where a `type` alias would do.
- A helper that duplicates one elsewhere in `src/`.

## Fine

- An exception documented next to the code, with the reason.
- A new module or subpath added to `CODEBASE.md` in the same change.
