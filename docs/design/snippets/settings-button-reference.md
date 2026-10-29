# Settings Button Reference

## Target use

- Future settings/configuration action only
- Do not apply this tooltip pattern globally
- Keep the Lucide settings icon
- Adapt colors to AegisBridge design tokens
- Preserve keyboard accessibility
- Tooltip must work with focus as well as hover
- Respect reduced-motion preferences
- Source inspiration: Uiverse.io / Pradeepsaranbishnoi

## Implementation notes

This is a design reference, not production-ready code.

Before implementation:
- replace hard-coded colors with AegisBridge tokens
- use shared Section 17 timing/easing tokens
- support `:focus-visible` and keyboard users
- ensure tooltip is available on focus, not only `group-hover`
- keep the tooltip non-interactive unless it becomes a real menu
- preserve the existing settings action and routing
- verify placement on small screens
- avoid changing the approved navigation layout

## Reference markup