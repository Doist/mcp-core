import type { ToolAnnotations } from '@modelcontextprotocol/server'

/** "find-tasks" gives "Find Tasks". Hyphens and underscores both separate words. */
export function formatToolTitle(toolName: string): string {
    return toolName
        .split(/[-_]+/)
        .filter(Boolean)
        .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
        .join(' ')
}

/**
 * The annotations a tool is registered with: a title naming the product, `openWorldHint: false`,
 * and then the tool's own hints, which override both.
 *
 * `openWorldHint` defaults to false because most tools stay inside the user's own account. A tool
 * that notifies another person or produces a public URL must set it to true itself.
 */
export function getMcpAnnotations(
    tool: { name: string; annotations: ToolAnnotations },
    titlePrefix: string,
): ToolAnnotations {
    return {
        title: `${titlePrefix}: ${formatToolTitle(tool.name)}`,
        openWorldHint: false,
        ...tool.annotations,
    }
}
