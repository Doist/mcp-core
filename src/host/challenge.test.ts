import { describe, expect, it } from 'vitest'
import { buildBearerChallenge } from './challenge.js'

const METADATA = 'https://ai.todoist.net/.well-known/oauth-protected-resource/mcp'

describe('buildBearerChallenge', () => {
    it.each([
        [{}, 'Bearer'],
        [{ resourceMetadataUrl: METADATA }, `Bearer resource_metadata="${METADATA}"`],
        [{ error: 'insufficient_scope' as const }, 'Bearer error="insufficient_scope"'],
        [
            { error: 'insufficient_scope' as const, resourceMetadataUrl: METADATA },
            `Bearer error="insufficient_scope", resource_metadata="${METADATA}"`,
        ],
    ])('builds the challenge for %o', (options, expected) => {
        expect(buildBearerChallenge(options)).toBe(expected)
    })
})
