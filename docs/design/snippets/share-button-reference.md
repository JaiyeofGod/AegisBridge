# Share Button Reference

## Target use

- Future share action only
- Do not apply globally to normal buttons
- Adapt colors and spacing to AegisBridge design tokens
- Preserve keyboard accessibility and `focus-visible`
- Respect reduced-motion preferences
- Avoid excessive continuous animation in production
- Prefer click/focus behavior in addition to hover
- Source inspiration: Uiverse.io / Mohammad-Rahme-576

## Implementation notes

This is a design reference, not production-ready code.

Before implementation:
- replace hard-coded colors with AegisBridge tokens where appropriate
- replace the infinite pulse with a restrained or non-continuous effect
- use the shared Section 17 motion tokens
- ensure the share menu works with keyboard and touch, not hover only
- verify social actions and URLs before enabling them
- keep reduced-motion behavior intact
- preserve the existing application layout

## Reference CSS

```css