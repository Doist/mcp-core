import { describe, expect, it } from 'vitest'
import { isTransientValidationError } from './transient.js'
import { TokenValidationError } from './validate-bearer-token.js'

function withName(name: string): Error {
    const error = new Error('stopped')
    error.name = name
    return error
}

function fetchFailed(code: string): TypeError {
    // Not 'fetch failed', so only the code on `cause` can mark it transient.
    return new TypeError('request could not be sent', {
        cause: Object.assign(new Error(code), { code }),
    })
}

describe('isTransientValidationError', () => {
    it.each([
        ['a timeout', withName('TimeoutError')],
        ['an abort', withName('AbortError')],
        ['a refused connection', fetchFailed('ECONNREFUSED')],
        ['a reset connection', fetchFailed('ECONNRESET')],
        ['a DNS failure', fetchFailed('ENOTFOUND')],
        ['a temporary DNS failure', fetchFailed('EAI_AGAIN')],
        ['an undici connect timeout', fetchFailed('UND_ERR_CONNECT_TIMEOUT')],
        ['an undici socket error', fetchFailed('UND_ERR_SOCKET')],
        ['a "fetch failed" without a cause', new TypeError('fetch failed')],
        ['a 500', new TokenValidationError(500)],
        ['a 503', new TokenValidationError(503)],
        ['a plain object carrying a 502', { httpStatusCode: 502 }],
        ['a plain object carrying statusCode 504', { statusCode: 504 }],
    ])('treats %s as transient', (_label, error) => {
        expect(isTransientValidationError(error)).toBe(true)
    })

    it.each([
        ['a 404 from a misconfigured base URL', new TokenValidationError(404)],
        ['a redirect', new TokenValidationError(302)],
        ['a 429', new TokenValidationError(429)],
        ['an unrelated error', new Error('boom')],
        ['a string', 'fetch failed'],
        ['null', null],
        ['undefined', undefined],
    ])('treats %s as not transient', (_label, error) => {
        expect(isTransientValidationError(error)).toBe(false)
    })
})
