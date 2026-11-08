import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { describeOutputSchemaNullability, findNullablePaths } from './nullable-output.js'

function nullablePathsOf(shape: z.ZodRawShape): string[] {
    return findNullablePaths(z.toJSONSchema(z.object(shape), { io: 'output' }))
}

describe('findNullablePaths', () => {
    it('finds nothing in a schema of optional fields', () => {
        expect(
            nullablePathsOf({
                id: z.string(),
                due: z.string().optional(),
                tags: z.array(z.object({ name: z.string() })),
            }),
        ).toEqual([])
    })

    it.each([
        ['a top-level field', { due: z.string().nullable() }, ['due']],
        ['a field that is also optional', { due: z.string().nullable().optional() }, ['due']],
        ['an array item', { ids: z.array(z.string().nullable()) }, ['ids[]']],
        [
            'an object nested in an array',
            { tasks: z.array(z.object({ parentId: z.string().nullable() })) },
            ['tasks[].parentId'],
        ],
        ['a record value', { byId: z.record(z.string(), z.number().nullable()) }, ['byId']],
        ['a literal null', { cleared: z.null() }, ['cleared']],
    ])('reports %s', (_case, shape, paths) => {
        expect(nullablePathsOf(shape)).toEqual(paths)
    })

    it('reports nullable fields inside shared definitions', () => {
        const user = z.object({ email: z.string().nullable() }).meta({ id: 'User' })

        expect(nullablePathsOf({ owner: user, assignee: user })).toEqual(['$defs.User.email'])
    })
})

describeOutputSchemaNullability([
    { name: 'find-tasks', parameters: {}, outputSchema: { tasks: z.array(z.string()) } },
    { name: 'user-info', parameters: {}, outputSchema: { timezone: z.string().optional() } },
    { name: 'no-output', parameters: {} },
])
