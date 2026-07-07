---
name: Cinematic Cyber-Intelligence
colors:
  surface: '#0e141b'
  surface-dim: '#0e141b'
  surface-bright: '#343a41'
  surface-container-lowest: '#090f15'
  surface-container-low: '#161c23'
  surface-container: '#1a2027'
  surface-container-high: '#242a32'
  surface-container-highest: '#2f353d'
  on-surface: '#dde3ed'
  on-surface-variant: '#c0c7d4'
  inverse-surface: '#dde3ed'
  inverse-on-surface: '#2b3138'
  outline: '#8a919e'
  outline-variant: '#404752'
  surface-tint: '#a1c9ff'
  primary: '#a1c9ff'
  on-primary: '#00325b'
  primary-container: '#3b9eff'
  on-primary-container: '#00345e'
  inverse-primary: '#0060a8'
  secondary: '#7dffa2'
  on-secondary: '#003918'
  secondary-container: '#05e777'
  on-secondary-container: '#00622e'
  tertiary: '#ffb3b2'
  on-tertiary: '#680013'
  tertiary-container: '#ff696f'
  on-tertiary-container: '#6c0015'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d3e4ff'
  primary-fixed-dim: '#a1c9ff'
  on-primary-fixed: '#001c38'
  on-primary-fixed-variant: '#004880'
  secondary-fixed: '#62ff96'
  secondary-fixed-dim: '#00e475'
  on-secondary-fixed: '#00210b'
  on-secondary-fixed-variant: '#005226'
  tertiary-fixed: '#ffdad9'
  tertiary-fixed-dim: '#ffb3b2'
  on-tertiary-fixed: '#410008'
  on-tertiary-fixed-variant: '#920020'
  background: '#0e141b'
  on-background: '#dde3ed'
  surface-variant: '#2f353d'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
  mono-label:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  grid-gutter: 16px
  grid-margin: 24px
---

## Brand & Style

The design system is engineered for high-stakes Security Operations Centers (SOC) and enterprise defense environments. It balances high-density information architecture with a cinematic, "near-future" aesthetic inspired by advanced tactical interfaces.

The personality is authoritative, precise, and vigilant. It leverages a modern **Corporate-Cyber** hybrid style: the structural discipline of enterprise SaaS meets the immersive, atmospheric quality of specialized security tooling. Visual depth is achieved through layering dark surfaces, subtle glow effects, and technical textures that evoke a sense of constant monitoring and rapid response.

## Colors

The palette is anchored in a deep, nocturnal navy to minimize eye strain during extended monitoring sessions. 

- **Primary (Electric Blue):** Used for focal points, active states, and primary interactions. It serves as the "pulse" of the interface.
- **Success (Neon Green):** Reserved for "Clean," "Resolved," or "Safe" status indicators.
- **Critical (Red):** High-saturation red for immediate threats, system breaches, and high-priority alerts.
- **Warning (Amber):** For suspicious activity or system warnings that require attention but not immediate panic.
- **Neutral/Surface:** A tiered approach to dark grays with blue undertones to maintain the cinematic temperature.

## Typography

This design system utilizes a dual-font strategy to separate UI narrative from raw data.

1.  **Inter:** Handles the primary interface hierarchy. Its high legibility and neutral character provide a professional backbone for navigation, headers, and descriptive text.
2.  **JetBrains Mono:** Used for all technical telemetry, IP addresses, timestamps, logs, and metadata labels. The monospaced nature ensures that columns of changing data remain stable and easy to scan.

Use `mono-label` for small, all-caps descriptors above data points to enhance the "instrument panel" feel.

## Layout & Spacing

The layout philosophy is a **Fluid-Technical Grid**. It prioritizes high density to allow analysts to view maximum data without excessive scrolling.

- **Grid:** A 12-column system for desktop, shifting to a 4-column system for mobile. 
- **Rhythm:** A 4px baseline grid ensures alignment between monospaced data and UI labels.
- **Margins:** Consistent 24px outer margins provide "breathing room" against the screen edge, while 16px internal gutters keep related data cards tightly packed.
- **Textures:** Large empty areas should be filled with a subtle dot-grid background texture (`rgba(59, 158, 255, 0.05)`) to maintain the technical atmosphere.

## Elevation & Depth

Depth is conveyed through **Luminous Layering** rather than traditional physical shadows.

- **Surfaces:** Each elevation level slightly increases the background lightness (from `#0B0F14` to `#141A21`).
- **Borders:** All containers use a 1px border `rgba(59, 158, 255, 0.15)`. This creates a "wireframe" feel common in HUD interfaces.
- **Glow Effects:** High-priority elements (active buttons, critical alerts) utilize a soft outer glow (`box-shadow: 0 0 15px rgba(59, 158, 255, 0.25)`).
- **Backdrop:** Use a background blur (12px) on modal overlays and floating menus to maintain context of the underlying data.

## Shapes

The shape language is sophisticated and controlled. A uniform **16px (1rem)** corner radius is applied to all primary containers and cards, providing a modern, premium feel that softens the "aggressive" nature of cybersecurity data.

- **Standard Buttons/Inputs:** 8px (0.5rem) to differentiate smaller interactive elements from structural containers.
- **Status Tags:** Fully pill-shaped (100px) for quick visual scanning.

## Components

- **Buttons:** Primary buttons feature a solid Electric Blue fill with white text. Ghost buttons use the 1px Primary border and an icon. All buttons have a subtle hover transition that increases the glow intensity.
- **Data Cards:** Cards use the `#141A21` surface color with the standard 1px border. Card headers should use a sub-divided border to separate the title from the content.
- **Input Fields:** Darker than the surface color, using the `mono-data` typography for input text. The active state highlights the entire border in Electric Blue.
- **Status Chips:** Use a low-opacity background of the status color (e.g., 10% Red) with a solid colored dot and the label in `mono-label`.
- **Logs/Lists:** High-density rows with alternating subtle background tints. Critical entries should have a 2px vertical "stress line" on the far left edge in the status color.
- **Threat Map:** A custom component using SVG paths for geographical data, with glowing "attack nodes" utilizing the primary and critical colors.