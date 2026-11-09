const TRANSIENT_CODES = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
])

function codeOf(value: unknown): unknown {
    return (value as { code?: unknown } | undefined)?.code
}

function statusOf(error: object): number | undefined {
    const record = error as Record<string, unknown>
    if (typeof record.httpStatusCode === 'number') return record.httpStatusCode
    if (typeof record.statusCode === 'number') return record.statusCode
    return undefined
}

/**
 * Whether a `ValidateToken` rejection is worth retrying rather than a fault to report: a timeout,
 * a dropped or refused connection (by its `code`, on the error or on its `cause`), or a 5xx
 * (`TokenValidationError` carries it as `httpStatusCode`). A host can then let the request through or answer 503, and never caches
 * the failure as a verdict. Anything else, such as a redirect or a 404 from a misconfigured base
 * URL, is not transient.
 */
export function isTransientValidationError(error: unknown): boolean {
    if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') return true

        // Node's net and dns errors carry the code themselves; undici wraps them in "fetch failed"
        // and puts the code on `cause`.
        for (const code of [codeOf(error), codeOf(error.cause)]) {
            if (typeof code === 'string' && TRANSIENT_CODES.has(code)) return true
        }

        // undici's own wording for a request that never got a response, when it gives no code.
        if (error.message.includes('fetch failed')) return true
    }

    if (error !== null && typeof error === 'object') {
        const status = statusOf(error)
        if (status !== undefined && status >= 500 && status <= 599) return true
    }

    return false
}
