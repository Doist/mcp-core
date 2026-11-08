import { describe, expect, it } from 'vitest'
import { formatToolTitle, getMcpAnnotations } from './annotations.js'

describe('formatToolTitle', () => {
    it.each([
        ['find-tasks', 'Find Tasks'],
        ['user-info', 'User Info'],
        ['get_users', 'Get Users'],
        ['load-thread_items', 'Load Thread Items'],
        ['--leading-and--double-', 'Leading And Double'],
        ['fetch', 'Fetch'],
    ])('formats %j as %j', (name, title) => {
        expect(formatToolTitle(name)).toBe(title)
    })
})

describe('getMcpAnnotations', () => {
    const hints = { readOnlyHint: true, destructiveHint: false, idempotentHint: true }

    it('titles the tool with the product and defaults openWorldHint to false', () => {
        expect(getMcpAnnotations({ name: 'find-tasks', annotations: hints }, 'Todoist')).toEqual({
            title: 'Todoist: Find Tasks',
            openWorldHint: false,
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
        })
    })

    it("lets the tool's own hints override both defaults", () => {
        const annotations = { ...hints, title: 'Send a message', openWorldHint: true }

        expect(getMcpAnnotations({ name: 'reply', annotations }, 'Comms')).toEqual({
            title: 'Send a message',
            openWorldHint: true,
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
        })
    })
})
