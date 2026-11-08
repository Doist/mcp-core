/**
 * @type {import('semantic-release').GlobalConfig}
 *
 * A release publishes to npm, pushes a `v<version>` tag and writes the notes to a GitHub release.
 * It commits nothing back to `main`: the branch requires signed commits, which the release bot's
 * commit would not be. `package.json` keeps `0.0.0-development`, and the version comes from the
 * tags.
 */
export default {
    branches: ['main', { name: 'next', prerelease: true }],
    plugins: [
        ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
        ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
        '@semantic-release/npm',
        '@semantic-release/github',
    ],
}
