import { McpServer } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createToolRegistrar } from '../register-tool.js'
import type { AnyMcpTool } from '../tool.js'
import { describeTokenFootprint, measureTokenFootprint } from './token-footprint.js'

const hints = { readOnlyHint: true, destructiveHint: false, idempotentHint: true }

const tools: AnyMcpTool[] = [
    {
        name: 'find-tasks',
        description: 'Finds tasks.',
        parameters: { query: z.string() },
        outputSchema: { tasks: z.array(z.object({ id: z.string() })) },
        annotations: hints,
        execute: async () => ({}),
    },
    {
        name: 'ping',
        description: 'Checks the server answers.',
        parameters: {},
        annotations: hints,
        execute: async () => ({ textContent: 'pong' }),
    },
]

const INSTRUCTIONS = 'Use find-tasks before asking the user.'

function createServer(instructions: string | null = INSTRUCTIONS): McpServer {
    const server = new McpServer(
        { name: 'fixture', version: '1.0.0' },
        { instructions: instructions ?? undefined },
    )
    const register = createToolRegistrar({
        titlePrefix: 'Fixture',
        createContext: () => undefined,
        formatError: String,
    })
    for (const tool of tools) register(server, tool)
    return server
}

// One token per character keeps every expected count readable.
function countCharacters(text: string): number {
    return text.length
}

describe('measureTokenFootprint', () => {
    it('measures the tools/list payload as one array, the way a client receives it', async () => {
        const measured: string[] = []
        await measureTokenFootprint(createServer(), (text) => {
            measured.push(text)
            return 1
        })

        const asArray = measured
            .filter((text) => text.startsWith('['))
            .map(
                (text) => JSON.parse(text) as { name: string; annotations?: { title?: string } }[],
            )[0]
        expect(asArray?.map((tool) => [tool.name, tool.annotations?.title])).toEqual([
            ['find-tasks', 'Fixture: Find Tasks'],
            ['ping', 'Fixture: Ping'],
        ])
    })

    it('adds the instructions to the tools/list payload', async () => {
        const footprint = await measureTokenFootprint(createServer(), countCharacters)

        expect(footprint.instructions).toBe(38)
        expect(footprint.combined).toBe(footprint.toolsList + 38)
    })

    it('breaks the cost down per tool, most expensive first', async () => {
        const footprint = await measureTokenFootprint(createServer(), countCharacters)

        expect(footprint.tools.map((tool) => tool.name)).toEqual(['find-tasks', 'ping'])
        expect(footprint.tools[1]).toMatchObject({
            name: 'ping',
            description: 'Checks the server answers.'.length,
            outputSchema: 0,
        })
        expect(footprint.tools[0]?.outputSchema).toBeGreaterThan(0)
    })

    it('counts missing instructions as zero', async () => {
        const footprint = await measureTokenFootprint(createServer(null), countCharacters)

        expect(footprint.instructions).toBe(0)
        expect(footprint.combined).toBe(footprint.toolsList)
    })
})

describeTokenFootprint({ createServer, countTokens: countCharacters, budget: 5_000 })
