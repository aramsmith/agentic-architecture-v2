# AFF data contracts and validation

AFF contract version `1.0.0` turns the operating rules into deterministic JSON Schema Draft 2020-12
records. The schema catalogue is `schemas/aff/catalogue.json`; versioned schemas are beneath
`schemas/aff/1.0.0/`.

## Version policy

- Every structured AFF JSON or JSONL record carries `schemaVersion` and `recordType`.
- The schema version uses semantic versioning. A breaking field or meaning change increments the major
  version. Backwards-compatible additions use a minor version. Clarifications that do not change valid
  data use a patch version.
- A record is validated only against its exact catalogued version. Unsupported versions fail closed.
- Top-level record fields are closed with `additionalProperties: false`. Deliberate case-specific
  additions belong in the open `extensions` object.
- The lifecycle's existing `version` describes lifecycle content. `schemaVersion` describes its data
  shape; the two versions are independent.

## Install and run

Use Node.js 22 or later from the repository root:

```powershell
npm ci
npm run validate -- --framework-only
```

Validate the framework and one local case:

```powershell
npm run validate -- --case cases/<case-name>
```

The case argument must be one direct child directory beneath `cases/`. Absolute paths, parent
traversal, and nested artifact paths are rejected.

Run the complete local quality sequence:

```powershell
npm test
npm run typecheck
npm run build
npm run validate -- --framework-only
```

Failures identify the file, the broken invariant, and the required correction. Exit code `1` means
contract validation failed. Exit code `2` means the validator could not run because a required file or
schema is unreadable or structurally invalid. Exit code `64` means the command-line arguments are
invalid.

## Canonical SHA-256 representation

Hash bindings use lower-case SHA-256 over these canonical bytes:

- JSON: parse the document and serialize it with deterministic JSON canonicalization, independent of
  indentation or property order.
- JSONL: canonicalize each non-empty JSON event, join events with LF, and end a non-empty journal with
  one LF.
- Text formats: UTF-8 without a byte-order mark, with CRLF and CR normalized to LF. Other whitespace is
  unchanged. Known source/document extensions are text; an unknown extension is treated as text only
  when it is valid UTF-8 and contains no NUL character.
- Binary formats: exact file bytes when the content is not classified as text by the rule above.

Paths in records use `/`, are relative to the case root, and cannot contain parent traversal. Editing
an artifact after review changes its canonical hash and invalidates the review and approval bindings.

## Schema catalogue

| Record | `recordType` | Contracted location |
|---|---|---|
| Lifecycle manifest | `lifecycle-manifest` | `.github/agents/AFF-LIFECYCLE.json` |
| Input inventory | `input-inventory` | `0-coordination/*-input-inventory.json` |
| Model plan | `model-plan` | `0-coordination/*-model-plan.json` |
| Interview decisions | `interview-decisions` | `1-requirements/*-interview-decisions.json` |
| Requirements catalogue | `requirements-catalogue` | `1-requirements/*-requirements-catalogue.json` |
| Architecture catalogue | `architecture-catalogue` | `2-togaf-architecture/*-architecture-catalogue.json` |
| Azure design catalogue | `azure-design-catalogue` | `3-azure-design/*-design-catalogue.json` |
| Implementation catalogue | `implementation-catalogue` | `4-implementation-plan/*-implementation-catalogue.json` |
| Release manifest | `release-manifest` | `5-coding/*-release-manifest.json` |
| Claim catalogue | `claim-catalogue` | `6-presentation/*-claim-catalogue.json` |
| Deployment attempts | `deployment-attempts` | `7-deployment/*-deployment-attempts.json` |
| Test catalogue | `test-catalogue` | `8-testing/*-test-catalogue.json` |
| AFF-A/AFF-B review | `review-record` | `reviews/aff-a|aff-b/<phase>/round-<n>/*.json` |
| Human approval | `human-approval` | `approvals/phase-<id>/*.json` |
| Regulatory coverage | `regulatory-coverage` | `reviews/aff-b/*-compliance-coverage.json` |
| Run-journal event | `run-journal-event` | case-root `*-run-journal.jsonl` |

The authoritative phase narratives, human decisions log, risk log, and regulatory register remain
compact Markdown by operating-contract design; they are not JSON records. Phase HTML is a generated
view and is deferred to the secure renderer in Plan 1C. Open-ended evidence files are not a single
record type. If a future profile promises a stable JSON shape, it must receive a versioned schema and
catalogue entry before use. Arbitrary JSON supplied beneath `input/` is treated as untrusted source
material and receives syntax validation only.
