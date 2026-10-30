# Test results — v0.3.0 candidate

Tested locally on macOS with Node.js v26.11.1 on 2026-10-30. Tests used the installed managed Pi 1.4.0 and a retained Pi 1.3.0 runtime. No package was published or installed into the active user configuration.

## Current evidence

| Check | Pi 1.3.0 | Pi 1.4.0 |
| --- | --- | --- |
| Native component and extension-handler suite | Passed | Passed |
| Real CLI pseudo-terminal suite | Passed before four-action interface | Passed |
| Offline npm archive, exact eleven-file allowlist, extracted-entry CLI suite | Not rerun | Passed |

Commands: `npm test -- /path/to/pi-coding-agent`, `npm run test:terminal -- /path/to/pi-coding-agent`, and `npm run test:package -- /path/to/pi-coding-agent`. Plain `npm test` also passed and selected the current managed Pi 1.4.0. Tests load real host modules; component tests simulate the fullscreen root and terminal.

The component suite verifies missing native/UI exports, missing native and renderer methods, incompatible scroll shapes, and unchanged capabilities under the synthetic release label `77.88.99-fixture`. Unsupported mounts leave the existing root unchanged. The synthetic label proves that version text alone does not decide compatibility; it does not test a future Pi release.

Existing checks also passed: final rendered heights, Unicode/wrapping, ANSI sanitization, native skill anchors, real light/dark/system themes, truecolor/256-color widths, shortcuts, prompt templates, picker cancellation and branch invalidation, preference-save failures, no-UI guards, layout ownership, reload, and cleanup. The command suite checks one registered slash command with no old alias, only the four `/prompt-jump` arguments, prefix-filtered asynchronous completion without side effects, bare usage without a modal, rejected extra subcommands, status, On/Off persistence, prompt-picker selection/cancellation, branch invalidation, and useful unsupported-renderer status.

The actual-CLI PTY suite verifies bare `/prompt-jump` usage without a modal, real Tab argument completion, status, prompt picker and cancellation, startup, streaming/follow-end, modified arrows, native Ctrl+End, prompt selection/cancellation, mouse clicks without focus/text loss, resize, On/Off persistence, `/reload`, `/new`, `/resume`, `/tree`, and a 1,000-prompt / 2,000-message fixture. Every generated response came from the deterministic local provider with zero model tokens. Temporary HOME/settings/session directories isolate test state; the fail-closed network guard stayed silent. The package check repeats this suite against the extracted archive entry. No provider/probe test code is shipped.

## Current Fold preview — parent verification

Earlier parent previews passed with Pi 1.4.0 and Fold 3.1.0 on MacBook and CCC, but they predate the current four-action interface. The parent task must rerun integration checks for this interface. Physical visual acceptance by the user remains pending. These previews do not establish both extension loading orders or repair the legacy component fixture.

## Limits and outstanding integration

- The optional legacy `tests/coexistence.mjs` fails with the current sibling Fold source at its obsolete renderer registration assumption: `resolver is not a function`. The fixture is unchanged. This result does not establish current Fold compatibility; the separate parent preview evidence is recorded above.
- Passing capability checks does not guarantee behavior on every Pi release. The adapter still inspects native card identities and layout shapes.
- Automated PTY input does not establish physical OS/terminal shortcut forwarding, trackpad behavior, mosh/tmux forwarding, Windows support, or compatibility with every third-party layout extension.
- No benchmark was rerun for v0.3.0. Historical measurements below describe an older synthetic fixture.
- Commit, tag, push, publication, installation, active Pi configuration changes, registry artifact comparison, and catalog discovery are outside this package task.

## Historical benchmark — v0.2.0, Pi 1.3.0

These measurements were recorded for v0.2.0. They were not rerun for this candidate.

`npm run test:benchmark -- /path/to/installed/pi-coding-agent` used real Pi user and assistant components with repeated prose and fenced code blocks, at 80 columns. Each case contains two messages per prompt. Warm figures summarize 30 sequential observations; cold and resize figures each come from one observation.

| Prompts / messages | Rendered rows | Warm collection median | Warm collection p95 | Cold collection | Resize to 40 columns |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 / 200 | 3,200 | 0.15 ms | 0.31 ms | 30 ms | 7.3 ms |
| 1,000 / 2,000 | 32,000 | 1.2 ms | 2.6 ms | 89 ms | 52 ms |
| 5,000 / 10,000 | 160,000 | 8.1 ms | 9.8 ms | 371 ms | 249 ms |

These measure prompt collection, **not complete terminal-frame latency**. For comparison, warm document-render medians were approximately 0.07, 0.47, and 3.0 ms respectively. Prompt collection renders components and relies on their caches; it can add work to an ordinary frame. Cold collection includes initially uncached component rendering, so these timings cannot be attributed solely to this extension.

Conclusion: navigation was functional in the actual CLI at 1,000 prompts. Cached collection was inexpensive in this synthetic fixture, but very large-session startup/resize can visibly pause. No worst-case guarantee is claimed for tools, images, complex Markdown, larger payloads, other machines, or concurrent load.

The benchmark records every warm observation and unrounded summaries in local `test-results/performance.json`; that generated directory is ignored by Git and excluded from the npm package. Re-run the benchmark to reproduce measurements rather than treating this table as a universal performance promise.

## Final interface acceptance — 2026-10-30

Both reviewed hosts passed the actual-terminal four-action preview with Pi 1.4.0 and Fold 3.1.0: bare usage without a modal, status, prompt picker, on/off, previous/next shortcuts, and Fold on/off. The user accepted both previews and the native four-option completion presentation. This does not establish support for every terminal or future Pi release.
