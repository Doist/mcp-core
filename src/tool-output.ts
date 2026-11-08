import type { CallToolResult, ContentBlock } from '@modelcontextprotocol/server'
import { removeNullFields, type RemoveNullFieldsOptions } from './sanitize.js'
import type { ToolResult } from './tool.js'

export type ToolOutputOptions = RemoveNullFieldsOptions & {
    /**
     * Also send `structuredContent` as a JSON text block, for clients that ignore
     * `structuredContent`. Defaults to true.
     */
    structuredContentAsText?: boolean
}

/**
 * Shapes a tool's result into an MCP `CallToolResult`.
 *
 * Content order is fixed: the tool's own content items, then the structured payload as JSON text,
 * then the prose summary. A client that surfaces only a text `content[0]` (the OpenAI Responses
 * API drops `structuredContent`) then gets the payload rather than the summary.
 */
export function getToolOutput(
    { textContent, structuredContent, contentItems }: ToolResult,
    { structuredContentAsText = true, ...sanitizeOptions }: ToolOutputOptions = {},
): CallToolResult {
    const sanitized = structuredContent
        ? removeNullFields(structuredContent, sanitizeOptions)
        : undefined

    const content: ContentBlock[] = [...(contentItems ?? [])]
    if (structuredContentAsText && sanitized !== undefined) {
        content.push({ type: 'text', text: JSON.stringify(sanitized) })
    }
    if (textContent) {
        content.push({ type: 'text', text: textContent })
    }

    return {
        content,
        ...(sanitized === undefined ? {} : { structuredContent: sanitized }),
    }
}

/** A tool error the model can read and act on. */
export function getErrorOutput(message: string): CallToolResult {
    return {
        content: [{ type: 'text', text: message }],
        isError: true,
    }
}
