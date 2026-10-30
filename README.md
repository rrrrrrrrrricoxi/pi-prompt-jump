# Prompt Jump

**Find your prompts. Keep your place. Leave the conversation untouched.**

Prompt Jump adds a one-line sticky prompt strip and keyboard navigation to Pi's fullscreen conversation. It scrolls the displayed branch; it does not resend a prompt, fork a session, change model context, or edit history.

> v0.3.0 candidate, licensed under MIT.
> **Fullscreen only. Tested on Pi 1.3.0 and 1.4.0.**
> Compatibility checks use the required native card, layout, and scroll capabilities instead of an exact Pi version. See [TEST-RESULTS.md](TEST-RESULTS.md) for evidence and limits.

## Features

- Jump to the previous or next user prompt with **Alt+Shift+↑ / ↓** (Option on macOS).
- Pick a prompt with `/prompt-jump list`.
- See the prompt at or above the viewport in a sticky strip; click it to jump to its beginning.
- Recognize native skill invocations and label matching prompt templates by slash-command name.
- Recompute positions from rendered heights, including wrapped text, collapsed/expanded prompt templates, and expanded tool groups.

## Install

Install with npm:

```sh
pi install npm:pi-prompt-jump@0.3.0
```

Or install from GitHub:

```sh
pi install git:github.com/rrrrrrrrrricoxi/pi-prompt-jump@v0.3.0
```

Requires **a compatible Pi fullscreen renderer** (tested on 1.3.0 and 1.4.0). Installation adds the package to your Pi settings. Do not enable it alongside the original sticky-prompt-strip addon: they share commands and layout integration.

The `pi-package` keyword makes the npm package eligible for Pi's official catalog. Catalog indexing can lag behind publication.

## Try the source without installing

From this directory, start a **separate** Pi invocation with only this extension:

```sh
pi --no-extensions --extension ./index.ts --tui-mode fullscreen
```

This does not add the package to your settings. Other normally discovered extensions are disabled for that invocation. Do not load Prompt Jump alongside the original sticky-prompt-strip addon: they own the same navigation commands and layout integration.

Source repository: [rrrrrrrrrricoxi/pi-prompt-jump](https://github.com/rrrrrrrrrricoxi/pi-prompt-jump). npm package: [pi-prompt-jump](https://www.npmjs.com/package/pi-prompt-jump).

## Commands

| Command | Action |
| --- | --- |
| `/prompt-jump on` | Enable the strip |
| `/prompt-jump off` | Disable the strip and restore the previous layout |
| `/prompt-jump status` | Report preference and whether the strip is mounted |
| `/prompt-jump list` | Prompt picker; Escape cancels |

Use `/prompt-jump [on | off | status | list]`. The bare command shows this short usage text; it opens no menu. Argument completion suggests these four options and filters them by the typed prefix.

Shortcuts depend on your terminal forwarding modified arrow keys. If the terminal or OS intercepts them, use `/prompt-jump list`. Editor focus is not moved by a strip click. Use Pi's native Ctrl+End to return to the bottom and follow new output.

## Compatibility and limits

This integration uses public layout/scroll operations and inspects native mounted roots and user/skill card shapes. Those shapes are integration details, not a stable transcript-navigation API. The adapter checks the capabilities it uses before changing the layout. Unsupported hosts retain their layout; `/prompt-jump status` reports the missing capability or renderer condition. Passing these checks on another Pi release does not guarantee compatibility with all its behavior. Regular terminal mode, RPC, JSON, and print modes do not offer navigation. Settings/status commands remain available.

- Only prompts represented by recognized text/skill components in the currently displayed branch are navigable. Image-only prompts are not indexed.
- The strip is hidden below eight terminal rows.
- Session switches and tree navigation invalidate an open prompt picker.
- Root replacement by another extension can unmount the strip. Check `/prompt-jump status`; `/prompt-jump on` attempts to mount again. Cleanup never overwrites a foreign replacement root.
- Collection walks and renders the displayed component tree to calculate positions. In a synthetic benchmark, warm collection medians were about 1.2 ms at 1,000 prompts and 8.1 ms at 5,000 prompts; cold collection/resize reached hundreds of milliseconds at 5,000 prompts. These are local fixture measurements, not complete frame timings or a performance guarantee. See [TEST-RESULTS.md](TEST-RESULTS.md).
- Template recognition is conservative and heuristic: it reads registered prompt-template files, ignores short/dynamic-only templates, and matches fixed segments. An unrecognized template shows its first text line instead.

The isolated `host.ts` adapter checks native card identities/shapes and the required UI exports and renderer methods. Missing exports disable mounting without a startup error. Prompt Jump does not replace component render methods. It measures the final rendered cards, including compact-renderer wrappers, and preserves foreign roots during cleanup.

No Pi installation files are patched. No runtime dependencies are bundled; Pi supplies its own host modules.

## Local state and privacy

Prompt Jump reads displayed prompt text in memory and registered prompt-template files. It displays first-line labels in the terminal; those labels may appear in screenshots or terminal recordings.

The extension makes no network requests and registers no model tools. Only an on/off preference is persisted, at `pi-prompt-jump.json` in `PI_CODING_AGENT_DIR` (normally `~/.pi/agent`). This is separate from the original addon's preference file. Session content and navigation bookmarks are not written to that file.

As with every Pi extension, it runs with the host process's permissions; these design limits are not a sandbox.

## Tests

Run tests from the source checkout; the distributable package omits the test harness. Tests use an **already installed compatible Pi** and its real components/themes, with a simulated fullscreen root/terminal and isolated temporary preferences. No dependency installation or model call is needed.

Tests select an explicit package path (`PI_INSTALL_ROOT` or the first argument), `PI_RUNTIME`, a local dependency, the managed installation selected by `~/.pi/agent/install/current-version`, or the tracked `~/.local/state/pi-config/current/runtime`, in that order. Both hoisted and nested host dependencies are supported:

```sh
npm test
```

Otherwise supply the installed package directory (the directory containing Pi's `package.json` and `dist/`):

```sh
npm test -- /path/to/installed/pi-coding-agent
```

Coverage includes missing-export startup, missing methods, unsupported renderer shapes, unchanged capabilities under an arbitrary version label, navigation, wrapped/Unicode text, ANSI sanitization, skill anchors, real light/dark/system themes, truecolor/256-color widths, click focus behavior, shortcuts, four-argument completion without side effects, bare usage without a modal, preferences, picker invalidation, lifecycle cleanup, layout ownership, and unsupported renderer guards.

Additional source-checkout tests run the actual installed CLI in an isolated POSIX pseudo-terminal and measure rendered-component collection:

```sh
npm run test:terminal -- /path/to/installed/pi-coding-agent
npm run test:benchmark -- /path/to/installed/pi-coding-agent
npm run test:package -- /path/to/installed/pi-coding-agent
```

The package test creates an offline npm archive, checks its exact file list, extracts it, and reruns the terminal suite against the shipped entry without installing dependencies.

The optional coexistence suite uses the sibling `compact-tool-renderers` source checkout, or an explicit `PI_COMPACT_RENDERER_PATH`:

```sh
PI_COMPACT_RENDERER_PATH=/path/to/compact-tool-renderers npm run test:coexistence
PI_COMPACT_RENDERER_PATH=/path/to/compact-tool-renderers npm run test:terminal
```

The legacy component coexistence fixture targets the older renderer registration API and currently fails with the current Fold source (`resolver is not a function`). It does not establish current Fold compatibility. The terminal option loads both extensions into the isolated real CLI; current Fold integration requires separate preview validation. These checks do not cover every third-party extension.

The terminal suite requires Python 3 on a POSIX system. It uses temporary HOME/settings/session directories, a local deterministic streaming fixture, and a fail-closed network guard—no real provider credentials or model calls. The fixture/probe is excluded from the extension manifest and npm file list. It verifies actual CLI keyboard/mouse routing, resize, reload, session/tree navigation, and a 1,000-prompt session. It does not prove OS shortcut forwarding, physical trackpad behavior, every terminal application, or third-party extension compatibility.

See [TEST-RESULTS.md](TEST-RESULTS.md) for observed results and [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) for publication gates.

## Distribution

`package.json` declares a Pi extension entry and the `pi-package` keyword. According to [Pi's package documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md), the keyword makes an npm package eligible for discovery in the [official package catalog](https://pi.dev/packages). A GitHub-only release is installable via Git but is not the documented catalog route.

The manifest declares MIT (see [LICENSE](LICENSE)). The release includes no runtime dependencies or test-only provider code.
