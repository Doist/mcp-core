export type RemoveNullFieldsOptions = {
    /**
     * Keys whose values are passed through as given, because their nulls and empty objects mean
     * something: a stored JSON Schema (`const: null`), or a document the model sends back
     * unchanged. A null at the key itself is still removed.
     */
    verbatimKeys?: Iterable<string>
}

function isEmptyPlainObject(value: unknown): boolean {
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
    )
}

/**
 * Removes null fields and empty objects recursively. Empty arrays are kept: "no results" is
 * meaningful, an absent key is not.
 *
 * Every tool result goes through this before it is sent, so output schemas must declare optional
 * fields, never nullable ones: the SDK validates the stripped payload, and a field declared
 * nullable but stripped fails the whole call with "Output validation error".
 */
export function removeNullFields<T>(value: T, options: RemoveNullFieldsOptions = {}): T {
    const verbatimKeys = new Set(options.verbatimKeys)
    return strip(value, verbatimKeys)
}

function strip<T>(value: T, verbatimKeys: ReadonlySet<string>): T {
    if (value === null || value === undefined) {
        return value
    }

    if (Array.isArray(value)) {
        return value.map((item) => strip(item, verbatimKeys)) as T
    }

    if (typeof value === 'object') {
        const sanitized: Record<string, unknown> = {}
        for (const [key, entry] of Object.entries(value)) {
            if (entry === null) continue
            if (verbatimKeys.has(key)) {
                sanitized[key] = entry
                continue
            }
            const cleaned = strip(entry, verbatimKeys)
            if (isEmptyPlainObject(cleaned)) continue
            sanitized[key] = cleaned
        }
        return sanitized as T
    }

    return value
}
