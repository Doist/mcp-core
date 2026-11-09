import type { McpServer, Tool } from '@modelcontextprotocol/server'
import { beforeAll, describe, expect, it } from 'vitest'
import type { RequiredToolAnnotations } from '../tool.js'
import { listAdvertisedTools } from './advertised-schemas.js'

/**
 * The annotations one tool should advertise: its own hints, as the tool declares them, plus the
 * full advertised `title`, prefix included (`'Todoist: Add Tasks'`). `openWorldHint` defaults to
 * false, as registration does.
 */
export type ExpectedToolAnnotations = RequiredToolAnnotations & { title: string }

export type ToolAnnotationsConfig = {
    /** Builds a fresh server with every tool registered. */
    createServer: () => McpServer
    /** Every tool the server should advertise, by name. */
    expected: Readonly<Record<string, ExpectedToolAnnotations>>
}

/**
 * Pins every tool's annotations as a client receives them on `tools/list`, defaults included.
 * Clients decide from these whether a call needs the user's confirmation, so a hint that changes
 * should change on purpose. Fails as well on a tool advertised without an expectation, or
 * expected and not advertised.
 */
export function describeToolAnnotations({ createServer, expected }: ToolAnnotationsConfig): void {
    describe('tool annotations', () => {
        let advertised: Map<string, Tool>

        beforeAll(async () => {
            const tools = await listAdvertisedTools(createServer())
            advertised = new Map(tools.map((tool) => [tool.name, tool]))
        })

        it('pins every advertised tool, and only those', () => {
            expect([...advertised.keys()].sort()).toEqual(Object.keys(expected).sort())
        })

        describe.each(Object.entries(expected))('%s', (name, expectation) => {
            it('advertises the expected annotations', () => {
                expect(advertised.get(name)?.annotations).toEqual({
                    title: expectation.title,
                    readOnlyHint: expectation.readOnlyHint,
                    destructiveHint: expectation.destructiveHint,
                    idempotentHint: expectation.idempotentHint,
                    openWorldHint: expectation.openWorldHint ?? false,
                })
            })
        })
    })
}
