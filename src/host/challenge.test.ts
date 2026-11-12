import { describe, expect, it } from 'vitest'
import { buildBearerChallenge } from './challenge.js'

const METADATA = 'https://mcp.example.com/.well-known/oauth-protected-resource/mcp'
const SCOPES = ['notes:read', 'notes:write']

describe('buildBearerChallenge', () => {
    it.each([
        [{}, 'Bearer'],
        [{ resourceMetadataUrl: METADATA }, `Bearer resource_metadata="${METADATA}"`],
        [{ error: 'insufficient_scope' as const }, 'Bearer error="insufficient_scope"'],
        [
            { error: 'insufficient_scope' as const, resourceMetadataUrl: METADATA },
            `Bearer error="insufficient_scope", resource_metadata="${METADATA}"`,
        ],
        [{ scopes: SCOPES }, 'Bearer scope="notes:read notes:write"'],
        [
            { resourceMetadataUrl: METADATA, scopes: SCOPES },
            `Bearer resource_metadata="${METADATA}", scope="notes:read notes:write"`,
        ],
        [
            { error: 'insufficient_scope' as const, resourceMetadataUrl: METADATA, scopes: SCOPES },
            `Bearer error="insufficient_scope", resource_metadata="${METADATA}", scope="notes:read notes:write"`,
        ],
        [{ resourceMetadataUrl: METADATA, scopes: [] }, `Bearer resource_metadata="${METADATA}"`],
    ])('builds the challenge for %o', (options, expected) => {
        expect(buildBearerChallenge(options)).toBe(expected)
    })
})
