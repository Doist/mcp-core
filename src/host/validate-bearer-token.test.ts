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
        // A page anyone can load, as a login page would be.
        if (req.url === '/public') {
            res.writeHead(200, { 'content-type': 'text/html' })
            res.end('<html>sign in</html>')
            return
        }
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

    it.each(['Authorization', 'authorization'])(
        'sends the token even when the caller headers carry their own %s',
        async (name) => {
            await validateBearerToken({
                url: baseUrl,
                token: 'tok-123',
                headers: { [name]: 'Bearer someone-else' },
            })

            expect(received[0]?.headers.authorization).toBe('Bearer tok-123')
        },
    )

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

    it('does not follow a redirect, so a public page answering 200 is no verdict', async () => {
        reply = { status: 302, headers: { location: '/public' } }
        const error = await validateBearerToken({
            url: `${baseUrl}/api/v1/user`,
            token: 'tok',
        }).catch((thrown: unknown) => thrown)

        expect(error).toBeInstanceOf(TokenValidationError)
        expect(error).toMatchObject({ httpStatusCode: 302 })
        expect(received.map((request) => request.url)).toEqual(['/api/v1/user'])
    })

    it('leaves the connection open for the next validation', async () => {
        // A server of its own, so no connection from an earlier test is already pooled.
        let connections = 0
        const own = createServer((_req, res) => {
            res.writeHead(200, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ items: 'x'.repeat(64 * 1024) }))
        })
        own.on('connection', () => connections++)
        await new Promise<void>((resolve) => own.listen(0, '127.0.0.1', resolve))
        const url = `http://127.0.0.1:${(own.address() as AddressInfo).port}`

        try {
            for (let i = 0; i < 3; i++) {
                await validateBearerToken({ url, token: 'tok' })
                // The pool takes a connection back once the response's end has been processed,
                // after this tick. Validations from separate requests are never closer than that.
                await new Promise((resolve) => setImmediate(resolve))
            }
            expect(connections).toBe(1)
        } finally {
            own.closeAllConnections()
            await new Promise<void>((resolve) => own.close(() => resolve()))
        }
    })

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

        const error = await validateBearerToken({
            url: `http://127.0.0.1:${port}`,
            token: 'tok',
        }).catch((thrown: unknown) => thrown)

        expect(error).not.toBeInstanceOf(TokenValidationError)
        expect(error).toMatchObject({ cause: { code: 'ECONNREFUSED' } })
    })
})
