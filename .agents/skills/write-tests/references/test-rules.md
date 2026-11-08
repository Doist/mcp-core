# Test rules

Each rule says what to flag and what is fine, because a rule that flags good tests teaches agents to damage them.

## 1. It can fail

You saw the test fail once: before the fix, or with the feature undone. A test that has never failed may be testing nothing.

## 2. It asserts outcomes

Assert what the caller gets or what reaches the boundary: the `CallToolResult` the client receives, the tool listing, `toHaveBeenCalledWith(<exact args>)`, the exact log line. Flag an assertion that cannot tell right from wrong.

| Flag                                                                                                 | Fine                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toHaveBeenCalled()` as the only evidence the behaviour happened: nothing checks arguments or output | `toHaveBeenCalledTimes(n)` next to assertions on the arguments or output (`src/register-tool.test.ts:139`)                                              |
|                                                                                                      | `.not.toHaveBeenCalled()`: proves a call did **not** happen, such as the default log when a custom `onError` is given (`src/register-tool.test.ts:188`) |
| `toBeDefined()` / `toBeTruthy()` as the last word on a value                                         | The same as a guard right before reading the value's fields (`src/subpath.test.ts:19`)                                                                  |
| A test whose only assertion is that no error was thrown, when the behaviour is a result              | `resolves.not.toThrow()` when accepting the input **is** the behaviour                                                                                  |

Judge a test by its point, the behaviour its name describes. A weak assertion beside the ones that carry that point is fine.

## 3. Expected values come from outside the code under test

Write the expected value out as literals (a lookup table or `it.each` rows are fine): the JSON text block as a string, the advertised schema as an object. Flag an expectation that calls the code under test, or recomputes the answer the way the code does. Calling Zod or the MCP SDK for an expected value is fine where they are not what is under test, as in the `./testing` suites, whose point is that the server matches Zod.

## 4. Mock only real boundaries

The boundaries here: the network, environment variables, `console` (to assert what is logged and keep test output quiet), and the context a server builds per call (an API client stub passed through `createContext`).

| Flag                                                                                         | Fine                                                                                   |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A **new** `vi.mock` of an internal module that holds logic, to make setup easier             | A `vi.fn()` API client handed to tools through `createContext`                         |
| A stubbed `McpServer` whose `registerTool` calls are inspected, where a real server would do | A real `McpServer` and `Client` over `InMemoryTransport` (`src/register-tool.test.ts`) |
| Mocking the function the test is about, or one that computes its expected value              |                                                                                        |

## 5. No skipped or focused tests

None exist. `.only` fails in CI (`CI=true`, which `npm run verify` sets too). Don't add `.skip`, `.todo` or `xit` to get green. Fine: `skipIf`/`runIf` for a platform, a missing tool or a missing build, with the reason in a comment (`src/subpath.test.ts:26`).

## 6. No fake timers

There are none here. Wait on the event, or use `vi.waitFor`.

## 7. No snapshots

None exist: tests assert exact values and output strings. Keep it that way. A new snapshot records whatever the output is the first time it runs, so it proves nothing about what it should be.

## 8. Reading source files is for contracts

Fine: a test that reads source or config to enforce a rule across the package (`src/subpath.test.ts` reads `package.json#exports`). Flag a test that reads a source file to check one function's behaviour; call the function instead.

## 9. No real user data

Fixtures use invented content and `example.com`. This repository is public, and `src/testing/` ships to every MCP server.
