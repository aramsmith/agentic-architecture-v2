---
name: render-case-html
description: Use when an AFF phase document or cumulative case overview must be rendered as safe self-contained HTML without changing authoritative source meaning.
---

# render-case-html

Read `.github/agents/AFF-OPERATING-CONTRACT.md` and `.github/agents/AFF-LIFECYCLE.json`. HTML is a
generated view; Markdown, catalogues, journal events, and review records remain authoritative. Use the
deterministic `aff-render` implementation through `npm run render -- ...`; do not transform AFF content
into HTML through prose generation.

## Phase rendering

For the current phase, run the renderer with the authoritative Markdown and structured records:

```powershell
npm run render -- phase --case cases\<case-name> --phase <id> `
  --source <phase-folder>\<artifactPrefix>-<artifact>.md `
  --metadata <phase-folder>\<artifactPrefix>-<catalogue>.json `
  --output <phase-folder>\<artifactPrefix>-<artifact>.html
```

The renderer verifies canonical hashes in structured metadata, enforces case containment and input
limits, rejects raw HTML and unsafe URLs, embeds only approved local image types, and writes atomically.
Mermaid is shown as escaped accessible source with an explicit warning. If a visual diagram is a
required completion condition, provide a reviewed static SVG or use `--require-visual-diagrams` to fail
closed.

Do not add claims, summaries, decisions, or status that are absent from authoritative sources. A source
change makes the rendered HTML stale and requires regeneration.

## Solution overview

AFF-0 uses this mode only after human approval:

```powershell
npm run render -- overview --case cases\<case-name>
```

This mode validates the case first, derives invoked and reopened state only from validated journal
events, verifies that journal decision hashes match the human approval record, preserves approved phase
content, shows separate AFF-A and AFF-B review tabs, and writes the atomic case-root
`solution-overview.html`.

## Failure conditions

Stop and report the renderer error when an authoritative source is missing, hashes do not match,
required content cannot be rendered safely, SVG sanitisation fails, a limit is exceeded, or phase state
cannot be resolved from the journal. Never hand-write a fallback page or produce success-looking output
from incomplete evidence. See `docs/aff-renderer.md` for the trust model and remediation guidance.
