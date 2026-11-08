import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { McpServer, type ServerContext } from '@modelcontextprotocol/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createToolRegistrar, type ToolRegistrarOptions } from './register-tool.js'
import type { AnyMcpTool, McpTool } from './tool.js'

type Notes = { save: (text: string) => Promise<string> }

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true }

const addNote = {
    name: 'add-note',
    description: 'Adds a note.',
    parameters: { text: z.string(), pinned: z.boolean().default(false) },
    outputSchema: { id: z.string(), pinned: z.boolean(), tag: z.string().optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async execute({ text, pinned }, notes) {
        const id = await notes.save(text)
        return {
            textContent: `Added note ${id}.`,
            structuredContent: { id, pinned, tag: null as unknown as undefined },
        }
    },
} satisfies McpTool<
    { text: z.ZodString; pinned: z.ZodDefault<z.ZodBoolean> },
    { id: z.ZodString; pinned: z.ZodBoolean; tag: z.ZodOptional<z.ZodString> },
    Notes
>

const openPanel = {
    name: 'open_panel',
    description: 'Opens the panel.',
    parameters: {},
    annotations: readOnly,
    _meta: { ui: { resourceUri: 'ui://panel/app.html' } },
    async execute() {
        return { textContent: 'Opened.' }
    },
} satisfies McpTool<Record<string, never>, Record<string, never>, Notes>

const clients: Client[] = []

afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()))
})

async function connect(
    tools: AnyMcpTool<Notes>[],
    options: Partial<ToolRegistrarOptions<Notes>> = {},
): Promise<Client> {
    const server = new McpServer({ name: 'notes', version: '1.0.0' })
    const register = createToolRegistrar<Notes>({
        titlePrefix: 'Notes',
        createContext: () => ({ save: async () => 'n1' }),
        formatError: (error) => `Failed: ${error instanceof Error ? error.message : 'unknown'}`,
        ...options,
    })
    for (const tool of tools) register(server, tool)

    const client = new Client({ name: 'test', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    clients.push(client)
    return client
}

describe('createToolRegistrar listing', () => {
    it('advertises description, product title, hints and both forms of the UI resource', async () => {
        const client = await connect([openPanel])

        const [tool] = (await client.listTools()).tools

        expect(tool?.name).toBe('open_panel')
        expect(tool?.description).toBe('Opens the panel.')
        expect(tool?.annotations).toEqual({
            title: 'Notes: Open Panel',
            openWorldHint: false,
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
        })
        expect(tool?._meta).toEqual({
            ui: { resourceUri: 'ui://panel/app.html' },
            'ui/resourceUri': 'ui://panel/app.html',
        })
        expect(tool?.outputSchema).toBeUndefined()
    })

    it('advertises the output schema of a tool that declares one', async () => {
        const client = await connect([addNote])

        const [tool] = (await client.listTools()).tools

        expect(tool?.outputSchema).toMatchObject({
            type: 'object',
            properties: { id: { type: 'string' }, pinned: { type: 'boolean' } },
            required: ['id', 'pinned'],
        })
    })
})

describe('createToolRegistrar calls', () => {
    it("hands execute the validated arguments and createContext's value, and shapes the result", async () => {
        const save = vi.fn(async (_text: string) => 'n42')
        const createContext = vi.fn((_tool: AnyMcpTool<Notes>, _ctx: ServerContext) => ({ save }))
        const client = await connect([addNote], { createContext })

        const result = await client.callTool({ name: 'add-note', arguments: { text: 'Milk' } })

        expect(save).toHaveBeenCalledWith('Milk')
        expect(createContext).toHaveBeenCalledTimes(1)
        expect(createContext.mock.calls[0]?.[0]).toBe(addNote)
        expect(createContext.mock.calls[0]?.[1].mcpReq.signal).toBeInstanceOf(AbortSignal)
        expect(result).toEqual({
            content: [
                { type: 'text', text: '{"id":"n42","pinned":false}' },
                { type: 'text', text: 'Added note n42.' },
            ],
            structuredContent: { id: 'n42', pinned: false },
        })
    })

    it('runs every call through wrapExecute, which can retry and rewrite the result', async () => {
        const save = vi
            .fn<(text: string) => Promise<string>>()
            .mockRejectedValueOnce(new Error('503'))
            .mockResolvedValueOnce('n7')
        const client = await connect([addNote], {
            createContext: () => ({ save }),
            wrapExecute: async (tool, run) => {
                const result = await run().catch(() => run())
                return { ...result, textContent: `[${tool.name}] ${result.textContent}` }
            },
        })

        const result = await client.callTool({ name: 'add-note', arguments: { text: 'Eggs' } })

        expect(save).toHaveBeenCalledTimes(2)
        expect(result.content).toEqual([
            { type: 'text', text: '{"id":"n7","pinned":false}' },
            { type: 'text', text: '[add-note] Added note n7.' },
        ])
    })

    it('passes the output options through', async () => {
        const client = await connect([addNote], { structuredContentAsText: false })

        const result = await client.callTool({ name: 'add-note', arguments: { text: 'Tea' } })

        expect(result.content).toEqual([{ type: 'text', text: 'Added note n1.' }])
    })
})

describe('createToolRegistrar errors', () => {
    const failure = new Error('quota reached')
    const failing = () => ({ save: () => Promise.reject(failure) })

    it('returns formatError text as an error result, and by default logs no arguments', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const client = await connect([addNote], { createContext: failing })

        const result = await client.callTool({
            name: 'add-note',
            arguments: { text: 'Private plans' },
        })

        expect(result).toEqual({
            content: [{ type: 'text', text: 'Failed: quota reached' }],
            isError: true,
        })
        expect(consoleError).toHaveBeenCalledWith('Error executing tool add-note:', failure)
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain('Private plans')
    })

    it('hands onError the tool, the validated arguments and the error instead', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const onError = vi.fn()
        const client = await connect([addNote], { createContext: failing, onError })

        await client.callTool({ name: 'add-note', arguments: { text: 'Bread' } })

        expect(onError).toHaveBeenCalledWith({
            tool: addNote,
            args: { text: 'Bread', pinned: false },
            error: failure,
        })
        expect(consoleError).not.toHaveBeenCalled()
    })
})
