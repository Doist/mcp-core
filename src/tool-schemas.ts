import type { StandardSchemaWithJSON } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { ToolSchemaSource } from './tool.js'

type ToolSchema = StandardSchemaWithJSON<Record<string, unknown>, Record<string, unknown>>

export type ToolSchemas = {
    input: ToolSchema
    /** Absent when the tool declares no `outputSchema`. */
    output?: ToolSchema
}

/** Tool schemas are static, so their JSON form is compiled once per process, not per server. */
const TOOL_SCHEMAS = new WeakMap<ToolSchemaSource, ToolSchemas>()

/**
 * Wraps a Zod schema so the conversion the SDK asks for on every `tools/list` (JSON Schema
 * 2020-12, no library options) returns a JSON Schema compiled once. Any other conversion is
 * delegated to Zod unchanged.
 */
function withCachedJsonSchema(
    schema: z.ZodObject<z.ZodRawShape>,
    io: 'input' | 'output',
): ToolSchema {
    const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12', io })
    const standard = schema['~standard']

    return {
        '~standard': {
            ...standard,
            jsonSchema: {
                ...standard.jsonSchema,
                [io]: (options: Parameters<typeof standard.jsonSchema.input>[0]) =>
                    options.target === 'draft-2020-12' && options.libraryOptions === undefined
                        ? jsonSchema
                        : standard.jsonSchema[io](options),
            },
        },
    } as ToolSchema
}

/**
 * The input and output schemas to register a tool with, as Standard Schemas carrying their JSON
 * form. Built once per tool object and reused by every server that registers it.
 */
export function getToolSchemas(tool: ToolSchemaSource): ToolSchemas {
    const cached = TOOL_SCHEMAS.get(tool)
    if (cached) {
        return cached
    }

    const schemas: ToolSchemas = {
        input: withCachedJsonSchema(z.object(tool.parameters), 'input'),
        ...(tool.outputSchema
            ? { output: withCachedJsonSchema(z.object(tool.outputSchema), 'output') }
            : {}),
    }
    TOOL_SCHEMAS.set(tool, schemas)
    return schemas
}
