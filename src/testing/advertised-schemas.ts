import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import type { McpServer, Tool } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ToolSchemaSource } from '../tool.js'

const JSON_SCHEMA_2020_12 = 'https://json-schema.org/draft/2020-12/schema'

/**
 * What a client sees of a server before it calls anything: the `tools/list` payload and the
 * `instructions` block, read through an in-memory client. Closes the server afterwards.
 */
export async function readAdvertisedSurface(
    server: McpServer,
): Promise<{ tools: Tool[]; instructions: string | undefined }> {
    const client = new Client({ name: 'mcp-core-testing', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    try {
        const { tools } = await client.listTools()
        return { tools, instructions: client.getInstructions() }
    } finally {
        await client.close()
        await server.close()
    }
}

/** The tools a server advertises on `tools/list`, read through an in-memory client. */
export async function listAdvertisedTools(server: McpServer): Promise<Tool[]> {
    return (await readAdvertisedSurface(server)).tools
}

export type AdvertisedSchemasConfig = {
    /** Every tool the server should register. */
    tools: readonly ToolSchemaSource[]
    /** Builds a fresh server with those tools registered. Called once per test. */
    createServer: () => McpServer
}

/**
 * Tests that a server advertises exactly `tools`, each with JSON Schema 2020-12 schemas that
 * match a direct Zod conversion of the tool's own shapes. A tool registered twice, left out,
 * or advertised with a schema the cache altered fails here.
 */
export function describeAdvertisedToolSchemas({
    tools,
    createServer,
}: AdvertisedSchemasConfig): void {
    describe('advertised tool schemas', () => {
        it('advertises every tool exactly once', async () => {
            const advertised = await listAdvertisedTools(createServer())

            expect(advertised.map((tool) => tool.name).sort()).toEqual(
                tools.map((tool) => tool.name).sort(),
            )
        })

        it('uses JSON Schema 2020-12 for every tool schema', async () => {
            const advertised = await listAdvertisedTools(createServer())

            for (const tool of advertised) {
                expect(tool.inputSchema.$schema, tool.name).toBe(JSON_SCHEMA_2020_12)
                if (tool.outputSchema) {
                    expect(tool.outputSchema.$schema, tool.name).toBe(JSON_SCHEMA_2020_12)
                }
            }
        })

        it('matches a direct Zod conversion for every tool', async () => {
            const advertised = new Map(
                (await listAdvertisedTools(createServer())).map((tool) => [tool.name, tool]),
            )

            for (const tool of tools) {
                const listed = advertised.get(tool.name)
                expect(listed, `missing advertised tool ${tool.name}`).toBeDefined()
                expect(listed?.inputSchema, tool.name).toEqual(
                    z.toJSONSchema(z.object(tool.parameters), {
                        target: 'draft-2020-12',
                        io: 'input',
                    }),
                )

                if (tool.outputSchema) {
                    expect(listed?.outputSchema, tool.name).toEqual(
                        z.toJSONSchema(z.object(tool.outputSchema), {
                            target: 'draft-2020-12',
                            io: 'output',
                        }),
                    )
                } else {
                    expect(listed?.outputSchema, tool.name).toBeUndefined()
                }
            }
        })
    })
}
