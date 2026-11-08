import type {
    CallToolResult,
    McpServer,
    ServerContext,
    ToolCallback,
} from '@modelcontextprotocol/server'
import type { z } from 'zod'
import { getMcpAnnotations } from './annotations.js'
import { normalizeToolMeta } from './app-meta.js'
import { getErrorOutput, getToolOutput, type ToolOutputOptions } from './tool-output.js'
import { getToolSchemas } from './tool-schemas.js'
import type { AnyMcpTool, ExecuteResult } from './tool.js'

/** A tool call that threw. */
export type ToolFailure<Context> = {
    tool: AnyMcpTool<Context>
    /** As the SDK validated them. Write tools carry user content here, so log with care. */
    args: Record<string, unknown>
    error: unknown
}

export type ToolRegistrarOptions<Context> = ToolOutputOptions & {
    /** Names the product in every tool title: "Todoist" gives "Todoist: Find Tasks". */
    titlePrefix: string
    /** Builds what `execute` receives. Called on every run, so on every retry `wrapExecute` makes. */
    createContext: (tool: AnyMcpTool<Context>, serverContext: ServerContext) => Context
    /** Turns whatever a tool threw into text the model can act on. */
    formatError: (error: unknown) => string
    /**
     * Runs around every `execute`, for retries, request tagging or rewriting the result. `run`
     * calls the tool; return its result, or a changed copy of it.
     */
    wrapExecute?: (
        tool: AnyMcpTool<Context>,
        run: () => ExecuteResult<z.ZodRawShape>,
    ) => ExecuteResult<z.ZodRawShape>
    /**
     * Called when a tool throws, before the error is returned to the model. The default logs the
     * tool name and the error, never the arguments.
     */
    onError?: (failure: ToolFailure<Context>) => void
}

/** Registers one tool on one server. */
export type RegisterTool<Context> = (server: McpServer, tool: AnyMcpTool<Context>) => void

function logToolFailure({ tool, error }: { tool: { name: string }; error: unknown }): void {
    console.error(`Error executing tool ${tool.name}:`, error)
}

/**
 * Returns a function that registers tools on an MCP server with the shared behaviour: cached
 * JSON schemas, annotations with a product title, MCP Apps `_meta` filled in for both kinds of
 * host, results shaped by `getToolOutput`, and a thrown error returned to the model as an
 * `isError` result instead of failing the request.
 *
 * Build one per server when the context depends on the server's credentials.
 */
export function createToolRegistrar<Context>({
    titlePrefix,
    createContext,
    formatError,
    wrapExecute,
    onError = logToolFailure,
    ...outputOptions
}: ToolRegistrarOptions<Context>): RegisterTool<Context> {
    return (server, tool) => {
        // `AnyMcpTool` declares `args` as `never` so that tools of every parameter shape can be
        // held in one collection. Widening it back is safe here and only here: the SDK has
        // already validated `args` against this tool's own `inputSchema` before invoking the
        // callback.
        const execute = tool.execute as (
            args: Record<string, unknown>,
            context: Context,
        ) => ExecuteResult<z.ZodRawShape>

        const { input: inputSchema, output: outputSchema } = getToolSchemas(tool)

        const callback: ToolCallback<typeof inputSchema> = async (
            args,
            serverContext,
        ): Promise<CallToolResult> => {
            try {
                const run = () => execute(args, createContext(tool, serverContext))
                const result = await (wrapExecute ? wrapExecute(tool, run) : run())
                return getToolOutput(result, outputOptions)
            } catch (error) {
                onError({ tool, args, error })
                return getErrorOutput(formatError(error))
            }
        }

        server.registerTool(
            tool.name,
            {
                description: tool.description,
                inputSchema,
                ...(outputSchema ? { outputSchema } : {}),
                annotations: getMcpAnnotations(tool, titlePrefix),
                ...(tool._meta ? { _meta: normalizeToolMeta(tool._meta) } : {}),
            },
            callback,
        )
    }
}
