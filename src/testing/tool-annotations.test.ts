import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { createToolRegistrar } from '../register-tool.js'
import type { AnyMcpTool } from '../tool.js'
import { describeToolAnnotations } from './tool-annotations.js'

const tools: AnyMcpTool[] = [
    {
        name: 'find-tasks',
        description: 'Finds tasks.',
        parameters: { query: z.string() },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
        execute: async () => ({}),
    },
    {
        name: 'share-project',
        description: 'Shares a project with someone.',
        parameters: { email: z.email() },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
        execute: async () => ({}),
    },
]

function createServer(): McpServer {
    const server = new McpServer({ name: 'fixture', version: '1.0.0' })
    const register = createToolRegistrar({
        titlePrefix: 'Fixture',
        createContext: () => undefined,
        formatError: String,
    })
    for (const tool of tools) register(server, tool)
    return server
}

describeToolAnnotations({
    createServer,
    expected: {
        'find-tasks': {
            title: 'Fixture: Find Tasks',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
        },
        'share-project': {
            title: 'Fixture: Share Project',
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
    },
})
