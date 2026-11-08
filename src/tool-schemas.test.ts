import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { getToolSchemas } from './tool-schemas.js'

const draft2020 = { target: 'draft-2020-12' as const }

describe('getToolSchemas', () => {
    it('returns the same schemas for the same tool object', () => {
        const tool = { name: 'cached', parameters: { limit: z.number() }, outputSchema: {} }

        const first = getToolSchemas(tool)
        const second = getToolSchemas(tool)

        expect(second.input).toBe(first.input)
        expect(second.output).toBe(first.output)
    })

    it('leaves the output schema out when the tool declares none', () => {
        const schemas = getToolSchemas({ name: 'no-output', parameters: {} })

        expect(Object.hasOwn(schemas, 'output')).toBe(false)
    })

    it('converts to JSON Schema 2020-12 and still validates with Zod', async () => {
        const { input, output } = getToolSchemas({
            name: 'converted',
            parameters: { limit: z.number().default(10) },
            outputSchema: { value: z.string() },
        })

        expect(output?.['~standard'].jsonSchema.output(draft2020)).toEqual({
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
        })
        expect(await input['~standard'].validate({})).toEqual({ value: { limit: 10 } })
    })

    it('keeps the input and output sides of a piped schema apart', () => {
        const date = z.string().pipe(z.iso.date())
        const { input, output } = getToolSchemas({
            name: 'piped',
            parameters: { date },
            outputSchema: { date },
        })
        const dateFormat = { properties: { date: { format: 'date' } } }

        expect(input['~standard'].jsonSchema.input(draft2020)).not.toMatchObject(dateFormat)
        expect(input['~standard'].jsonSchema.output(draft2020)).toMatchObject(dateFormat)
        expect(output?.['~standard'].jsonSchema.input(draft2020)).not.toMatchObject(dateFormat)
        expect(output?.['~standard'].jsonSchema.output(draft2020)).toMatchObject(dateFormat)
    })

    it('hands conversions with other options back to Zod', () => {
        const parameters = { tuple: z.tuple([z.string(), z.number()]) }
        const convert = getToolSchemas({ name: 'delegated', parameters }).input['~standard']
            .jsonSchema.input

        expect(convert({ target: 'draft-07' })).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            properties: {
                tuple: {
                    type: 'array',
                    items: [{ type: 'string' }, { type: 'number' }],
                    additionalItems: false,
                    minItems: 2,
                    maxItems: 2,
                },
            },
            required: ['tuple'],
        })

        const custom = convert({
            target: 'draft-2020-12',
            libraryOptions: {
                override: (context: { jsonSchema: Record<string, unknown> }) => {
                    context.jsonSchema.description = 'custom conversion'
                },
            },
        })
        expect(custom.description).toBe('custom conversion')
    })
})
