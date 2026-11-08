import type { ContentBlock, ToolAnnotations } from '@modelcontextprotocol/server'
import type { z } from 'zod'

/**
 * The three hints every tool must state. The MCP defaults (`readOnlyHint: false`,
 * `destructiveHint: true`, `idempotentHint: false`) describe the riskiest tool possible,
 * so a tool that omits one is either misdescribed or frightens a client for nothing.
 */
export type RequiredToolAnnotations = ToolAnnotations & {
    readOnlyHint: boolean
    destructiveHint: boolean
    idempotentHint: boolean
}

/** What a tool's `execute` returns, before it is shaped into an MCP `CallToolResult`. */
export type ToolResult<Output extends z.ZodRawShape = z.ZodRawShape> = {
    /** Prose for the model, sent as the last content block. */
    textContent?: string
    /** The payload `outputSchema` describes. Nulls and empty objects are stripped before it is sent. */
    structuredContent?: z.infer<z.ZodObject<Output>>
    /** Blocks the tool authors itself, such as images or embedded resources. Sent first. */
    contentItems?: ContentBlock[]
}

export type ExecuteResult<Output extends z.ZodRawShape = z.ZodRawShape> = Promise<
    ToolResult<Output>
>

/**
 * A tool that can be registered on an MCP server or called directly by another
 * conversational AI integration.
 *
 * `Context` is whatever the server hands each call: an API client, or an object carrying
 * one along with an abort signal and a progress reporter.
 */
export type McpTool<
    Params extends z.ZodRawShape,
    Output extends z.ZodRawShape = Record<string, never>,
    Context = unknown,
> = {
    /** Kebab-case. Also the source of the default title ("find-tasks" gives "Find Tasks"). */
    name: string
    /** What the tool does and how to call it. This is what the model reads. */
    description: string
    /** The argument schema as a Zod raw shape, not a `z.object`. */
    parameters: Params
    /**
     * The `structuredContent` schema as a Zod raw shape. Never use `.nullable()`: nulls are
     * stripped before the SDK validates the result, so a nullable field promises a value the
     * tool cannot send. Declare it `.optional()` and leave the key out instead.
     */
    outputSchema?: Output
    annotations: RequiredToolAnnotations
    /** Sent with the tool listing, e.g. the MCP Apps `ui` resource. */
    _meta?: Record<string, unknown>
    execute: (args: z.infer<z.ZodObject<Params>>, context: Context) => ExecuteResult<Output>
}

/**
 * A tool of any parameter and output shape.
 *
 * `McpTool` is generic over its schemas, and `execute` is contravariant in its argument, so no
 * single instantiation of it accepts every tool. Declaring the argument as `never` does: `never`
 * is assignable to any parameter type, so a tool taking concrete args satisfies this while a
 * caller cannot invoke `execute` without narrowing back to the real tool type first.
 *
 * Use it for collections that hold tools of mixed shapes. Each tool keeps its precise type
 * through its own `satisfies McpTool<...>`.
 */
export type AnyMcpTool<Context = unknown> = Omit<
    McpTool<z.ZodRawShape, z.ZodRawShape, Context>,
    'execute'
> & {
    execute: (args: never, context: Context) => ExecuteResult<z.ZodRawShape>
}

/** The parts of a tool its schemas come from. Wide enough for tools not built on `McpTool`. */
export type ToolSchemaSource = {
    name: string
    parameters: z.ZodRawShape
    outputSchema?: z.ZodRawShape
}
