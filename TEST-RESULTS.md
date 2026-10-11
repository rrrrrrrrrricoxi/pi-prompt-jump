# Test results — v0.1.0

Tested locally on macOS with Node.js v26.11.1 and installed Pi 1.1.0. No package was published or installed into the active user configuration during testing.

## Component and handler tests

`npm test -- /path/to/installed/pi-coding-agent` passed against real Pi user/skill components and themes with a simulated fullscreen root. Coverage includes rendered-height targets, Unicode/wrapping, ANSI label sanitization, light/dark/system themes, truecolor/256-color widths, shortcut decoding/handlers, template labels/precedence, picker cancellation/invalidation, preference-save failures, no-UI guards, and layout ownership/cleanup.

## Real CLI pseudo-terminal smoke test

`npm run test:terminal -- /path/to/installed/pi-coding-agent` passed. This runs the installed Pi CLI in a POSIX pseudo-terminal, with temporary HOME/settings/session directories and only the package plus a test-only deterministic provider/probe.

Verified through terminal input and observation of the actual mounted layout:

- Fullscreen startup and exactly one mounted root.
- Three streamed synthetic responses; follow-end behavior, a jump while streaming, stable scroll position while output grows, and return to following.
- Alt+Shift+Up/Down using xterm modified-arrow sequences and `/prompt-jump back`.
- Prompt-picker selection and Escape cancellation.
- SGR mouse press/release on the strip without changing editor focus or unsubmitted text.
- SIGWINCH resizing at 40×12, 100×36, and 80×24; jump targets recomputed correctly.
- On/off preference persistence and actual `/reload` without duplicate roots.
- `/new`, `/resume`, and `/tree` navigation with correct anchors and bookmark invalidation.
- Import of a synthetic 1,000-prompt / 2,000-message session, picker selection, first/last jumps, and resize.
- `/quit` shuts down cleanly with exit status zero.

All four generated assistant responses were produced by the local fixture with zero model tokens. A preloaded network guard rejects fetch, socket connections, and ordinary DNS lookup; it remained silent. Provider credentials are not passed into the child. The fixture/probe is not included in the published package manifest or npm file list.

This is automated PTY testing, **not** a manual test in every terminal application. OS shortcut interception, physical trackpad behavior, tmux/SSH forwarding, Windows, and combinations with third-party layout extensions remain unverified. The component suite verifies cleanup when a foreign root replaces the layout, but this is not blanket compatibility with every extension.

## Shipped package validation

`npm run test:package -- /path/to/installed/pi-coding-agent` passed. It creates the npm archive locally with offline mode and lifecycle scripts disabled, checks the exact ten-file allowlist and MIT/extension manifest, extracts it into a temporary directory, and reruns the complete actual-CLI smoke suite against the **extracted package entry**, not the source checkout. No dependencies are installed. The test-only provider/probe remains in the source checkout and is not shipped.

## Synthetic long-session benchmark

`npm run test:benchmark -- /path/to/installed/pi-coding-agent` used real Pi user and assistant components with repeated prose and fenced code blocks, at 80 columns. Each case contains two messages per prompt. Warm figures summarize 30 sequential observations; cold and resize figures each come from one observation.

| Prompts / messages | Rendered rows | Warm collection median | Warm collection p95 | Cold collection | Resize to 40 columns |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 / 200 | 3,200 | 0.08 ms | 0.26 ms | 31 ms | 11 ms |
| 1,000 / 2,000 | 32,000 | 0.61 ms | 4.6 ms | 92 ms | 70 ms |
| 5,000 / 10,000 | 160,000 | 5.6 ms | 9.1 ms | 357 ms | 254 ms |

These measure prompt collection, **not complete terminal-frame latency**. For comparison, warm document-render medians were approximately 0.10, 0.50, and 4.7 ms respectively. Prompt collection renders components and relies on their caches; it can add work to an ordinary frame. Cold collection includes initially uncached component rendering, so these timings cannot be attributed solely to this extension.

Conclusion: navigation was functional in the actual CLI at 1,000 prompts. Cached collection was inexpensive in this synthetic fixture, but very large-session startup/resize can visibly pause. No worst-case guarantee is claimed for tools, images, complex Markdown, larger payloads, other machines, or concurrent load.

The benchmark records every warm observation and unrounded summaries in local `test-results/performance.json`; that generated directory is ignored by Git and excluded from the npm package. Re-run the benchmark to reproduce measurements rather than treating this table as a universal performance promise.

## Release verification boundaries

- GitHub/npm publication was explicitly approved; credentials are not included in the repository or package.
- A short demo is optional release polish; it has not been recorded.
- Registry artifact and catalog discovery checks are separate post-publication steps; the local tests above do not establish either one.
- Installation into the active user configuration is not part of these tests.
