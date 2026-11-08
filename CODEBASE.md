# CODEBASE.md: repo map

> **Purpose:** a short orientation file so agents (and humans) can navigate this repo without
> exploring. Describes _what is where_; `AGENTS.md` describes _how to change things_. Update when
> structure shifts, not on every new file.

## What this project is

`@doist/mcp-core` is a **shared TypeScript library** for the Doist MCP servers
(`@doist/todoist-mcp`, `@doist/comms-mcp`, `@doist/automations-mcp`). It is **not a server**:
it ships the tool contract, a tool registrar with hooks for what differs per product, the
wire shaping of tool results, and contract test suites each server runs over its own tools.

ESM-only · Node ≥ 24 · no runtime dependencies · the MCP SDK and Zod as peers · vitest ·
oxlint + oxfmt · semantic-release.

## Top-level layout

```
/
├─ src/                   # All source. See tree below.
├─ dist/                  # Build output (tsc). Never edit.
├─ .agents/
│  ├─ skills/             # Skills for agents working on this repo (verify, fix-bug,
│  │                      # build-feature, refactor, write-tests, learn, review-changes)
│  ├─ checks/             # Review checks reviewers and Doistbot apply (AGENTS.md links them)
│  └─ scripts/            # Agent tooling (verify, git hook branch guard, review worktree,
│                         # end-of-turn gate) and its tests. Never shipped (not in `files`)
├─ .claude/skills/        # Links to .agents/skills/, where Claude Code finds them
├─ .claude/settings.json  # End-of-turn gate hooks (.codex/hooks.json for Codex)
├─ docs/agents.md         # How the agent tooling fits together
├─ AGENTS.md              # Prescriptive rules (what belongs here, code style, README upkeep)
├─ CODEBASE.md            # This file: descriptive map
├─ CLAUDE.md              # Imports AGENTS.md for Claude Code; nothing else
├─ README.md              # Public API docs and the rules for tools
├─ tsconfig.json          # Includes src + tests (type-check, IDE)
├─ tsconfig.build.json    # Excludes *.test.ts (build/dev)
├─ vitest.config.ts       # { globals, root: 'src', include: ['**/*.test.ts'] }
├─ lefthook.yml           # Git hooks: branch guard; pre-commit lint, format, types; pre-push tests
└─ release.config.js      # semantic-release config
```

## Public API surface (`package.json#exports`)

| Subpath                   | Provides                                                                                              | Peers it needs                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `.` (root)                | The tool types, `createToolRegistrar`, `getToolOutput`, `removeNullFields`, schema cache, annotations | `@modelcontextprotocol/server`, `zod`                                           |
| `@doist/mcp-core/testing` | `describeOutputSchemaNullability`, `describeAdvertisedToolSchemas` and the helpers they use           | the above; also imports `@modelcontextprotocol/client` and `vitest`, undeclared |

## `src/` tree

```
src/
├─ index.ts               # Root barrel (the `.` export)
├─ tool.ts                # McpTool<Params, Output, Context>, AnyMcpTool, ToolResult,
│                         # RequiredToolAnnotations, ToolSchemaSource (types only)
├─ register-tool.ts       # createToolRegistrar: the registration callback and its hooks
├─ tool-output.ts         # getToolOutput (content order, JSON copy, null stripping), getErrorOutput
├─ sanitize.ts            # removeNullFields, with verbatim keys
├─ tool-schemas.ts        # getToolSchemas: Zod shapes to Standard Schemas with a cached JSON form
├─ annotations.ts         # formatToolTitle, getMcpAnnotations (product title, openWorldHint default)
├─ app-meta.ts            # normalizeToolMeta: both forms of the MCP Apps UI resource
├─ subpath.test.ts        # Each package.json export resolves to a build matching its barrel
└─ testing/               # ./testing subpath: suites the servers run over their own tools
   ├─ index.ts            # ./testing barrel
   ├─ nullable-output.ts  # findNullablePaths, describeOutputSchemaNullability
   └─ advertised-schemas.ts # listAdvertisedTools, describeAdvertisedToolSchemas
```

Every module has a colocated `<name>.test.ts`.

## How a tool call flows

`createToolRegistrar(options)` returns `register(server, tool)`. Registering compiles the tool's
schemas once (`getToolSchemas`, cached per tool object across servers), titles it
(`getMcpAnnotations`) and fills in its MCP Apps `_meta` (`normalizeToolMeta`). On a call, after the
SDK has validated the arguments: `createContext(tool, serverContext)` builds what `execute`
receives, `wrapExecute` (if given) runs around it, and `getToolOutput` shapes the result. A throw
goes to `onError` (default: log the tool name and error, never the arguments) and comes back to
the model as `getErrorOutput(formatError(error))`.
