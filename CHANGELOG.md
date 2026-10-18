# Changelog

## 0.2.0 — 2026-10-18

- Adapt fullscreen navigation to the tested Pi 1.3.0 native user/skill cards and chat viewport.
- Isolate host compatibility and use native component identity/shape checks. Unknown hosts retain their layout; unknown cards retain their rendered height.
- Measure final compact/expanded prompt, thinking, and tool cards without replacing their render methods. Verify both loading orders with compact-tool-renderers and preserve its adapters during strip cleanup.
- Support hoisted and nested Pi test dependencies, explicit runtime paths, and the tracked runtime default.
- Rerun native component, real CLI/PTY, packed-artifact, and synthetic-session checks against Pi 1.3.0. Pi 1.1.0 users can retain v0.1.0; v0.2.0 mounts only on Pi 1.3.0.

## 0.1.0 — 2026-10-12

- Extract prompt navigation and the sticky strip into a self-contained Pi package.
- Include prompt-template recognition locally instead of importing a sibling addon.
- Use a separate `pi-prompt-jump.json` preference file.
- Carry forward rendered-height navigation, keyboard shortcuts, prompt picker, return position, and layout cleanup.
- Retain an explicit Pi 1.1.0 fullscreen compatibility boundary.
