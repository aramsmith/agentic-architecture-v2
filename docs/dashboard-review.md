# Architect dashboard review

Date: 2026-09-06. Scope: static generated approval dashboard, not the main reference website.
This is a partial accessibility and usability review, not a WCAG conformance certification.

## Findings and changes

- Phase cards now use level-three headings beneath the lifecycle section's level-two heading.
  This improves the programmatic heading hierarchy without changing decision behaviour.
- Cards use normal grid flow with an explicit single-column layout; the former shared fixed grid-cell
  styling is excluded. Regression tests cover the layout rules, not rendered pixel geometry.
- Navigation has named landmarks and local targets. A skip link, visible focus style and native
  disclosure controls are present. Synthetic/history warnings, snapshot age and regeneration guidance
  remain visible. These are source-level checks, not assistive-technology observations.

## Contrast spot checks

Calculated sRGB text contrast against the card colour `#1b1c30`:

| Text token | Colour | Ratio |
|---|---|---|
| Body | #cdcdda | 10.63:1 |
| Muted | #a6a6ba | 7.00:1 |
| Faint | #8e8ea4 | 5.22:1 |
| Violet | #8b7cff | 5.12:1 |
| Cyan | #4fd8e8 | 9.81:1 |

These spot checks do not measure every composited gradient, hover state, focus indicator or print
colour. They do not establish whole-page compliance.

## Manual release gates still open

User feedback on 2026-09-06: the dashboard looks good and work may proceed. This is recorded as
user visual acceptance only; the viewport, zoom level and assistive-technology checks were not
specified. Keyboard, screen-reader, mobile/zoom and print-preview verification remain unconfirmed.

Browser-based verification was blocked by the local-file access restriction. No workaround was used.
Complete these checks in an authorised browser before claiming visual/accessibility sign-off:

1. At desktop and 320 CSS-pixel width, confirm no overlapping cards, clipped text or page-level
   horizontal scrolling; repeat at 200% zoom and with long evidence filenames.
2. Tab through the skip link, navigation, evidence links and each disclosure. Confirm visible focus,
   logical order and Enter/Space activation of disclosure controls.
3. With VoiceOver or NVDA, confirm page landmarks, heading hierarchy, status text and expanded/collapsed
   announcements. Confirm decision meaning does not depend on colour alone.
4. Check touch targets, especially navigation and disclosures, for comfortable operation.
5. Inspect print preview for readable text and usable decision/evidence details. Expand disclosures
   before printing; do not assume closed evidence is included.

No browser, keyboard, screen-reader, mobile screenshot or print-preview pass is claimed here.
