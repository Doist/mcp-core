import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { TokenValidationError, validateBearerToken } from './validate-bearer-token.js'

type Received = { method?: string; url?: string; headers: IncomingHttpHeaders }
type Reply = { status: number; headers?: Record<string, string>; body?: string; delayMs?: number }

let server: Server
let baseUrl: string
let reply: Reply
let received: Received[]

beforeAll(async () => {
    server = createServer((req, res) => {
        received.push({ method: req.method, url: req.url, headers: req.headers })
        const send = () => {
            res.writeHead(reply.status, reply.headers)
            res.end(reply.body ?? '')
        }
        if (reply.delayMs) setTimeout(send, reply.delayMs)
        else send()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
})

beforeEach(() => {
    reply = { status: 200 }
    received = []
})

describe('validateBearerToken', () => {
    it('sends one GET with the bearer token and the caller headers to the given URL', async () => {
        await validateBearerToken({
            url: `${baseUrl}/api/v1/user?limit=1`,
            token: 'tok-123',
            headers: { 'doist-tool': 'auth:validate-token' },
        })

        expect(received).toHaveLength(1)
        expect(received[0]?.method).toBe('GET')
        expect(received[0]?.url).toBe('/api/v1/user?limit=1')
        expect(received[0]?.headers.authorization).toBe('Bearer tok-123')
        expect(received[0]?.headers['doist-tool']).toBe('auth:validate-token')
    })

    it('sends the token even when the caller headers carry their own Authorization', async () => {
        await validateBearerToken({
            url: baseUrl,
            token: 'tok-123',
            headers: { Authorization: 'Bearer someone-else' },
        })

        expect(received[0]?.headers.authorization).toBe('Bearer tok-123')
    })

    it.each([
        [200, 'valid'],
        [204, 'valid'],
        [401, 'invalid'],
        [403, 'forbidden'],
    ] as const)('classifies a %i as %s', async (status, expected) => {
        reply = { status }
        await expect(validateBearerToken({ url: baseUrl, token: 'tok' })).resolves.toBe(expected)
    })

    it('reads only the status, so a 200 whose body is not JSON is still valid', async () => {
        reply = { status: 200, headers: { 'content-type': 'text/html' }, body: '<html>not json' }
        await expect(validateBearerToken({ url: baseUrl, token: 'tok' })).resolves.toBe('valid')
    })

    it('lets the caller classify a 403 from the response, such as its challenge', async () => {
        reply = {
            status: 403,
            headers: { 'www-authenticate': 'Bearer error="insufficient_scope"' },
        }
        const seen: (string | null)[] = []

        const result = await validateBearerToken({
            url: baseUrl,
            token: 'tok',
            classifyForbidden: (response) => {
                seen.push(response.headers.get('www-authenticate'))
                return 'valid'
            },
        })

        expect(result).toBe('valid')
        expect(seen).toEqual(['Bearer error="insufficient_scope"'])
    })

    it('does not ask classifyForbidden about a 401', async () => {
        reply = { status: 401 }
        const asked: number[] = []

        const result = await validateBearerToken({
            url: baseUrl,
            token: 'tok',
            classifyForbidden: (response) => {
                asked.push(response.status)
                return 'valid'
            },
        })

        expect(result).toBe('invalid')
        expect(asked).toEqual([])
    })

    it.each([404, 429, 500, 503])(
        'throws a TokenValidationError carrying the status for a %i',
        async (status) => {
            reply = { status }
            const error = await validateBearerToken({ url: baseUrl, token: 'tok-secret' }).catch(
                (thrown: unknown) => thrown,
            )

            expect(error).toBeInstanceOf(TokenValidationError)
            expect(error).toMatchObject({
                name: 'TokenValidationError',
                httpStatusCode: status,
                message: `Token validation failed with status ${status}`,
            })
            expect(String((error as Error).message)).not.toContain('tok-secret')
        },
    )

    it('rejects with a TimeoutError when the API does not answer in time', async () => {
        reply = { status: 200, delayMs: 1_000 }
        await expect(
            validateBearerToken({ url: baseUrl, token: 'tok', timeoutMs: 50 }),
        ).rejects.toMatchObject({ name: 'TimeoutError' })
    })

    it('lets a network failure through unchanged', async () => {
        const closed = createServer()
        await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve))
        const { port } = closed.address() as AddressInfo
        await new Promise<void>((resolve) => closed.close(() => resolve()))

        await expect(
            validateBearerToken({ url: `http://127.0.0.1:${port}`, token: 'tok' }),
        ).rejects.toMatchObject({ message: 'fetch failed', cause: { code: 'ECONNREFUSED' } })
    })
})
