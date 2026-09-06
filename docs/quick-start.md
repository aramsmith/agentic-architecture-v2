# Ten-minute architect quick start

For the ongoing decision workflow, see the [single-architect operating guide](architect-operating-guide.md).

This path proves that the checked-out AFF framework is internally consistent and produces a safe,
synthetic Phase 0 result. It does not call a model, access Azure, deploy anything, or create a real
architecture approval.

## 1. Local deterministic evaluation

### Prerequisites

- Git.
- Node.js 22 or later, including npm.
- Windows PowerShell.
- Network access for `git clone` and `npm ci`. The validation and smoke commands run offline after
  dependencies are installed.

The commands below are the verified Windows path. On Linux or macOS, use the same `git`, `npm`, and
Node.js commands in a terminal, replace `Set-Location` with `cd`, use `cat` for the report, and open the
HTML file with the operating system's normal file command. Those local shell equivalents are expected,
with platform coverage configured in repository CI. A configured CI job is not evidence of a completed run.

From a clean folder:

```powershell
git clone https://github.com/aramsmith/agentic-architecture-v2.git
Set-Location .\agentic-architecture-v2
node --version
npm --version
npm ci --no-audit --no-fund
npm run validate -- --framework-only
npm run smoke:contoso -- --keep-output .\.aff-smoke\contoso-review
Get-Content .\.aff-smoke\contoso-review\smoke-report.json
Invoke-Item .\.aff-smoke\contoso-review\cases\contoso-permit-services\solution-overview.html
```

If you are evaluating an unmerged branch, check out that branch before `npm ci`.

Run `npm run doctor` to inspect local prerequisites and see remaining manual host/model checks.
To inspect the retained smoke case's decision dashboard:

```powershell
npm run render -- approvals --root .\.aff-smoke\contoso-review --case cases/contoso-permit-services
Invoke-Item .\.aff-smoke\contoso-review\cases\contoso-permit-services\approval-overview.html
```

For a real case, omit `--root` and pass its case path. Regenerate the snapshot after every change.
The dashboard cannot sign decisions. Create an identity with `npm run identity:create` before using
`npm run approve`; run both commands yourself outside an agent session. Before Phase 6, arrange an
organisation-approved DECKIO installation and PDF export toolchain; `npm ci` does not install these.

### Successful evidence

- Framework validation reports no errors.
- The smoke command reports that all executable assertions passed.
- `liveModelCalls` and `azureActions` are both `0`.
- `syntheticApproval` is `true`, and the report says the approval is synthetic test evidence.
- `routeReady` is `AFF-1`, but no requirement has been baselined.
- The retained `solution-overview.html` opens locally and labels the approval as synthetic, not human.

**Safe stop point:** stop here for a complete deterministic evaluation. Delete the ignored output when
finished:

```powershell
Remove-Item -Recurse -Force .\.aff-smoke\contoso-review
```

See the committed [representative evidence snapshot](examples/contoso-phase-0-evidence.md) before
retaining output if you only need to understand the result.

## 2. Optional GitHub Copilot agent trial

This step is separate because it makes a live model call and requires GitHub Copilot access plus the
declared models.

Start Copilot CLI from the repository root, run `/agent`, and confirm `AFF-0-coordinator` is listed.
Run `/skills list`, then inspect `grill-me` and `render-case-html`.

For a minimal profile-discovery check:

```powershell
copilot --agent=AFF-0-coordinator --prompt "State only the custom agent profile name. Do not read or modify files." --silent
```

Restart Copilot CLI after changing agent profiles. Use `/skills reload` after changing skills.

**Safe stop point:** discovery proves packaging only. It does not prove model quality, reviewer
convergence, approval, Azure readiness, or production fitness.

## 3. Optional human-authorised Azure deployment and testing

Local evaluation and an agent trial do not require Azure. Do not improvise deployment commands from this
quick start.

**Not yet available:** the current validator deliberately blocks Phases 7 and 8 because scoped
authorisation and deployment-success prerequisite evaluation is not implemented. The following describes
the intended boundary, not an executable supported path. Do not remove lifecycle prerequisites.

Phase 7 may be invoked only after Phase 6 is approved and a human gives scoped deployment-attempt
authorisation. Phase 8 may be invoked only after a successful approved Phase 7 deployment and separate
scoped test-attempt authorisation. Use the approved Phase 4 procedure and Phase 5 release package for the
specific case; authenticate interactively or through an organisation-approved managed identity. Stored
credentials and GitHub OIDC are outside this framework contract.

**Safe stop point:** if the target subscription, approved parameters, rollback, evidence capture, or
human authorisation is missing, stop before sign-in or any Azure change.

For failures, use [Troubleshooting](troubleshooting.md). For boundaries and versions, use the
[Compatibility and support matrix](compatibility.md).
