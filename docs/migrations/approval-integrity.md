# Approval integrity migration and remediation

This change preserves contract 1.0.0 record shapes and existing evidence filenames. New human decisions
are written under unique names in `approvals/phase-<id>/`; consumers must discover records instead of
assuming one fixed approval filename. Never rename, edit, or delete signed history to make validation
pass. Previously overwritten decisions cannot be reconstructed by this change; recover originals from
an independently retained backup when available.

## Existing cases

Decisions must not predate either cited final review. Existing chronology violations now fail
validation; do not edit signed timestamps to silence them. Preserve the originals and escalate for
reviewed recovery where normal reapproval cannot resolve the historical error.

Direct TypeScript callers of `recordSignedDecision` must obtain a fresh `ApprovalContext` through
`prepareApproval`. `repositoryRoot` and `casePath` are now required. Incomplete or changed evidence
is rejected, and the proposed decision is validated before a file is created. Do not construct an
empty context to bypass the CLI's checks. The CLI invocation is unchanged.

1. Back up the complete local case and approval identity using your organisation's approved process.
2. Run `npm run validate -- --case cases/<case-name>`.
3. Run `npm run render -- approvals --case cases/<case-name>` and open the generated local dashboard.
4. Resolve diagnostic findings through new evidence and reviewed decisions. Do not backdate events or
   weaken lifecycle prerequisites. Historical sequencing violations require a reviewed recovery plan;
   the tooling does not automatically waive them.

A legacy self-asserted decision is readable on a machine without an approval identity, but the human
approval command requires an identity. A damaged signature is an error even if its mode is omitted.
Fingerprint declarations must agree with the signing key. A rotation names the active previous key and
its reason, then advances the active key. It does not cryptographically prove consent by a lost key.

After deliberately creating the replacement identity, record the next decision yourself with:

```text
npm run approve -- --case cases/<case-name> --phase <id> --rotate-from <previous-fingerprint> --rotation-reason "Reason for replacement"
```

The previous fingerprint is visible in the dashboard. Rotation does not rewrite old signatures.

Reopened/blocked phases no longer authorise subsequent work. Downstream readiness must be reviewed
after reapproval. The initial implementation conservatively checks the standard predecessor chain;
selective impact waivers are not implemented.

## Artifact and model handling

Ordinary application JSON and copied input JSON do not require AFF fields. Catalogued AFF records
still require the correct schema, identity, and location. A damaged JSONL journal reports line-specific
diagnostics and does not become valid by ignoring its bad lines.

An unavailable model assignment blocks validation. A per-case substitution must reference a prior
signed APPROVED decision whose `extensions.modelSubstitutions` contains the exact `agent`, `fromModel`,
and `toModel`. The plan binds that decision in `extensions.modelSubstitutionApprovals` as `{path,sha256}`.
The prior decision may bind an older plan but cannot bind the newly substituted plan itself (a hash
cycle). Initial cases should use the lifecycle defaults or follow the documented repository model
replacement procedure. A dedicated interactive model-change command remains future work.

## Delivery stages

- Correctness: signing-key checks, immutable decisions, approval readiness, lifecycle state, artifact
  loading, diagnostics, regression tests, and the architect dashboard.
- Workflow readiness: a complete synthetic Phase 0–6 reference journey, setup diagnostics, and tested
  presentation tooling. The reference contract journey and setup diagnostics are now implemented;
  live presentation tooling remains unverified. Offline fixtures do not prove live-agent quality.
- Optional execution: typed scoped authorisation and deployment/test-result validation. Phases 7–8
  remain blocked until this work is complete; no Azure execution is part of remediation.
