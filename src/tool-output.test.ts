import type { ContentBlock } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'
import { getErrorOutput, getToolOutput } from './tool-output.js'

describe('getToolOutput', () => {
    it('sends the structured payload as JSON first and the summary last', () => {
        const structuredContent = { tasks: [{ id: '1', title: 'Buy milk' }], totalCount: 1 }

        expect(getToolOutput({ textContent: 'Found 1 task.', structuredContent })).toEqual({
            content: [
                { type: 'text', text: '{"tasks":[{"id":"1","title":"Buy milk"}],"totalCount":1}' },
                { type: 'text', text: 'Found 1 task.' },
            ],
            structuredContent,
        })
    })

    it("puts the tool's own content items ahead of the JSON and the summary", () => {
        const image: ContentBlock = { type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' }

        expect(
            getToolOutput({
                textContent: 'Attachment: photo.png',
                structuredContent: { fileName: 'photo.png' },
                contentItems: [image],
            }).content,
        ).toEqual([
            image,
            { type: 'text', text: '{"fileName":"photo.png"}' },
            { type: 'text', text: 'Attachment: photo.png' },
        ])
    })

    it('leaves the JSON block out when structuredContentAsText is false', () => {
        expect(
            getToolOutput(
                { textContent: 'No tasks.', structuredContent: { tasks: [] } },
                { structuredContentAsText: false },
            ),
        ).toEqual({
            content: [{ type: 'text', text: 'No tasks.' }],
            structuredContent: { tasks: [] },
        })
    })

    it('strips nulls and empty objects from both the payload and its JSON copy', () => {
        const output = getToolOutput({
            structuredContent: { id: '1', dueDate: null, extra: {}, labels: [] },
        })

        expect(output).toEqual({
            content: [{ type: 'text', text: '{"id":"1","labels":[]}' }],
            structuredContent: { id: '1', labels: [] },
        })
    })

    it('passes verbatim keys through unstripped', () => {
        const output = getToolOutput(
            { structuredContent: { draft: { manifest: { exitOn: {}, step: null } } } },
            { verbatimKeys: ['manifest'] },
        )

        expect(output.structuredContent).toEqual({
            draft: { manifest: { exitOn: {}, step: null } },
        })
    })

    it('sends prose alone, with no structuredContent key, when the tool returns no payload', () => {
        const output = getToolOutput({ textContent: 'Done.' })

        expect(output).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
        expect(Object.hasOwn(output, 'structuredContent')).toBe(false)
    })

    it('still sends a content array when the tool returns nothing', () => {
        expect(getToolOutput({})).toEqual({ content: [] })
    })
})

describe('getErrorOutput', () => {
    it('returns the message as an error result', () => {
        expect(getErrorOutput('Project not found.')).toEqual({
            content: [{ type: 'text', text: 'Project not found.' }],
            isError: true,
        })
    })
})
