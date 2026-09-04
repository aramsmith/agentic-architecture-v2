---
name: grill-me
description: Use during AFF Phase 1 to challenge a case until the human and AFF-1 establish evidence-backed shared understanding and a confirmed decision record.
---

# grill-me

Read `.github/agents/AFF-OPERATING-CONTRACT.md`. AFF-1 uses this skill in Phase 1. The skill
establishes intent and decisions; AFF-1 owns requirements and final artifacts.

## Start

1. Read the approved Phase 0 coordination document, inventory, every normalised source, readiness gaps,
   and interview agenda beneath `0-coordination/`.
2. Record an unreadable-source blocker; never guess missing content.
3. Publish starting confidence with reasons for each domain. Phase 0 confidence is preparation, not an
   answered question.
4. Ask one question per human interaction using the runtime's approved interaction mechanism.

## Domains

| Domain | Establish |
|---|---|
| Business | Outcome, buyer, stakeholders, value, success measures, consequences, budget, and timeline |
| Data | Sources, ownership, classification, residency, quality, volume, retention, and permitted use |
| Application | Users, journeys, functions, integrations, boundaries, and explicit non-scope |
| Technology | Target platform, current estate, operating model, constraints, environments, and support |
| Security | Identity, threats, privacy, sovereignty, obligations, controls, and accountable authorities |

## Question discipline

- Challenge the material, never the human.
- Do not ask what governed evidence already answers.
- Every question must resolve an unknown, test the framing, or produce a material decision.
- Follow consequences and state immediately when an answer changes an earlier assumption.
- Separate constraint from preference. Named products, regions, and SKUs are suggestions until the
  human confirms otherwise.
- Present evidence-based options and a recommendation where useful, but never lead the human into an
  invented requirement, obligation, architecture, or Azure service.
- Do not force the human architect to answer for another accountable owner. Record that owner and
  validation action; keep the interview open when the issue is material.
- Never infer agreement from silence.
- Avoid echoing secrets, personal data, regulated data, or confidential details unnecessarily.

## Shared-understanding confidence

Assess each domain from 0–100 with an evidence-based reason. This measures shared-understanding
confidence only. The human explicitly accepts or corrects every value.

- Below 80: the domain remains open.
- 80–94: usable only when each residual gap has an owner and validation plan.
- 95 or above: closure candidate.

Close only when every domain is at least 80, overall shared understanding is at least 95, no critical
unknown or material decision remains, and every residual assumption is owned and planned.

## Decision evidence

For every material question and decision record an immutable ID, date/time, impacted domains, source or
human confirmation, answer, rationale, rejected alternatives where relevant, owner, and follow-up.
Corrections append to history; never rewrite prior evidence.

AFF-1 writes `1-requirements/<artifactPrefix>-interview-decisions.json` containing the confirmed goal,
confidence and rationale, questions/decisions, assumptions, owners and validation, non-scope, source
bindings, corrections, open items, and human interview confirmation.

Keep summaries compact and link evidence rather than copying a long transcript.

## Closure and reopening

The human confirms the interview decision record during authoring. This is not final Phase 1 approval;
AFF-A and AFF-B review the completed requirements artifacts before the final human gate.

If a later phase exposes a material unknown, AFF-0 reopens Phase 1 and AFF-1 resumes this same record.
Never restart, reconstruct, or fabricate interview evidence.
