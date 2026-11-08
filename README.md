# @doist/mcp-core

Shared core for Doist's MCP servers ([todoist-mcp](https://github.com/Doist/todoist-mcp), [comms-mcp](https://github.com/Doist/comms-mcp) and the Automations MCP server): the tool contract, tool registration, how a tool result is shaped for the wire, the contract a server offers the host that serves it, and the contract test suites every server runs over its own tools.

TypeScript, ESM-only, Node ≥ 24, npm ≥ 11.

## Install

```bash
npm install @doist/mcp-core
```

The MCP SDK and Zod are peer dependencies, so the server and the core share one copy of each. That matters: a host that serves several MCP servers unwraps them with `instanceof McpServer`, which fails against a second copy of the SDK.

| Peer                           | Range    |
| ------------------------------ | -------- |
| `@modelcontextprotocol/server` | `^2.2.0` |
| `zod`                          | `^4.3.0` |

`./testing` also imports `vitest` (4.1 or later) and `@modelcontextprotocol/client` (2.2 or later), from the server's own devDependencies. They are deliberately not peers: npm installs a peer of a production dependency in production, so declaring them would put vitest in every server's `npm ci --omit=dev`.

## What's in it

| Module              | Key exports                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `tool`              | `McpTool`, `AnyMcpTool`, `ToolResult`, `ExecuteResult`, `RequiredToolAnnotations`, `ToolSchemaSource` (types)  |
| `register-tool`     | `createToolRegistrar`, `ToolRegistrarOptions`, `RegisterTool`, `ToolFailure`                                   |
| `tool-output`       | `getToolOutput`, `getErrorOutput`, `ToolOutputOptions`                                                         |
| `sanitize`          | `removeNullFields`, `RemoveNullFieldsOptions`                                                                  |
| `tool-schemas`      | `getToolSchemas`, `ToolSchemas`                                                                                |
| `annotations`       | `getMcpAnnotations`, `formatToolTitle`                                                                         |
| `app-meta`          | `normalizeToolMeta`                                                                                            |
| `host` (subpath)    | `validateBearerToken`, `TokenValidationError`, `TokenValidationResult`, `ValidateToken`, `McpServerOptions`    |
| `testing` (subpath) | `describeOutputSchemaNullability`, `describeAdvertisedToolSchemas`, `findNullablePaths`, `listAdvertisedTools` |

## Usage

### Defining a tool

`McpTool<Params, Output, Context>` is generic over what each call receives, so each server picks its own context: an API client, or an object carrying one with an abort signal and a progress reporter. A server usually aliases it with its context filled in.

```ts
import type { McpTool } from '@doist/mcp-core'
import { z } from 'zod'
import type { NotesApi } from './notes-api.js'

type NotesTool<P extends z.ZodRawShape, O extends z.ZodRawShape = Record<string, never>> = McpTool<
    P,
    O,
    NotesApi
>

export const findNotes = {
    name: 'find-notes',
    description: 'Finds notes whose text contains the search term.',
    parameters: { searchText: z.string().describe('Text to look for.') },
    outputSchema: { notes: z.array(z.object({ id: z.string(), text: z.string() })) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async execute({ searchText }, api) {
        const notes = await api.search(searchText)
        return { textContent: `Found ${notes.length} notes.`, structuredContent: { notes } }
    },
} satisfies NotesTool<
    { searchText: z.ZodString },
    { notes: z.ZodArray<z.ZodObject<{ id: z.ZodString; text: z.ZodString }>> }
>
```

### Registering tools

`createToolRegistrar` returns a function that registers tools on a server. Everything that differs between products comes in through its options:

```ts
import { createToolRegistrar } from '@doist/mcp-core'
import { McpServer } from '@modelcontextprotocol/server'

export function getMcpServer({ token }: { token: string }): McpServer {
    const server = new McpServer({ name: 'notes-mcp-server', version: '1.0.0' })
    const api = new NotesApi(token)

    const register = createToolRegistrar<NotesApi>({
        titlePrefix: 'Notes',
        createContext: () => api,
        formatError: (error) => (error instanceof Error ? error.message : 'Something went wrong.'),
        // Optional: runs around every call, for retries, request tagging or rewriting the result.
        wrapExecute: (tool, run) => withRetry(run),
        // Optional: replaces the default log line, which never includes the arguments.
        onError: ({ tool, error }) => logger.error({ tool: tool.name, error }),
    })
    for (const tool of [findNotes]) register(server, tool)

    return server
}
```

For each tool this:

- compiles its input and output schemas to JSON Schema 2020-12 once per process, however many servers register it;
- titles it "`<titlePrefix>`: `<Title Case Name>`" and defaults `openWorldHint` to false, with the tool's own annotations winning;
- fills in both forms of an MCP Apps UI resource (`_meta.ui.resourceUri` and `_meta['ui/resourceUri']`) when the tool sets one;
- shapes every result with `getToolOutput`, below;
- catches anything `execute` throws, passes it to `onError`, and returns `formatError`'s text to the model as an `isError` result.

`createContext` receives the tool and the SDK's `ServerContext`, so a long-running tool can read `serverContext.mcpReq.signal` or send progress notifications.

### The wire shape of a result

`getToolOutput` turns a `ToolResult` into a `CallToolResult`:

1. Nulls and empty objects are stripped from `structuredContent` (`removeNullFields`). Empty arrays stay. Pass `verbatimKeys` for keys whose nulls mean something, such as a stored JSON Schema.
2. `content` is, in order: the tool's own `contentItems`, then `structuredContent` as a JSON text block, then `textContent`. A client that reads only a text `content[0]` (the OpenAI Responses API drops `structuredContent`) still gets the payload.
3. `structuredContentAsText: false` leaves the JSON block out, for deployments whose clients all read `structuredContent`.

### Serving a server from a host

`@doist/mcp-core/host` is the contract between a server package and a host that serves several of them, such as todoist-ai-integrations. Every server exports the same two shapes:

- `getMcpServer(options)`, taking `McpServerOptions` (`{ token, baseUrl? }`), or `McpServerOptions & { ... }` when it needs more;
- a `ValidateToken`: `(token, baseUrl?) => Promise<'valid' | 'invalid' | 'forbidden'>`.

A validator resolves only with a verdict on the token and rejects for anything else, so the host can retry a failure without caching it as a verdict. `validateBearerToken` builds one from a status-only `GET`:

```ts
import { validateBearerToken, type ValidateToken } from '@doist/mcp-core/host'

export const validateNotesToken: ValidateToken = (token, baseUrl = 'https://notes.example.com') =>
    validateBearerToken({ url: `${baseUrl}/api/v1/me`, token })
```

| The API answers                 | `validateBearerToken`                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| 2xx                             | `valid`                                                                                      |
| 401                             | `invalid`: the host sends a 401 challenge, and the client refreshes its token                |
| 403                             | `forbidden`, or whatever `classifyForbidden(response)` returns                               |
| any other status                | throws `TokenValidationError`, whose `httpStatusCode` lets the host treat a 5xx as transient |
| nothing within `timeoutMs` (5s) | rejects with the `TimeoutError`                                                              |
| a network failure               | rejects with the error unchanged                                                             |

The body is never read, so a change to the response's shape can't misclassify a token. Pass `classifyForbidden` when a 403 can also mean a refusal that consent can't lift, and `headers` to tag the request.

### Contract tests

`@doist/mcp-core/testing` holds suites a server runs over its own tool registry:

```ts
import {
    describeAdvertisedToolSchemas,
    describeOutputSchemaNullability,
} from '@doist/mcp-core/testing'
import { getMcpServer } from './mcp-server.js'
import { registeredTools } from './tool-registry.js'

describeOutputSchemaNullability(registeredTools)
describeAdvertisedToolSchemas({
    tools: registeredTools,
    createServer: () => getMcpServer({ token: 'test-token' }),
})
```

- `describeOutputSchemaNullability`: one test per tool, failing on any output field that admits `null`.
- `describeAdvertisedToolSchemas`: the server advertises exactly these tools, each with JSON Schema 2020-12 schemas matching a direct Zod conversion.

Both take any `{ name, parameters, outputSchema? }`, so a server can run them before its tools move to `McpTool`.

## Rules for tools

These hold for every Doist MCP server. Where the core can enforce one, it says how.

- **Output schemas never use `.nullable()`.** Results are stripped of nulls before the SDK validates them, so a nullable field promises a value the tool can never send, and the call fails with "Output validation error" once it is stripped. Declare the field `.optional()` and leave the key out (`foo: value ?? undefined`). `describeOutputSchemaNullability` enforces this.
- **Annotations describe the tool's worst case.** They are per tool, not per action, so a tool that groups several operations is annotated for the riskiest one. `readOnlyHint: true` only when nothing is persisted and nothing user-visible happens (a file or a shareable link counts). `openWorldHint: true` when the tool reaches anyone outside the user's own account: notifying another person, or producing a public URL. `destructiveHint: true` when it deletes, overwrites, replaces prior state, removes access or is otherwise hard to undo; sending a notification is additive, not destructive. `RequiredToolAnnotations` makes the three hints mandatory.
- **Describe an output field only where the schema can't.** Output schemas are sent on every `tools/list`, and shared ones are inlined once per tool. Describe units and formats, conventions, unions, conditional presence and non-obvious meaning; leave off anything that restates the field name or lists enum values. Input descriptions are how a model learns to call the tool, and should be as full as they need to be.
- **Clear an optional field with a string, not `null`.** Some providers, Gemini in particular, handle a nullable input badly. Use a descriptive sentinel (`"unassign"`, `"remove"`) and document it in the field's description.
- **Batch write tools report per-item failures, never throw.** Settle each item on its own and return the ones that failed alongside the ones that succeeded, even when every item fails. A thrown error hides what was written, so a retry writes it twice.
- **Never log tool arguments by default.** Write tools carry user content in them. The default `onError` logs the tool name and the error only.

## Licence

MIT
