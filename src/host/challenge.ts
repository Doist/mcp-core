export type BearerChallengeOptions = {
    /**
     * `insufficient_scope` (RFC 6750) for a 403 on a token that lacks a scope, so the client asks
     * for consent again. Left out for a 401, where the client refreshes its token.
     */
    error?: 'insufficient_scope'
    /** The resource's protected-resource metadata (RFC 9728), where the client finds how to authorise. */
    resourceMetadataUrl?: string
    /**
     * The scopes a token needs for this resource, sent as RFC 6750's `scope` attribute. MCP clients
     * request these first, ahead of the metadata's `scopes_supported`, so a client that can't find
     * the resource's metadata still asks for the right ones. Left out when empty.
     */
    scopes?: readonly string[]
}

/** The `WWW-Authenticate` value for a refused bearer token. */
export function buildBearerChallenge({
    error,
    resourceMetadataUrl,
    scopes,
}: BearerChallengeOptions = {}): string {
    const params = [
        ...(error ? [`error="${error}"`] : []),
        ...(resourceMetadataUrl ? [`resource_metadata="${resourceMetadataUrl}"`] : []),
        ...(scopes && scopes.length > 0 ? [`scope="${scopes.join(' ')}"`] : []),
    ]
    return params.length > 0 ? `Bearer ${params.join(', ')}` : 'Bearer'
}
