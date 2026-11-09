import type { McpServer } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'
import { readAdvertisedSurface } from './advertised-schemas.js'

/** Counts tokens the way the model a server targets would. */
export type CountTokens = (text: string) => number

/** What one advertised tool costs, as listed on `tools/list`. */
export type ToolTokenCost = {
    name: string
    /** The whole tool entry: name, title, description, schemas, annotations, `_meta`. */
    total: number
    description: number
    inputSchema: number
    outputSchema: number
}

/** The fixed cost every session pays before a tool runs. */
export type TokenFootprint = {
    /** Per tool, most expensive first. A breakdown: these don't add up to `toolsList` exactly. */
    tools: ToolTokenCost[]
    /** The `tools/list` payload, measured as the one array a client receives. */
    toolsList: number
    /** The `instructions` block, or 0 when the server sends none. */
    instructions: number
    combined: number
}

/**
 * Measures the fixed token cost of a server from what it advertises to a client, so nothing
 * here restates how registration titles a tool or compiles its schemas. Closes the server.
 */
export async function measureTokenFootprint(
    server: McpServer,
    countTokens: CountTokens,
): Promise<TokenFootprint> {
    const { tools, instructions } = await readAdvertisedSurface(server)

    const costs = tools
        .map((tool) => ({
            name: tool.name,
            total: countTokens(JSON.stringify(tool)),
            description: countTokens(tool.description ?? ''),
            inputSchema: countTokens(JSON.stringify(tool.inputSchema)),
            outputSchema: tool.outputSchema ? countTokens(JSON.stringify(tool.outputSchema)) : 0,
        }))
        .sort((a, b) => b.total - a.total)
    const toolsList = countTokens(JSON.stringify(tools))
    const instructionsCost = instructions ? countTokens(instructions) : 0

    return {
        tools: costs,
        toolsList,
        instructions: instructionsCost,
        combined: toolsList + instructionsCost,
    }
}

function formatFootprint(footprint: TokenFootprint, budget: number): string {
    return [
        '',
        '=== MCP token footprint ===',
        `tools advertised:    ${footprint.tools.length}`,
        `instructions:        ${footprint.instructions} tokens`,
        `tools/list payload:  ${footprint.toolsList} tokens`,
        `combined fixed cost: ${footprint.combined} tokens`,
        `budget:              ${budget} tokens`,
        '',
        'Per tool (total / description / inputSchema / outputSchema):',
        ...footprint.tools.map(
            (tool) =>
                `  ${String(tool.total).padStart(5)}  ${String(tool.description).padStart(4)}  ${String(tool.inputSchema).padStart(5)}  ${String(tool.outputSchema).padStart(5)}   ${tool.name}`,
        ),
    ].join('\n')
}

export type TokenFootprintConfig = {
    /** Builds a fresh server with every tool registered. */
    createServer: () => McpServer
    /** The tokenizer, such as `(text) => encode(text).length` from `gpt-tokenizer`. */
    countTokens: CountTokens
    /**
     * What the fixed cost must stay under. Treat it as a ratchet rather than headroom: a rise
     * needs justifying in the change that causes it.
     */
    budget: number
}

/**
 * Tests that the `tools/list` payload plus the `instructions` block stay under `budget`, and
 * prints the cost per tool so a reviewer can see where it went. Fails as well if either half
 * goes missing: a lost block would otherwise read as a saving.
 */
export function describeTokenFootprint({
    createServer,
    countTokens,
    budget,
}: TokenFootprintConfig): void {
    describe('token footprint', () => {
        it('keeps the tools/list payload and instructions within the budget', async () => {
            const footprint = await measureTokenFootprint(createServer(), countTokens)

            expect(footprint.tools.length, 'tools advertised').toBeGreaterThan(0)
            expect(footprint.instructions, 'instructions advertised').toBeGreaterThan(0)
            console.log(formatFootprint(footprint, budget))
            expect(footprint.combined).toBeLessThan(budget)
        })
    })
}
