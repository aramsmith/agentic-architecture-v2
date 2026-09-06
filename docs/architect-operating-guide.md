# Single-architect operating guide

One accountable architect can run the decision workflow. AFF-A and AFF-B remain separate reviewer
roles; a single human decision does not replace their final reviews. This guide covers Phases 0–6.
Phases 7–8 remain unavailable until scoped execution contracts and checks are implemented.

## Review and decide

1. Run `npm run doctor` and address setup findings. Live model and presentation-tool readiness still
   require manual checks; an offline test pass is not evidence of live-agent quality.
2. Run `npm run validate -- --case cases/<case-name>` from the full repository root.
3. Generate the dashboard with `npm run render -- approvals --case cases/<case-name>` and open
   `cases/<case-name>/approval-overview.html` locally. Regenerate after every record change.
4. Read diagnostics, phase state, recommendations and both final reviewer records. Check that both
   reviewers cover the same complete candidate. Read residual gaps and the evidence itself.
5. In your own terminal outside the agent session, create an identity with `npm run identity:create`
   if needed, then run `npm run approve -- --case cases/<case-name> --phase <id>`. Follow the prompts
   to approve or reject. Do not share the private key or passphrase with an agent.
6. Validate again and regenerate the dashboard. A decision is not permission to bypass downstream
   prerequisites, and neither a dashboard counter nor a synthetic approval grants authority.

Both final reviews must exist before the decision; decision timestamps cannot precede either review.
The signing command rechecks evidence and identity before writing. If either changed, restart the
decision process rather than reusing the earlier context. APPROVED cannot override DIVERGES.

## Rejection and reopening

- Preserve every prior decision and review. New decisions use unique filenames.
- Resolve findings, record the new candidate and obtain fresh final reviews before deciding again.
- A reopened or blocked upstream phase withdraws its gate. Repair upstream phases first, then review
  the impact and reapprove affected downstream phases in order. Intermediate diagnostics are expected;
  they do not permit downstream work to resume early.
- Historical activity before a valid gate remains a violation. The tooling has no automatic waiver;
  escalate for a reviewed recovery plan rather than rewriting timestamps or deleting history.

## Read the dashboard correctly

- Phase cards show record-derived state, not independent proof of readiness. Validation errors take
  precedence over an apparent approval.
- Counters include historical and synthetic decisions. Inspect the assurance label, decision time,
  reviewer bindings and key fingerprint before relying on a particular decision.
- Blocker entries are historical; use current phase state and diagnostics to determine outstanding work.
- The page is a static snapshot. It cannot approve, sign, deploy or update itself.

For key replacement, legacy cases and direct signing integrations, see the
[migration guidance](migrations/approval-integrity.md). Do not repair signatures by editing them.

## Release handoff checks

Before distributing the dashboard, manually check keyboard navigation and disclosure controls,
screen-reader announcements, 200% zoom, a narrow mobile viewport, and print preview. These checks
remain outstanding in this environment; see the [dashboard review](dashboard-review.md).
