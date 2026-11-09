import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { expect, it } from 'vitest'

const srcDir = import.meta.dirname
const pkg = JSON.parse(readFileSync(resolve(srcDir, '../package.json'), 'utf8')) as {
    peerDependencies?: Record<string, string>
}

function rootEntrySources(): string[] {
    return readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
        .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
        .filter((file) => !file.startsWith(`testing${sep}`))
        .map((file) => readFileSync(join(srcDir, file), 'utf8'))
}

// A peer of a production dependency is installed in production: npm marks a consumer's dev copy
// of it `devOptional`, which `npm ci --omit=dev` keeps. So only what the root entry imports is a
// peer. `./testing` imports `vitest` and `@modelcontextprotocol/client` from the consumer's own
// devDependencies, undeclared.
it('declares as peers only packages the root entry imports', () => {
    const sources = rootEntrySources().join('\n')
    const imported = (name: string) =>
        new RegExp(`from '${name.replace('/', '\\/')}(/[^']*)?'`).test(sources)

    expect(Object.keys(pkg.peerDependencies ?? {}).filter((name) => !imported(name))).toEqual([])
})
