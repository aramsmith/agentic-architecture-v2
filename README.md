# Agentic Architecture v2

Agentic Architecture v2 is a human-centred architecture workflow that turns an architecture brief
into approved requirements, a TOGAF architecture, an implementation-ready Azure design, an
implementation plan, deployable code, and a C-level presentation.

The human architect remains accountable for every material decision and is the final approver of every
phase. Deployment and runtime testing are optional and always require separate human invocation.

## Repository guidance

- [Contributing](CONTRIBUTING.md)
- [Security reporting](SECURITY.md)
- [Support boundaries](SUPPORT.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Licence](LICENSE)

## Interactive solution overview

- **[Open the interactive HTML solution overview](https://aramsmith.github.io/agentic-architecture-v2/agentic-architecture-v2.html)**

The interactive overview includes the animated architecture ring, phase model, reviewer roles, agent
roster, assurance sequence, and short operating manual.

After the first push, select **Settings → Pages → Source: GitHub Actions** if Pages is not already
enabled. The included workflow publishes both the site root and the explicit HTML file at the link
above.

## GitHub Copilot compatibility

AFF is packaged for GitHub Copilot CLI and the GitHub Copilot app:

- the 11 repository custom agents use `.github/agents/*.agent.md`;
- the two project skills use `.github/skills/<skill-name>/SKILL.md`;
- the operating contract and lifecycle manifest remain beside the profiles in `.github/agents/`.

These are the GitHub-documented locations for
[repository custom agents](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli)
and [project skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills).
Prerequisites are GitHub Copilot access, a current Copilot CLI or the Copilot app, a clean clone or
checkout of the target branch, and access to the models listed below.

Open Copilot CLI from the repository root. It discovers project agents and skills from the checked-out
branch. If files change during a running session, restart the CLI to reload agents or use
`/skills reload` to reload skills.

To verify discovery in Copilot CLI:

1. Run `/agent` and confirm `AFF-0-coordinator` is available.
2. Run `/skills list`, then `/skills info grill-me` and `/skills info render-case-html`.
3. Select `AFF-0-coordinator`, or run:

   ```powershell
   copilot --agent=AFF-0-coordinator --prompt "State only the custom agent profile name. Do not read or modify files." --silent
   ```

In the GitHub Copilot app, select this repository and the branch containing the profiles, then select
`AFF-0-coordinator` from the agent dropdown. Skills have no separate app selector: Copilot loads them
when the prompt and the skill description match, or when a profile explicitly references the skill.
Repository custom agents must be on the default branch for normal repository-wide app discovery.

## Validate AFF contracts

The repository includes versioned JSON Schema contracts and a cross-platform Node.js validator. With
Node.js 22 or later:

```powershell
npm ci
npm run validate -- --framework-only
npm run validate -- --case cases/<case-name>
```

The first command proves the packaged profiles, skills, lifecycle, schemas, routes, models, and
repository references agree. The case command also checks structured records, safe paths, canonical
SHA-256 bindings, final reviewer convergence, and human approval bindings. See
[`docs/aff-contracts.md`](docs/aff-contracts.md) for the version policy, schema catalogue, and plain
language error guidance.

## Plan 1 quick start

**Prerequisites:** Git, Node.js 22 or later, and npm. No Azure subscription, credential, model access,
or network service is needed after `npm ci`.

From a clean clone in Windows PowerShell:

```powershell
npm ci
npm run validate -- --framework-only
npm run smoke:contoso
```

To retain the generated synthetic case for inspection, choose an empty ignored directory:

```powershell
npm run smoke:contoso -- --keep-output .\.aff-smoke\contoso-review
```

Success proves that repository agent and skill packaging, schemas, canonical hashes, the fixed model
matrix, same-candidate AFF-A/AFF-B reviews, synthetic approval bindings, safe rendering, journal-derived
routing, and the first one-question AFF-1 interaction agree.

It does **not** prove live model quality, Azure access, deployment, runtime behavior, credential or OIDC
configuration, public data access, or Phase 7/8 readiness. The generated approval is prominently marked
synthetic test evidence and is never a real human approval.

The default smoke workspace is deleted after the run. Retained output contains the generated case and
`smoke-report.json`; committed Contoso inputs are not changed.

## Render case HTML

Use the deterministic renderer instead of model-authored HTML:

```powershell
npm run render -- phase --case cases\<case-name> --phase 0 `
  --source 0-coordination\<artifactPrefix>-coordination.md `
  --metadata 0-coordination\<artifactPrefix>-input-inventory.json 0-coordination\<artifactPrefix>-model-plan.json `
  --output 0-coordination\<artifactPrefix>-coordination.html

npm run render -- overview --case cases\<case-name>
```

See [`docs/aff-renderer.md`](docs/aff-renderer.md) for inputs, trust boundaries, limits, Mermaid behavior,
accessibility, and error remediation.

## Architecture ring

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#d1d5db", "primaryTextColor": "#1f2937", "primaryBorderColor": "#9ca3af", "lineColor": "#9ca3af", "secondaryColor": "#d1d5db", "tertiaryColor": "#d1d5db"}}}%%
block-beta
  columns 7
  space:2 P0["P0 Coordinate"]:3 space:2
  space P8["P8 Testing"]:2 space P1["P1 Requirements"]:2 space
  P7["P7 Deployment"]:2 space:3 P2["P2 TOGAF"]:2
  space:3 H["HUMAN<br/>ARCHITECT"] space:3
  P6["P6 Presentation"]:2 space:3 P3["P3 Azure Design"]:2
  space P5["P5 Coding"]:2 space P4["P4 Implementation"]:2 space
  space:2 RD["Rubber Duck Reviewer"] space SC["Security + Compliance Reviewer"] space:2

  H --- P0
  H --- P1
  H --- P2
  H --- P3
  H --- P4
  H --- P5
  H --- P6
  H --- P7
  H --- P8
  RD -.-> H
  SC -.-> H

  classDef ring fill:#d1d5db,stroke:#9ca3af,color:#1f2937,stroke-width:1px;
  classDef centre fill:#d1d5db,stroke:#6b7280,color:#1f2937,stroke-width:3px;
  class P0,P1,P2,P3,P4,P5,P6,P7,P8,RD,SC ring;
  class H centre;
```

The human architect is central to every phase and reviewer relationship. Read the numbered phases in
order; the standard route ends with Phase 6. Phase 7 and Phase 8 are not automatic continuation steps.
The full canonical names and responsibilities are listed in the agent roster below.

## Phase assurance and approval sequence

**Independent challenge. Shared evidence. Human authority.**

```mermaid
flowchart LR
    A["1 · Phase Agent<br/>Creates candidate"] -->
    B["2 · Rubber Duck Reviewer<br/>Challenges logic"] -->
    C["3 · Phase Agent<br/>Remediates"] -->
    D["4 · Security and Compliance Reviewer<br/>Assures compliance"] -->
    E["5 · Phase Agent<br/>Remediates"] -->
    F["6 · Both Reviewers<br/>Confirm identical hashes"] -->
    G["7 · Human Architect<br/>Approves"]
```

Any material change invalidates prior hash-bound reviews. The human gate opens only when both reviewer
verdicts cover the same unchanged artifact hashes.

## Agent roster

| ID | Display name | Model | Responsibility |
|---|---|---|---|
| AFF-0 | Phase 0 — Coordinate | `gpt-5.6-sol` | Normalise inputs, initialise state and models, prepare the interview, route reviews and gates |
| AFF-1 | Phase 1 — Requirements | `gpt-5.6-sol` | Conduct the human interview and create the governed requirements baseline |
| AFF-2 | Phase 2 — TOGAF Architecture | `gpt-5.6-sol` | Create the vendor-neutral Business, Data, Application, and Technology Architecture |
| AFF-3 | Phase 3 — Azure Design | `gpt-5.6-sol` | Map the logical architecture to landing zones, CAF, WAF, Azure services, and controls |
| AFF-4 | Phase 4 — Implementation Plan | `gpt-5.6-sol` | Produce the dependency-led Bicep plan, validation, rollback, and deployment procedure |
| AFF-5 | Phase 5 — Coding | `gpt-5.3-codex` | Build and locally validate the complete IaC/application package without deploying |
| AFF-6 | Phase 6 — C-level Presentation | `gpt-5.6-sol` | Create the evidence-backed DECKIO board narrative and PDF |
| AFF-7 | Phase 7 — Deployment | `gpt-5.6-sol` | Optionally execute one explicitly authorised Azure deployment attempt |
| AFF-8 | Phase 8 — Runtime Testing | `gpt-5.3-codex` | Optionally execute one authorised test plan against the approved deployment |
| AFF-A | Rubber Duck Reviewer | `gpt-5.4` | Challenge correctness, logic, traceability, and unsupported claims with a different GPT model |
| AFF-B | Security and Compliance Reviewer | `gpt-5.6-sol` | Derive case-specific obligations and review security, privacy, sovereignty, and compliance |

## Core principles

- **Human-final governance:** agents prepare and challenge; the human decides and approves.
- **Independent review:** the Rubber Duck Reviewer uses a different GPT model from the phase agent.
- **Evidence-bound convergence:** both reviewers must cover identical artifact hashes.
- **Compact outputs:** each phase produces one authoritative Markdown document and safe HTML rendering.
- **No invented facts:** unknowns become explicit decisions, blockers, or owned assumptions.
- **Azure-ready, never reckless:** Bicep-first, parameterised environments, private databases, and no
  automatic deployment.
- **No stored deployment credentials:** use interactive Azure sign-in or an approved managed/runtime
  identity; GitHub OIDC is outside this solution.
- **Fail closed:** missing evidence, independence, scope, or approval stops progression.

## Before the first case

Confirm these GPT models are available:

- `gpt-5.6-sol` for architecture, coordination, presentation, deployment, and AFF-B;
- `gpt-5.3-codex` for coding and runtime testing;
- `gpt-5.4` reserved for the Rubber Duck Reviewer.

If a model is unavailable, the human must approve a GPT replacement and update agent frontmatter,
`.github/agents/AFF-OPERATING-CONTRACT.md`, and `.github/agents/AFF-LIFECYCLE.json` consistently. The
Rubber Duck Reviewer must always use a different model from the phase agent.

## Start a use case

1. Create `cases/<case-name>/input/`.
2. Add the architecture brief and supporting evidence. Use
   `cases/_template/input/architecture-brief.md` when useful.
3. Do not include credentials, tokens, or unnecessary personal or regulated data.
4. Invoke `AFF-0-coordinator`.
5. Review the Phase 0 output, both reviewer records, decisions, and residual risks.
6. Approve only when both reviews cover the same final artifact hashes.
7. Continue one approved phase at a time through Phase 6.

Do not start directly with AFF-1. AFF-0 establishes the source inventory, model plan, shared records,
interview preparation, review routing, and cumulative solution overview.

## Practise with Contoso

Contoso is Microsoft's familiar fictitious company name used in examples. The included Contoso Permit
Services case is entirely synthetic and contains no real company, customer, employee, subscription,
credential, or personal data.

Use `cases/contoso-permit-services/input/` to exercise Phase 0 and the opening of Phase 1 without Azure
access, deployment, or live testing. Its JSON expectations define the safety and routing conditions
that must hold. `npm run smoke:contoso` executes every expectation as an assertion.

## Outputs

Each phase produces one compact authoritative Markdown document and one safe self-contained HTML
rendering. Supporting catalogues, diagrams, code, and evidence remain separate. AFF-0 updates the
case-level `solution-overview.html` after each human-approved phase.

Phase 5 creates and locally validates the Bicep/application package but never deploys. The human may
invoke AFF-7 later for one scoped deployment attempt and AFF-8 only after an approved successful
deployment.

## Repository structure

```text
.github/
  agents/
    AFF-OPERATING-CONTRACT.md
    AFF-LIFECYCLE.json
    AFF-0...AFF-8 agent profiles
    AFF-A and AFF-B reviewer profiles
  skills/
    grill-me/
    render-case-html/
cases/
  _template/
  contoso-permit-services/
docs/
  aff-contracts.md
  aff-renderer.md
src/
  render/
  smoke/
agentic-architecture-v2.html
```

## Case-data safety

Real case folders are intentionally ignored by Git. Only the case template and synthetic Contoso case
are allowed into the repository. Keep real customer case data local and never commit or push it.

## Licence

Except where a component includes its own licence file, this repository is licensed under the
[Apache License 2.0](LICENSE). Component-level licences remain applicable to their components;
`.github/skills/grill-me/LICENSE` applies to the `grill-me` skill.
