export type BearerChallengeOptions = {
    /**
     * `insufficient_scope` (RFC 6750) for a 403 on a token that lacks a scope, so the client asks
     * for consent again. Left out for a 401, where the client refreshes its token.
     */
    error?: 'insufficient_scope'
    /** The resource's protected-resource metadata (RFC 9728), where the client finds how to authorise. */
    resourceMetadataUrl?: string
}

/** The `WWW-Authenticate` value for a refused bearer token. */
export function buildBearerChallenge({
    error,
    resourceMetadataUrl,
}: BearerChallengeOptions = {}): string {
    const params = [
        ...(error ? [`error="${error}"`] : []),
        ...(resourceMetadataUrl ? [`resource_metadata="${resourceMetadataUrl}"`] : []),
    ]
    return params.length > 0 ? `Bearer ${params.join(', ')}` : 'Bearer'
}
