# Release checklist — v0.3.0

## Package checks

- [x] Replace the exact-version gate with required capability and shape checks. Missing exports and unsupported layouts fail safely with a useful status.
- [x] Verify real Pi 1.3.0 and managed Pi 1.4.0 components, themes, navigation, preferences, and lifecycle cleanup.
- [x] Verify compatible APIs under an arbitrary version label. This fixture does not guarantee future compatibility.
- [x] Run actual-CLI PTY checks on Pi 1.4.0 with isolated state, a deterministic local provider, and a network guard. Pi 1.3.0 CLI evidence predates the four-action interface; its final component suite passed.
- [x] Complete the offline pack/extract check and actual-CLI suite against the extracted candidate on Pi 1.4.0.
- [x] Review the final diff and updated evidence in TEST-RESULTS.md.

## Parent integration and release

- [x] Verify current Fold integration with `/prompt-jump [on | off | status | list]` in isolated actual-CLI PTY previews on both reviewed hosts. Final four-action checks passed. The old component coexistence fixture uses an obsolete renderer registration API and cannot establish this result.
- [x] Complete live user acceptance of the four-action command interface (2026-10-30, both reviewed hosts).
- [ ] Confirm the release decision and GitHub author/auth route; preserve saved accounts.
- [ ] Commit, tag, push, and publish only through the parent release workflow.
- [ ] Verify published metadata and compare the registry artifact with approved source. Catalog indexing is a separate check.
- [ ] Update the authoritative Pi configuration and verify the staged installation on both hosts through the parent workflow.
- [ ] Verify physical terminal/OS shortcuts and mosh/tmux forwarding. Automated PTY checks do not establish these results.

Package tests and user review are complete. Publication and installation receipts are recorded separately. Keep credentials, private content, generated fixtures, and machine-specific paths out of the release.
