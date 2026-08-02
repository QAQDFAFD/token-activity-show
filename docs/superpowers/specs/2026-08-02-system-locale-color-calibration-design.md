# System Locale and Color Calibration Design

## Goal

Make Token Activity Show consistently use the machine's supported language and recalibrate both light and dark palettes into a coherent macOS utility color system.

## Locale Resolution

The renderer selects the first supported locale from `navigator.languages`:

- Simplified Chinese: `zh-CN`, `zh-SG`, `zh-Hans*`, and compatible simplified-Chinese tags.
- Traditional Chinese: `zh-TW`, `zh-HK`, `zh-MO`, `zh-Hant*`, and compatible traditional-Chinese tags.
- English: every other locale and all fallback cases.

Canonical application locales are `zh-CN`, `zh-TW`, and `en`. English is the final fallback for unsupported locales and missing translations. No manual language selector is added in this slice.

## Translation Architecture

A focused renderer i18n module owns:

- locale normalization and selection;
- typed translation keys and complete dictionaries;
- parameter interpolation;
- date, time, and number formatting using the resolved locale.

All visible renderer copy moves into dictionaries, including navigation, appearance control, Today, Settings, loading, empty, error, provider metadata, metric labels, and accessibility labels. `Token Activity Show`, provider names, error codes, and protocol identifiers remain unchanged.

Components obtain the resolved locale and translation API through a small React context. No main-process, preload, IPC, database, or source-contract changes are required.

## Color Calibration

All theme-specific colors become semantic CSS tokens. Component rules consume tokens rather than embedding light- or dark-specific values.

### Light Palette

- Canvas: `#F5F6F8`
- Sidebar: `#EAEBEF`
- Surface: `#FFFFFF`
- Subtle surface: `#F7F7F9`
- Border: `#DCDDE3`
- Primary text: `#202126`
- Secondary text: `#5D606A`
- Accent: `#5654C9`
- Accent hover: `#4947B5`
- Error surface: `#FFF2F3`

### Dark Palette

- Canvas: `#191A1E`
- Sidebar: `#202126`
- Surface: `#27282E`
- Subtle surface: `#2D2E34`
- Border: `#3B3C44`
- Primary text: `#F0F0F3`
- Secondary text: `#B2B3BD`
- Accent text/focus: `#9290FF`
- Solid accent control: `#6866DC`
- Error surface: `#3A272B`

The palette avoids pure black for the dark canvas and reserves white surfaces for grouped light-mode content. Indigo remains limited to selected navigation, primary actions, enabled switches, theme selection, and focus.

## Theme Compatibility

The existing System, Light, and Dark preference model remains unchanged. Explicit `[data-theme="light"]` and `[data-theme="dark"]` blocks define every semantic token. System mode continues resolving to one of those explicit themes.

## Accessibility

- Normal text and form controls meet WCAG AA contrast.
- Theme selection, loading status, errors, and provider status remain understandable without color.
- Translated accessibility names remain complete in all three languages.
- Date, time, and number output use the same resolved locale as interface copy.

## Testing and Verification

Tests cover:

- simplified, traditional, and English locale selection;
- unsupported-locale fallback;
- dictionary key completeness;
- interpolation and locale-aware date/time/number formatting;
- representative renderer copy in all three languages;
- existing theme behavior and UI interactions;
- full typecheck, lint, tests, and build.

Real Electron verification captures light and dark appearances and checks at least one Chinese locale plus English through controlled locale resolution.
