import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ToolSchemaSource } from '../tool.js'

/**
 * Every path in a JSON Schema that admits `null`, as dotted names (`items[]` for array items,
 * `$defs.Name` for definitions). An empty list means nothing in the schema can be null.
 */
export function findNullablePaths(node: unknown, path = ''): string[] {
    if (!node || typeof node !== 'object') {
        return []
    }

    if (Array.isArray(node)) {
        return node.flatMap((item) => findNullablePaths(item, path))
    }

    const schema = node as Record<string, unknown>
    const { type } = schema

    if (type === 'null' || (Array.isArray(type) && type.includes('null'))) {
        return [path]
    }

    const paths: string[] = []

    const properties = schema.properties
    if (properties && typeof properties === 'object') {
        for (const [key, value] of Object.entries(properties)) {
            paths.push(...findNullablePaths(value, path ? `${path}.${key}` : key))
        }
    }

    for (const key of ['items', 'additionalProperties', 'not']) {
        paths.push(...findNullablePaths(schema[key], key === 'items' ? `${path}[]` : path))
    }

    for (const key of ['anyOf', 'oneOf', 'allOf', 'prefixItems']) {
        paths.push(...findNullablePaths(schema[key], path))
    }

    const defs = schema.$defs
    if (defs && typeof defs === 'object') {
        for (const [key, value] of Object.entries(defs)) {
            paths.push(...findNullablePaths(value, `$defs.${key}`))
        }
    }

    return paths
}

/**
 * One test per tool asserting its output schema admits no `null` anywhere.
 *
 * Results are stripped of nulls before the SDK validates them against the output schema, so a
 * nullable field promises a value the tool can never send, and fails the call with "Output
 * validation error" once stripped. Declare the field `.optional()` and leave the key out instead.
 */
export function describeOutputSchemaNullability(tools: readonly ToolSchemaSource[]): void {
    describe('tool output schemas', () => {
        it.each(
            tools.filter((tool) => tool.outputSchema).map((tool) => [tool.name, tool] as const),
        )('%s declares no nullable output fields', (_name, tool) => {
            const jsonSchema = z.toJSONSchema(z.object(tool.outputSchema ?? {}), {
                io: 'output',
            })
            expect(findNullablePaths(jsonSchema)).toEqual([])
        })
    })
}
