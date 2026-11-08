import { McpServer } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createToolRegistrar } from '../register-tool.js'
import type { AnyMcpTool } from '../tool.js'
import { describeAdvertisedToolSchemas, listAdvertisedTools } from './advertised-schemas.js'

const hints = { readOnlyHint: true, destructiveHint: false, idempotentHint: true }

const tools: AnyMcpTool[] = [
    {
        name: 'find-tasks',
        description: 'Finds tasks.',
        parameters: { query: z.string(), limit: z.number().default(10) },
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

function createServer(registered: readonly AnyMcpTool[] = tools): McpServer {
    const server = new McpServer({ name: 'fixture', version: '1.0.0' })
    const register = createToolRegistrar({
        titlePrefix: 'Fixture',
        createContext: () => undefined,
        formatError: String,
    })
    for (const tool of registered) register(server, tool)
    return server
}

describe('listAdvertisedTools', () => {
    it('lists what the server registered', async () => {
        const listed = await listAdvertisedTools(createServer())

        expect(listed.map((tool) => [tool.name, tool.description])).toEqual([
            ['find-tasks', 'Finds tasks.'],
            ['ping', 'Checks the server answers.'],
        ])
        expect(listed[0]?.inputSchema).toEqual({
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            type: 'object',
            properties: {
                query: { type: 'string' },
                limit: { type: 'number', default: 10 },
            },
            required: ['query'],
        })
    })

    it('lists nothing for a server with no tools', async () => {
        expect(await listAdvertisedTools(createServer([]))).toEqual([])
    })
})

describeAdvertisedToolSchemas({ tools, createServer })
