# Changelog

All notable user-visible changes are recorded here. Versions follow the separate contracts explained in
[`docs/release-process.md`](docs/release-process.md).

## [Unreleased]

- Added a single-architect operating guide and a dashboard review with explicit outstanding manual
  accessibility/visual release checks. Corrected the dashboard phase-heading hierarchy.

- Reject decisions timestamped before either final review, including historical gate checks.
- Require complete case context and fresh evidence checks for direct signing calls; validate
  proposed decisions before writing while retaining ordered upstream-to-downstream recovery.

- Restyled the architect approval dashboard to match `agentic-architecture-v2.html`: embedded
  typography, dark palette, navigation, hero metrics, and separate numbered phase cards.

### Added

- Local architect dashboard: `npm run render -- approvals --case cases/<case-name>` shows all readable
  decisions, current phase state, recorded blockers, recommendations, and validation diagnostics.
- Shared lifecycle state and regression coverage for reopened phases, historical phase entry,
  signing-key continuity, immutable reapproval, ordinary application JSON, and damaged journals.
- Read-only `npm run doctor` setup diagnostics. Host model availability and presentation tooling remain
  explicit manual checks.
- `npm run demo:approvals` generates a complete synthetic Phase 0–6 contract fixture with a historical
  rejection, later approvals, and both local overviews. It does not execute application tests or DECKIO.
- CI configuration for Linux, Windows, and macOS on Node 22 and 24; execution of that matrix occurs in CI.

### Fixed

- Dashboard phase cards no longer inherit the phase document's fixed grid cell; cards have independent
  responsive placement, readable spacing, and a single-column narrow-screen layout.
- Fingerprints now derive from verified Ed25519 keys; invalid signatures fail closed and rotations
  advance the active key after checking the previous fingerprint and reason.
- New approvals and rejections use unique files with exclusive creation, preserving earlier decisions.
- Approval preparation no longer broadly suppresses evidence failures and rejects approval of DIVERGES.
- Reopenings and blockers withdraw predecessor gates; later approvals do not legitimise premature entry.
- Application/source JSON no longer requires AFF fields; malformed JSONL receives line diagnostics.
- Model availability and signed, hash-bound substitution evidence are checked.

Existing-case guidance: [approval integrity migration](docs/migrations/approval-integrity.md).
Phases 7–8 remain fail-closed pending scoped execution contracts; no live deployment is added here.

## [1.1.0] - 2026-09-04

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
- Signed human approvals. `npm run identity:create` creates one passphrase-protected Ed25519 key per
  architect, outside any case. `npm run approve -- --case <path> --phase <id>` presents the artifact
  hashes and both final reviewer verdicts, refuses decisions the evidence does not support, and writes a
  signed record. Approvals and rejections are both signed.
- Signature continuity: once a case holds a verified decision every later decision must also be verified,
  and a decision signed by a different key is rejected unless it records an explicit `keyRotation`.
- A per-machine approval policy. Creating an architect identity sets `requireSignedApprovals`, so an
  unsigned real decision is rejected on that machine. Without it an agent never needed to forge a
  signature: it could write an unsigned approval and have it accepted as `self-asserted`. Machines with
  no identity are unaffected, and synthetic harness evidence is always exempt.

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
