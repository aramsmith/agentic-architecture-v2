---
name: render-case-html
description: Use when an AFF phase document or cumulative case overview must be rendered as safe self-contained HTML without changing authoritative source meaning.
---

# render-case-html

Read `.github/agents/AFF-OPERATING-CONTRACT.md` and `.github/agents/AFF-LIFECYCLE.json`. HTML is a
generated view; Markdown, catalogues, journal events, and review records remain authoritative.

## Phase rendering

For the current phase:

1. Read the authoritative Markdown, supporting catalogue, approved diagrams, and their hashes.
2. Convert headings, tables, lists, links, code blocks, and diagrams to semantic HTML.
3. Add a table of contents and stable phase-prefixed element IDs.
4. Embed CSS and required JavaScript; do not use CDNs or external runtime dependencies.
5. Escape untrusted text. Never execute HTML, scripts, event handlers, or URLs supplied by case content.
6. Embed only sanitised SVG without scripts, foreign objects, or external references.
7. Link to large evidence and code instead of embedding it.
8. Include source paths and hashes in generated metadata.
9. Add accessible landmarks, keyboard navigation, visible focus, alt text, sufficient contrast, and
   print styles.
10. Write `<artifactPrefix>-<artifact>.html` beside the phase Markdown.

Do not add claims, summaries, decisions, or status that are absent from authoritative sources. A source
change makes the rendered HTML stale and requires regeneration.

## Solution overview

AFF-0 uses this mode only after human approval:

- discover phases from `.github/agents/AFF-LIFECYCLE.json`;
- include only invoked phases;
- derive phase state from the latest explicit journal event, including reopened state;
- show one phase tab plus separate AFF-A and AFF-B review tabs;
- show artifact, review, and approval hashes;
- preserve previously approved phase tabs and refresh only affected content;
- link to Phase 5 code and optional Phase 7/8 evidence rather than embedding it;
- keep optional deployment/testing separate from the C-level presentation;
- write the self-contained case-root `solution-overview.html`.

## Failure conditions

Stop and report when an authoritative source is missing, hashes do not match, required content cannot
be rendered safely, SVG sanitisation fails, or phase state cannot be resolved from the journal. Never
produce a success-looking page from incomplete evidence.
