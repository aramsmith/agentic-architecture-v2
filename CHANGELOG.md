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
- A `tool-least-privilege` invariant. Agent capability grants are now enforced: `read` is mandatory,
  only supported capabilities are accepted, every namespaced MCP grant must match a server and tool
  declared in the same profile, and **AFF-A and AFF-B may never hold `execute` or `agent`**.
- A restrictive `Content-Security-Policy` on every generated phase document and solution overview, so a
  browser blocks remote loading, framing, form submission, and base-URI rewriting even if sanitisation
  were bypassed. Phase HTML uses `script-src 'none'`.
- A `.gitattributes` file pinning text files to LF in the working tree on every platform.
- Approval assurance modes. Every approval declares `synthetic`, `self-asserted`, or `human-verified`
  in `extensions.approvalMode`, and the new `approval-mode` invariant rejects any declaration the
  recorded evidence does not support. The solution overview reports the resolved mode per phase.
- An executable assertion that the Contoso harness can only ever emit `synthetic` approval evidence.

### Changed

- The Contoso smoke harness now names the contract invariants that failed instead of reporting a
  generic validation message.
- Documentation now states plainly what an AFF approval proves: reviewer convergence on identical
  hashes and record integrity, but **not** who decided or that a human decided.
- Phase HTML states that it carries no approval of its own. Approval state and assurance live in
  `solution-overview.html`, because re-rendering a phase document after approval would change its hash
  and invalidate the approval bound to it.
- `latestApprovals` is defined once in `src/case/review-records.ts` instead of being reimplemented in
  both the approval and hash-binding validators.

### Fixed

- Skill-location validation ran once per agent Markdown file. A single misplaced skill produced twelve
  duplicate errors, and the check was skipped entirely when the agents directory held no Markdown.
- Windows checkouts rewrote text files to CRLF while the documentation generator emits LF, so
  `npm run docs:check` reported permanent false drift on the documented primary platform.

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
