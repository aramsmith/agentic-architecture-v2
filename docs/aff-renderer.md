# AFF deterministic HTML renderer

`aff-render` creates portable HTML views from authoritative AFF Markdown and validated case records. It
does not use a model, browser runtime, CDN, remote asset, or network request.

## Commands

Render one phase from the repository root:

```powershell
npm run render -- phase --case cases\contoso-permit-services --phase 0 `
  --source 0-coordination\contoso-coordination.md `
  --metadata 0-coordination\contoso-input-inventory.json 0-coordination\contoso-model-plan.json `
  --output 0-coordination\contoso-coordination.html
```

Render the cumulative view after case validation and human approval:

```powershell
npm run render -- overview --case cases\contoso-permit-services
```

The equivalent built commands are `aff-render phase ...` and `aff-render overview ...`.

## Trust model

All case content is untrusted. The renderer:

- rejects raw HTML instead of silently removing required meaning;
- allows page anchors, contained local links, HTTPS links, and `mailto` links;
- rejects source `javascript:`, `data:`, `file:`, protocol-relative, and escaping paths;
- embeds contained PNG, JPEG, GIF, WebP, or validated static SVG assets;
- rejects SVG scripts, event handlers, styles, `foreignObject`, unsupported elements, and URL references;
- escapes Mermaid source and labels it as not visually rendered;
- sanitizes generated Markdown HTML with maintained parser and sanitizer libraries;
- embeds fixed CSS and, for overview tabs only, a small fixed script with no case-supplied code;
- validates case records and journal-to-approval hash bindings before an overview can look approved;
- writes through an atomic same-directory replacement.

Local source, metadata, assets, and output must remain inside the physical case directory. Symbolic-link
and junction escapes are rejected where the operating system exposes them.

## Limits

| Input | Limit |
| --- | ---: |
| Phase Markdown | 1 MiB |
| Each metadata JSON file | 512 KiB |
| Each embedded image | 5 MiB |
| Generated HTML | 10 MiB |

Link large evidence or code instead of embedding it. Inputs must be valid UTF-8. Images require
descriptive alternative text.

## Output and accessibility

Phase HTML includes semantic landmarks, a skip link, stable phase-prefixed heading IDs, a generated
table of contents, visible keyboard focus, responsive and print styles, table headers, code labels, and
source SHA-256 metadata. The cumulative overview adds keyboard-operable tabs with explicit selected and
hidden state.

The HTML is a generated view. Markdown, catalogues, journal events, reviews, and approvals remain
authoritative.

## Failure remediation

- **Raw HTML or unsafe URL:** replace it with Markdown or a contained reviewed asset.
- **Unsafe SVG:** export a static basic-shape SVG without scripts, styles, links, or external references.
- **Mermaid visual required:** provide a reviewed static SVG; browser-side Mermaid execution is not used.
- **Stale hash:** do not edit reviewed evidence in place. Create the next review and approval records.
- **Containment failure:** remove traversal, symbolic links, or junctions and use a physical case file.
- **Atomic write failure:** correct output permissions or path type; no partial success page is retained.
