# Loading Indicator Reference

## Target use

- Future prominent loading state only
- Do not use for every background request
- Do not replace lightweight skeletons or inline loading states globally
- Adapt colors to AegisBridge design tokens
- Respect reduced-motion preferences
- Keep loading text readable
- Source inspiration: Uiverse.io / Nawsome

## Implementation notes

This is a design reference, not production-ready code.

Before implementation:
- reduce the overall size for AegisBridge if needed
- replace `--bg`, `--primary1`, `--primary2`, and other colors with project tokens
- use the shared Section 17 motion system where practical
- provide a static or minimal reduced-motion version
- use `role="status"` and appropriate live-region text for accessibility
- do not block the whole interface for background refreshes
- use this only when a prominent loading state is actually justified
- preserve existing skeletons for tables, cards, and data refreshes unless intentionally redesigned

## Reference CSS

```css