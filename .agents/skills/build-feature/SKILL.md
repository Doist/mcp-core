---
name: build-feature
description: Builds a new module, export, option or behaviour in thin test-first slices, after settling the open decisions with the owner. Use when asked to "add", "build", "implement", "support" or "create" something, such as a new export, a new hook on the tool registrar or a new `./testing` suite.
---

# Build a feature

## 1. Read the closest existing feature

Find the module most like the one you are building and read it with its test: `src/register-tool.ts` for registration and its hooks, `src/tool-output.ts` for what a result looks like on the wire, `src/testing/nullable-output.ts` for a contract suite the servers run. Read `AGENTS.md` ("Module layout", "README maintenance"). Done when you can name the file you will copy patterns from.

## 2. Settle decisions in one round

List what the request leaves open: the export's name and which entry point carries it (`src/index.ts` or a subpath), its signature and options, whether it needs a peer dependency, whether it changes what clients receive, and whether the change is additive or breaking for the MCP servers that use it. Ask the owner all of them at once, each with your recommendation. Don't ask what the code can answer. Done when every decision has an answer.

## 3. Write "done" as checkable behaviours

Write each behaviour as a call and the expected result, for example: "a tool that throws returns `isError: true` with `formatError`'s text, and the default log names the tool but not its arguments". Each becomes a test. Done when a test could pass or fail on every one.

## 4. Build in thin slices, test first

For each behaviour: write its test at the module's public interface, see it fail, make it pass, run its test file. Follow `write-tests`. Done when every behaviour from step 3 has a passing test you saw fail.

## 5. Update everything the change touches

| You changed                      | Also update                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Added or changed an export       | Its barrel (`src/index.ts` or the subpath's `index.ts`), and `README.md` ("What's in it" and the usage block)               |
| A new subpath                    | `package.json#exports` (`types` and `import`), its barrel, `README.md`, and the "Public API surface" table in `CODEBASE.md` |
| A peer dependency                | `peerDependencies` and `peerDependenciesMeta` in `package.json`, and the install notes in `README.md`                       |
| A suite the servers' tests run   | `src/testing/` and its barrel; it ships in the `./testing` subpath                                                          |
| Structure (new folder or module) | `CODEBASE.md`                                                                                                               |

Done when each row that applies is handled.

## 6. Verify and report

Follow `verify`. A change the MCP servers will feel deserves one of their test suites run against a packed build: say which. If the feature needs restructuring first, do that as a separate change with `refactor`.
