---
name: verify
description: Proves a change works before it is called done, and reports the evidence on a ladder from "said" to "ran". Use when you are about to say "done", "fixed", "works" or "ready", when asked to check or test a change, or before opening a pull request.
---

# Verify a change

## 1. Run the checks

```bash
npm run verify
```

It runs every check CI runs (about five seconds) and records the pass. Fix every failure; never weaken a check to pass it. Done when it prints `Verified.`, or says only docs changed and only their formatting was checked.

## 2. Prove the change itself

The checks prove nothing broke. Now prove the change does what was asked, with the proof its kind needs:

| Change                               | Proof                                                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A module's behaviour                 | A test next to the module that calls the exported function and fails without the change. Undo the change once and see it fail.                                               |
| Tool registration or a tool result   | A test that registers a tool on a real `McpServer` and calls it through an in-memory client (see `src/register-tool.test.ts`).                                               |
| The public API (exports, signatures) | `npm run verify` type-checks every barrel; a new subpath also needs its `package.json#exports` entry and a row in `src/subpath.test.ts`. `README.md` describes the change.   |
| The package as an MCP server sees it | `npm run build && npm pack`, install the tarball in one of the servers that depend on this package (`npm install --no-save <tarball>`), and run its tests. Say which server. |
| What a real client shows             | Only **seen** by connecting a client (the MCP Inspector, Claude, ChatGPT) to a server built against this change; say so if you didn't.                                       |
| Agent tooling (`.agents/scripts`)    | Its tests in throwaway repos, plus one real run of the hook or command.                                                                                                      |
| Docs only                            | Every path and command named exists (`ls`, `npm run`).                                                                                                                       |

Check the proof can fail: undo the change and see the test fail, or run the scenario that used to break. Done when you have seen it fail and then pass. A refactor is the exception: its proof is the pinned tests passing before and after (see `refactor`).

## 3. Report the evidence

Rate every claim on this ladder:

1. **said:** stated without looking.
2. **cited:** the line that shows it (`path:line`).
3. **traced:** followed the code path through each call.
4. **ran:** a test or command executed the code and showed the result.
5. **seen:** observed in an MCP server built against this change, through a real client.

Claims about behaviour ("fixed", "works", "safe", "no regressions") need **ran** or higher. A fact the code shows needs **cited**. Anything lower goes under **Not verified**, with why.

Every export is code the MCP servers rely on. For a change to one, name the one fact that makes it safe for them, and how you proved it.

Report format:

```
What changed: <one line>
Verified:
- <claim> — ran: <command or test>, <what it showed>
Not verified:
- <claim> — <why>
Safe because: <the one fact>, <how you proved it>   (for a change to an export)
```
