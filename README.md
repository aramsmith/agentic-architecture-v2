# Agentic Architecture v2

Agentic Architecture v2 is a human-centred architecture workflow that turns an architecture brief
into approved requirements, a TOGAF architecture, an implementation-ready Azure design, an
implementation plan, deployable code, and a C-level presentation.

The human architect remains accountable for every material decision and is the final approver of every
phase. Deployment and runtime testing are optional and always require separate human invocation.

## Interactive solution overview

- **[Open the interactive HTML solution overview](https://aramsmith.github.io/agentic-architecture-v2/agentic-architecture-v2.html)**

The interactive overview includes the animated architecture ring, phase model, reviewer roles, agent
roster, assurance sequence, and short operating manual.

After the first push, select **Settings → Pages → Source: GitHub Actions** if Pages is not already
enabled. The included workflow publishes both the site root and the explicit HTML file at the link
above.

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
`agents/AFF-OPERATING-CONTRACT.md`, and `agents/AFF-LIFECYCLE.json` consistently. The Rubber Duck
Reviewer must always use a different model from the phase agent.

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
that must hold.

## Outputs

Each phase produces one compact authoritative Markdown document and one safe self-contained HTML
rendering. Supporting catalogues, diagrams, code, and evidence remain separate. AFF-0 updates the
case-level `solution-overview.html` after each human-approved phase.

Phase 5 creates and locally validates the Bicep/application package but never deploys. The human may
invoke AFF-7 later for one scoped deployment attempt and AFF-8 only after an approved successful
deployment.

## Repository structure

```text
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
agentic-architecture-v2.html
```

## Case-data safety

Real case folders are intentionally ignored by Git. Only the case template and synthetic Contoso case
are allowed into the repository. Keep real customer case data local and never commit or push it.
