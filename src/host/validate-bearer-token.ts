import type { TokenValidationResult } from './server-contract.js'

const DEFAULT_TIMEOUT_MS = 5_000

/**
 * The validation call got an answer that is no verdict on the token: a 5xx, a 429, or a 404
 * from a misconfigured base URL. `httpStatusCode` is what a host reads to treat a 5xx as
 * transient.
 */
export class TokenValidationError extends Error {
    readonly httpStatusCode: number

    constructor(httpStatusCode: number) {
        super(`Token validation failed with status ${httpStatusCode}`)
        this.name = 'TokenValidationError'
        this.httpStatusCode = httpStatusCode
    }
}

export type ValidateBearerTokenOptions = {
    /** An endpoint every usable token can read, ideally the cheapest one. */
    url: string | URL
    token: string
    /** Sent with the request, for example to tag it for usage tracking. */
    headers?: Record<string, string>
    /** How long to wait before giving up with a `TimeoutError`. Defaults to 5 seconds. */
    timeoutMs?: number
    /**
     * Classifies a 403. Defaults to `forbidden`. A product whose 403 can also mean a refusal that
     * consent cannot lift reads the response here, such as its `WWW-Authenticate` challenge.
     */
    classifyForbidden?: (response: Response) => TokenValidationResult
}

/**
 * Validates a bearer token with one status-only `GET`: 2xx is `valid`, 401 `invalid`, 403
 * `forbidden` (or whatever `classifyForbidden` says). The body is discarded unread, so a change
 * to the response's shape can never misclassify a token.
 *
 * @throws {TokenValidationError} for any other status. Network and timeout errors propagate
 * unchanged.
 */
export async function validateBearerToken({
    url,
    token,
    headers,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    classifyForbidden = () => 'forbidden',
}: ValidateBearerTokenOptions): Promise<TokenValidationResult> {
    const requestHeaders = new Headers(headers)
    requestHeaders.set('Authorization', `Bearer ${token}`)

    const response = await fetch(url, {
        headers: requestHeaders,
        signal: AbortSignal.timeout(timeoutMs),
    })
    // Release the socket back to the pool without decoding anything.
    await response.body?.cancel().catch(() => undefined)

    if (response.ok) return 'valid'
    if (response.status === 401) return 'invalid'
    if (response.status === 403) return classifyForbidden(response)
    throw new TokenValidationError(response.status)
}
