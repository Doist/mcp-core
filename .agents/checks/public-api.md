# Check: public API

What the Doist MCP servers see: everything exported from `src/index.ts`, `src/host/index.ts` and `src/testing/index.ts`, its names, signatures, options and behaviour, plus peer dependency ranges and the Node engine. The shape of a tool result on the wire (content order, which blocks are sent, null stripping, `isError`) is part of it: it reaches every client of every server. So is what `./host` promises a host such as todoist-ai-integrations: which statuses a token validator turns into which verdict, and what it throws instead.

## Report

- A renamed or removed export or option, a narrowed parameter type, or a changed default, without a breaking-change PR title (`feat!:`, `fix!:`).
- A raised peer dependency range or Node engine without a breaking-change PR title.
- A change to what a tool result looks like on the wire, or to the annotations a tool is registered with, without the clients it affects and the servers it reaches named in the description.
- Arguments reaching a log by default. Write tools carry user content in their arguments.
- A `./testing` suite changed so it fails on tools the servers already have, without saying which.
- `README.md` out of step with the change.

## Fine

- New exports and new optional options (additive) in a `feat:` PR.
- Internal modules not reached from any barrel.
