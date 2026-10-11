# Release checklist

## Before publication

- [x] Choose `pi-prompt-jump` as the package/repository name. Approved GitHub owner: `rrrrrrrrrricoxi`; approved npm package: `pi-prompt-jump`.
- [x] Check public name endpoints (2026-10-12): GitHub repository and npm registry entry returned 404. Availability remains provisional until creation/publication succeeds.
- [x] User confirmed redistribution rights and approved MIT; license text included.
- [x] Limit v0.1.0 to Pi 1.1.0 fullscreen. Do not remove the version guard without new tests.
- [x] Component tests passed against installed Pi 1.1.0. Local offline npm archive validation checks the exact ten-file allowlist, MIT license, and extension entry; the complete actual-CLI smoke suite also passed against the extracted archive. Test-only fixtures are excluded.
- [x] Automated real-CLI PTY smoke test passed: fullscreen startup, scrolling, picker cancellation, shortcuts, click focus, fixture streaming, resize, session switching/tree navigation, on/off, reload, and 1,000-prompt import/navigation. This is not a manual test of every terminal application.
- [x] Benchmark synthetic long sessions at 100, 1,000, and 5,000 prompts; record cold/resize latency and all 30 warm samples per case. See TEST-RESULTS.md.
- [ ] Optional compatibility expansion: test physical terminal/trackpad/OS forwarding and combinations with third-party layout extensions. Do not claim these are verified.
- [ ] Optional release polish: record a short demo with synthetic prompts only; inspect for private paths, content, and credentials.
- [x] Review the explicit public source/test/document allowlist; exclude generated test data and check for obvious credentials/local absolute paths. Packed-file allowlist is verified by the package test.
- [x] Add final repository metadata and release date (2026-10-12).

## Explicit approval gates

- [x] User approved public GitHub repository creation and source upload to `rrrrrrrrrricoxi/pi-prompt-jump`.
- [x] User approved publishing `pi-prompt-jump@0.1.0` to the public npm registry.
- [x] Replace `UNLICENSED` with the approved MIT license.
- [x] Remove `private: true` after final publication approval and release checks.
- [ ] Tag the approved version, publish, and verify both installation and catalog discovery afterward. Catalog appearance is not guaranteed merely by setting a keyword.

## Publication verification

Verify the public GitHub tag, npm registry metadata/artifact, and catalog entry after publishing. Treat registry publication and catalog indexing as separate checks. No active-user package installation is part of this release workflow. Never put credentials in this repository or chat.

