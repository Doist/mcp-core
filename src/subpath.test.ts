import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
    exports?: Record<string, { types?: string; import?: string }>
}

const ENTRIES = [
    { subpath: '.', source: './index.js' },
    { subpath: './testing', source: './testing/index.js' },
]

describe.each(ENTRIES)('the $subpath entry', ({ subpath, source }) => {
    it('is declared in package.json exports with import and types', () => {
        const entry = pkg.exports?.[subpath]
        expect(entry).toBeDefined()
        expect(entry?.types).toMatch(/^\.\/dist\/.*\.d\.ts$/)
        expect(entry?.import).toMatch(/^\.\/dist\/.*\.js$/)
    })

    // The built files exist only after `npm run build`. CI and `npm run verify` build before
    // testing, so this runs there; the declaration check above always runs.
    it.runIf(existsSync(resolve(repoRoot, 'dist')))(
        'resolves to built files exporting the same names as the source barrel',
        async () => {
            const entry = pkg.exports?.[subpath]
            const importPath = resolve(repoRoot, entry?.import ?? '')
            expect(existsSync(importPath)).toBe(true)
            expect(existsSync(resolve(repoRoot, entry?.types ?? ''))).toBe(true)

            // Nothing in this repository imports through the barrels (tests use relative paths),
            // so a dropped re-export would otherwise go unnoticed.
            const built = (await import(importPath)) as Record<string, unknown>
            const barrel = (await import(source)) as Record<string, unknown>
            expect(Object.keys(built).sort()).toEqual(Object.keys(barrel).sort())
        },
    )
})
