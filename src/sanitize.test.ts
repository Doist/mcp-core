import { describe, expect, it } from 'vitest'
import { removeNullFields } from './sanitize.js'

describe('removeNullFields', () => {
    it('removes null fields from objects, including nested ones', () => {
        const input = {
            name: 'Ada',
            age: null,
            email: 'ada@example.com',
            address: { street: '1 Example Street', city: null, country: 'UK' },
        }

        expect(removeNullFields(input)).toEqual({
            name: 'Ada',
            email: 'ada@example.com',
            address: { street: '1 Example Street', country: 'UK' },
        })
    })

    it('removes null fields from objects inside arrays', () => {
        const input = {
            items: [
                { id: 1, value: 'first' },
                { id: 2, value: null },
            ],
        }

        expect(removeNullFields(input)).toEqual({ items: [{ id: 1, value: 'first' }, { id: 2 }] })
    })

    it.each([null, undefined, 'text', 0, false])('returns %p unchanged', (value) => {
        expect(removeNullFields(value)).toBe(value)
    })

    it('removes empty objects, including ones left empty by removing nulls, but keeps empty arrays', () => {
        const input = {
            name: 'Test',
            metadata: {},
            tags: [],
            nested: {
                data: 'value',
                emptyObj: {},
                emptyArr: [],
                onlyNulls: { a: null, b: null },
                deep: { anotherEmpty: {} },
            },
            items: [
                { id: 1, empty: {} },
                { id: 2, list: [] },
            ],
        }

        expect(removeNullFields(input)).toEqual({
            name: 'Test',
            tags: [],
            nested: { data: 'value', emptyArr: [] },
            items: [{ id: 1 }, { id: 2, list: [] }],
        })
    })

    it('passes verbatim keys through as given, wherever they are nested', () => {
        const schema = { type: 'object', properties: { name: { const: null }, extra: {} } }

        expect(
            removeNullFields(
                {
                    actions: [{ name: 'get_file', inputSchema: schema, note: null }],
                    manifest: { exitOn: {}, step: null },
                },
                { verbatimKeys: ['inputSchema', 'manifest'] },
            ),
        ).toEqual({
            actions: [{ name: 'get_file', inputSchema: schema }],
            manifest: { exitOn: {}, step: null },
        })
    })

    it('still removes a verbatim key whose own value is null', () => {
        expect(removeNullFields({ id: 1, manifest: null }, { verbatimKeys: ['manifest'] })).toEqual(
            { id: 1 },
        )
    })
})
