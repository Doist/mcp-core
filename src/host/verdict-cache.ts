import type { TokenValidationResult } from './server-contract.js'

export type TokenVerdictCacheOptions = {
    /** How long a verdict stands before the token is validated again. */
    ttlMs: number
    /** The most verdicts kept; the oldest goes first when full. */
    maxEntries: number
    /** The clock, for tests. Defaults to `Date.now`. */
    now?: () => number
}

export type TokenVerdictCache = {
    get(token: string, baseUrl?: string): TokenValidationResult | undefined
    set(token: string, baseUrl: string | undefined, result: TokenValidationResult): void
    clear(): void
}

/**
 * Remembers token verdicts for a while, so a host doesn't validate the same token on every
 * request. Keyed by token and base URL, so one token is never judged against another
 * environment's verdict. Store only verdicts: a transient failure is not one.
 */
export function createTokenVerdictCache({
    ttlMs,
    maxEntries,
    now = Date.now,
}: TokenVerdictCacheOptions): TokenVerdictCache {
    const entries = new Map<string, { result: TokenValidationResult; expiresAt: number }>()
    const keyOf = (token: string, baseUrl?: string) => `${token}::${baseUrl ?? ''}`

    return {
        get(token, baseUrl) {
            const key = keyOf(token, baseUrl)
            const entry = entries.get(key)
            if (!entry) return undefined
            if (now() < entry.expiresAt) return entry.result
            entries.delete(key)
            return undefined
        },
        set(token, baseUrl, result) {
            if (maxEntries <= 0) return
            const key = keyOf(token, baseUrl)
            // Re-inserting moves the key to the end, so eviction order stays oldest-first.
            entries.delete(key)
            if (entries.size >= maxEntries) {
                const oldest = entries.keys().next().value
                if (oldest !== undefined) entries.delete(oldest)
            }
            entries.set(key, { result, expiresAt: now() + ttlMs })
        },
        clear() {
            entries.clear()
        },
    }
}
