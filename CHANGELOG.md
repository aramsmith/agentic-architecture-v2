# Changelog

All notable user-visible changes are recorded here. Versions follow the separate contracts explained in
[`docs/release-process.md`](docs/release-process.md).

## [Unreleased]

### Added

- A `phase-sequence` contract invariant. Case validation now enforces lifecycle order from the records
  themselves: a phase cannot be entered, evidenced, or approved until its predecessor holds an approved
  human decision, and approval instants must follow lifecycle order.
- Fail-closed handling for Phase 7 and Phase 8 prerequisites that have no catalogued record type
  (`scoped-attempt-authorisation`, `scoped-test-attempt-authorisation`, and `phase-7-succeeded`).

### Changed

- The Contoso smoke harness now names the contract invariants that failed instead of reporting a
  generic validation message.

## [1.0.0] - 2026-09-04

### Added

- A ten-minute, offline architect evaluation path with explicit Copilot and Azure boundaries.
- Compatibility, support, troubleshooting, release, and migration guidance.
- Deterministic lifecycle-derived README and website roster generation with drift checks.
- A generated, verified Contoso Phase 0 evidence snapshot that is explicitly not a real approval.
- Practical installation and operating guidance on the self-contained public website.

### Changed

- Repository validation now checks generated adoption content and related accessibility/security
  invariants.
