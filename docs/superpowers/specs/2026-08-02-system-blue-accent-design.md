# System Blue Accent Migration Design

## Goal

Remove the purple AI-product visual signature from Token Activity Show and replace it with a restrained macOS system-blue accent over the existing cool graphite neutral palette.

## Palette

### Light

- Accent: `#0A66D9`
- Accent hover: `#0859BE`
- Accent soft/selection: `#E7F1FF`
- Focus ring: `#0A66D9`

### Dark

- Accent text/focus: `#5AA7FF`
- Solid accent control: `#287AD4`
- Solid accent hover: `#236CC0`
- Accent soft/selection: `#24364A`

## Usage

Blue is restricted to selected navigation, primary buttons, enabled switches, selected theme mode, and keyboard focus. No gradients, glows, tinted shadows, decorative blue labels, or blue content surfaces are added.

The existing graphite canvas, sidebar, grouped surfaces, borders, text colors, System/Light/Dark theme behavior, locale behavior, and accessibility semantics remain unchanged.

## Verification

- Search renderer CSS for all previous purple values and require zero matches.
- Check button, switch, selected navigation, theme selector, and focus contrast in Light and Dark.
- Run renderer tests, typecheck, lint, full tests, and build.
- Capture real Electron Light and Dark windows for visual inspection.
