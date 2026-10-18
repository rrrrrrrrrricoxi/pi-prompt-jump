# Release checklist — v0.2.0

## Local compatibility checks

- [x] Use the existing `pi-prompt-jump` package and `rrrrrrrrrricoxi/pi-prompt-jump` repository with MIT licensing.
- [x] Verify native Pi 1.3.0 user/skill cards, final rendered heights, fullscreen viewport, and layout cleanup. Retain an explicit version/shape guard.
- [x] Run native component/handler checks with isolated preferences and no model/history mutation APIs.
- [x] Run real-CLI PTY checks with a deterministic local provider and fail-closed network guard, including reload, picker, click, resize, session/tree changes, and 1,000 prompts.
- [x] Check both loading orders with compact-tool-renderers, native collapsed/expanded prompt/thinking/tool heights, independent shortcuts, and cleanup ownership.
- [x] Benchmark 100, 1,000, and 5,000 synthetic prompts; record sample sizes and cold/resize limits in TEST-RESULTS.md.
- [x] Pack offline, verify the exact eleven-file allowlist, extract, and rerun the CLI suite against the extracted entry. Tests/provider fixtures are excluded.

## Parent integration and release

- [ ] Review the final diff and package evidence. Verify the personal GitHub author/auth route without changing saved accounts.
- [ ] Commit the approved source, create `v0.2.0`, and push the release through the established account/proxy route.
- [ ] Publish `pi-prompt-jump@0.2.0`; run `npm run test:package -- /path/to/pi-coding-agent --published` to compare the registry artifact with source.
- [ ] Pin `npm:pi-prompt-jump@0.2.0` (or the exact `v0.2.0` Git release) in the authoritative Pi installation configuration; avoid loading the original sticky-prompt-strip addon concurrently.
- [ ] Verify public release/registry metadata and catalog discovery separately. Catalog indexing is not guaranteed by publication.
- [ ] Stage and verify the tracked installation on MacBook and CCC. Activate only through the parent task's existing guards.
- [ ] Verify physical terminal/OS shortcut forwarding and mosh/tmux operation with harmless records. Automated PTY checks do not establish these results.

This compatibility task prepares source only. It does not publish, install, or activate the package. Keep credentials, private content, generated fixtures, and machine-specific paths out of the release.
