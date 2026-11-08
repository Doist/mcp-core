/**
 * What validating a bearer token against a product's API concluded.
 *
 * - `valid`: the token is accepted.
 * - `invalid`: missing, expired, or minted for another audience. A host answers 401 with a
 *   challenge, so the client refreshes its token.
 * - `forbidden`: the token authenticates but lacks a scope the tools need. A host answers 403
 *   with an `insufficient_scope` challenge, so the client asks for consent again.
 */
export type TokenValidationResult = 'valid' | 'invalid' | 'forbidden'

/**
 * Validates a bearer token against the product's API at `baseUrl`, or production when it is
 * left out.
 *
 * Resolves only with a verdict on the token. Anything else rejects: a `TokenValidationError`
 * for an unexpected status, or the network or timeout error unchanged. A host can then tell a
 * failure worth retrying (a 5xx, a timeout, a dropped connection) from a verdict, and never
 * caches one as the other.
 */
export type ValidateToken = (token: string, baseUrl?: string) => Promise<TokenValidationResult>

/**
 * The options every server's `getMcpServer` accepts, so a host builds each server the same way.
 * A server that needs more takes `McpServerOptions & { ... }`.
 */
export type McpServerOptions = {
    /** The user's bearer token for the product's API. */
    token: string
    /** The product's API base URL. Production when left out. */
    baseUrl?: string
}
