import { describe, expect, it } from 'vitest'
import { normalizeToolMeta } from './app-meta.js'

const uri = 'ui://task-list/app.html'

describe('normalizeToolMeta', () => {
    it('adds the flat key when only ui.resourceUri is set', () => {
        expect(normalizeToolMeta({ ui: { resourceUri: uri, visibility: ['model'] } })).toEqual({
            ui: { resourceUri: uri, visibility: ['model'] },
            'ui/resourceUri': uri,
        })
    })

    it('adds ui.resourceUri when only the flat key is set, keeping other ui fields', () => {
        expect(normalizeToolMeta({ 'ui/resourceUri': uri, ui: { visibility: ['app'] } })).toEqual({
            'ui/resourceUri': uri,
            ui: { visibility: ['app'], resourceUri: uri },
        })
        expect(normalizeToolMeta({ 'ui/resourceUri': uri })).toEqual({
            'ui/resourceUri': uri,
            ui: { resourceUri: uri },
        })
    })

    it.each([
        ['both forms set', { ui: { resourceUri: uri }, 'ui/resourceUri': 'ui://other' }],
        ['no UI resource', { 'openai/outputTemplate': uri }],
        ['a ui object without a resource', { ui: { visibility: ['model'] } }],
    ])('returns the meta unchanged with %s', (_case, meta) => {
        expect(normalizeToolMeta(meta)).toBe(meta)
    })
})
