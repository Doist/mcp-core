const TRANSIENT_CAUSE_CODES = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
])

const TRANSIENT_MESSAGES = ['fetch failed', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']

function statusOf(error: object): number | undefined {
    const record = error as Record<string, unknown>
    if (typeof record.httpStatusCode === 'number') return record.httpStatusCode
    if (typeof record.statusCode === 'number') return record.statusCode
    return undefined
}

/**
 * Whether a `ValidateToken` rejection is worth retrying rather than a fault to report: a timeout,
 * a dropped or refused connection, or a 5xx (`TokenValidationError` carries it as
 * `httpStatusCode`). A host can then let the request through or answer 503, and never caches
 * the failure as a verdict. Anything else, such as a redirect or a 404 from a misconfigured base
 * URL, is not transient.
 */
export function isTransientValidationError(error: unknown): boolean {
    if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') return true

        // undici wraps transport failures in "fetch failed" and puts the code on `cause`.
        const causeCode = (error.cause as { code?: unknown } | undefined)?.code
        if (typeof causeCode === 'string' && TRANSIENT_CAUSE_CODES.has(causeCode)) return true

        if (TRANSIENT_MESSAGES.some((message) => error.message.includes(message))) return true
    }

    if (error !== null && typeof error === 'object') {
        const status = statusOf(error)
        if (status !== undefined && status >= 500) return true
    }

    return false
}
