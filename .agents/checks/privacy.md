# Check: privacy and secrets

This repository is public, and the npm package ships `dist/` (including the `./testing` helpers) to every MCP server.

## Report

- A secret, API key, token or password, even an expired one.
- Real user data in fixtures, tests or docs: real names, emails, account IDs, task or message content, or URLs copied from an account.
- Personal identifiers in docs and examples: real emails, usernames, home-directory paths, local repository names. Use placeholders (`alice@example.com`, `~/code`).
- Internal details: private hostnames, internal URLs, Todoist-internal tools or documents.
- A new path in `package.json#files` that should not be published.
- Untracked files the change doesn't need (`.env`, logs, `.tmp/`).

## Fine

- Invented content and `example.com` addresses in fixtures.
- Public URLs: GitHub, the npm registry, the MCP specification, published RFCs.
