# Get Started Button Reference

## Target use

- Future **Get Started** CTA only
- Do not apply this style globally to all buttons
- Adapt colors to AegisBridge design tokens when implemented
- Preserve accessibility and keyboard focus states
- Respect reduced-motion preferences
- Preserve existing CTA sizing and layout unless explicitly redesigned
- Source inspiration: Uiverse.io / Codecite

## Visual intent

Use a polished, premium CTA with:

- Purple-to-blue vertical gradient
- Soft inner highlight
- Subtle cyan lower glow
- Rounded pill shape
- Gentle hover enhancement
- No aggressive scale or motion
- A restrained cinematic appearance consistent with AegisBridge

## Reference CSS

```css
.btn {
  --fancy-button-gradient-0: #8d49fd;
  --fancy-button-gradient-50: #7f56f3;
  --fancy-button-gradient-100: #5691f3;
  --fancy-button-inner-shadow-top: rgba(233, 209, 255, 0.2);
  --fancy-button-inner-shadow-top-lg: rgba(9, 12, 60, 0.1);
  --fancy-button-inner-shadow-bottom: rgba(137, 222, 246, 0.3);
  --fancy-button-shine-top: #e9d1ff;
  --fancy-button-shine-bottom: #adfff9;

  font-weight: 500;
  font-size: 15px;
  line-height: 21px;
  text-shadow: 0 0.5px 0.5px rgba(0, 0, 0, 0.2);
  padding: 0;
  margin: 0;
  appearance: none;
  border: none;
  outline: none;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  z-index: 1;
  border-radius: 25px;
  color: #fff;

  background-image: linear-gradient(
    to bottom,
    var(--fancy-button-gradient-0) 0%,
    var(--fancy-button-gradient-50) 50%,
    var(--fancy-button-gradient-100) 100%
  );

  box-shadow:
    0 4px 12px rgba(9, 12, 60, 0.15),
    0 2px 8px rgba(9, 12, 60, 0.15),
    0 1px 3px var(--fancy-button-inner-shadow-top-lg),
    inset 0 1px 1px var(--fancy-button-inner-shadow-top),
    inset 0 -1px 3px var(--fancy-button-inner-shadow-bottom);
}

.btn::before,
.btn::after {
  content: "";
  position: absolute;
  border-radius: inherit;
  will-change: transform;
}

.btn::before {
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--fancy-button-shine-top);
  width: 96px;
  height: 6px;
  top: -3px;
  opacity: 0.6;
  filter: blur(6px);
  transition: opacity 0.25s;
}

.btn::after {
  inset: 0;
  background-size: cover;
  z-index: 2;
  opacity: 0.3;
  mix-blend-mode: overlay;
  pointer-events: none;
}

.btn span {
  display: block;
  padding: 12px 24px;
  border-radius: inherit;
  overflow: hidden;
  position: relative;
  background-image: linear-gradient(
    to bottom,
    var(--fancy-button-shine-top),
    transparent 8px
  );
  background-position: 0 -6px;
  background-repeat: no-repeat;
  z-index: 1;
}

.btn span::before,
.btn span::after {
  content: "";
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 50%;
  background-color: var(--fancy-button-shine-bottom);
  transition:
    opacity 0.25s,
    transform 0.25s;
  will-change: transform;
}

.btn span::before {
  width: 92px;
  height: 8px;
  bottom: -4px;
  opacity: 0.75;
  filter: blur(6px);
}

.btn span::after {
  width: 112px;
  height: 1px;
  bottom: 0;
  opacity: 0.9;
  filter: blur(1px);
}

.btn:hover span::before {
  opacity: 0.8;
  transform: translateX(-50%) scale(1.25);
}

.btn:hover span::after {
  opacity: 1;
}
```

## Implementation note

This is a reference, not production-ready code.

When implemented:

- convert colors to AegisBridge design tokens where appropriate
- use the shared motion tokens from Section 17
- add proper `:focus-visible` treatment
- ensure disabled/loading states remain clear
- avoid excessive glow
- verify contrast
- keep hover effects desktop-only where appropriate
- preserve usability when reduced motion is enabled