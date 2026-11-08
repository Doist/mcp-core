# Check: security

Every Doist MCP server runs this code for every tool call, with the user's token in the context it builds. Apply to changes in `src/`.

## Report

- A token, `Authorization` header or tool argument written to a log, an error message or a tool result by default. The default `onError` logs the tool name and the error, never the arguments.
- An error message built from a thrown value without going through the server's `formatError`, so an upstream response body or header can reach the model.
- A tool registered without the validation the SDK runs on its input schema, or a callback that widens `args` before the SDK has validated them.
- Output that skips `removeNullFields`, or a verbatim key added by default, so data a server meant to strip reaches the client.

## Fine

- Logging tool names, error messages, durations and counts.
- Test fixtures with fake tokens and invented content.
