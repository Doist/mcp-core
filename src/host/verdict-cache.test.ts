import { describe, expect, it } from 'vitest'
import { createTokenVerdictCache } from './verdict-cache.js'

function clock(start = 1_000) {
    let now = start
    return {
        now: () => now,
        advance: (ms: number) => {
            now += ms
        },
    }
}

describe('createTokenVerdictCache', () => {
    it('returns what was stored for the same token and base URL', () => {
        const cache = createTokenVerdictCache({ ttlMs: 1_000, maxEntries: 10 })

        cache.set('tok', 'https://api.test', 'forbidden')

        expect(cache.get('tok', 'https://api.test')).toBe('forbidden')
    })

    it('keeps a token apart per base URL, so staging and production never share a verdict', () => {
        const cache = createTokenVerdictCache({ ttlMs: 1_000, maxEntries: 10 })

        cache.set('tok', 'https://api.test', 'valid')

        expect(cache.get('tok', 'https://staging.test')).toBeUndefined()
        expect(cache.get('tok')).toBeUndefined()
    })

    it('forgets a verdict once the TTL has passed, and keeps it until then', () => {
        const time = clock()
        const cache = createTokenVerdictCache({ ttlMs: 1_000, maxEntries: 10, now: time.now })

        cache.set('tok', undefined, 'valid')
        time.advance(999)
        expect(cache.get('tok')).toBe('valid')
        time.advance(1)
        expect(cache.get('tok')).toBeUndefined()
    })

    it('evicts the oldest verdict when full', () => {
        const cache = createTokenVerdictCache({ ttlMs: 1_000, maxEntries: 2 })

        cache.set('first', undefined, 'valid')
        cache.set('second', undefined, 'invalid')
        cache.set('third', undefined, 'forbidden')

        expect(cache.get('first')).toBeUndefined()
        expect(cache.get('second')).toBe('invalid')
        expect(cache.get('third')).toBe('forbidden')
    })

    it('replaces a verdict for the same token without evicting another', () => {
        const cache = createTokenVerdictCache({ ttlMs: 1_000, maxEntries: 2 })

        cache.set('first', undefined, 'valid')
        cache.set('second', undefined, 'valid')
        cache.set('second', undefined, 'invalid')

        expect(cache.get('first')).toBe('valid')
        expect(cache.get('second')).toBe('invalid')
    })

    it('forgets everything on clear', () => {
        const cache = createTokenVerdictCache({ ttlMs: 1_000, maxEntries: 10 })
        cache.set('tok', undefined, 'valid')

        cache.clear()

        expect(cache.get('tok')).toBeUndefined()
    })
})
