# Company OS design direction

Owner-confirmed 2026-10-06: use Godisabove #FFD602 and Godisabove USA #877AF5 with complementary tones. Aim for a distinctive, sleek, understated financial control center with more polish and clarity than Triple Whale. This is an aesthetic target, not a measured superiority claim.

## Palette

| Token | Godisabove | Godisabove USA |
| --- | --- | --- |
| Primary | #FFD602 | #877AF5 |
| Soft highlight | #FFF2AD | #CEC8FF |
| Deep accent | #806B00 | #504498 |
| Tinted surface | #24200E | #1E1A30 |

Derived tones are design proposals. Confirmed primary colors identify operational store contexts, not legal entities or customer countries. Group views use a neutral shell and labeled yellow/lavender series; never blend them into an ambiguous total. 360 Faucet uses a neutral fallback until its identity is supplied.

## Visual language

Ink background #101113; raised surfaces #18191D; borders #303138; primary text #F3F2EF; secondary text #B0B1BA. Warm off-white is the planned light-theme base. Keep color concentrated in selected store indicators, active navigation, chart series, key buttons and fine highlights. Avoid large saturated card walls, excessive gradients, glow, glass effects, and decorative clutter.

Use precise typography: system sans initially, strong editorial headings, tabular numerical figures, compact uppercase section labels. Monetary figures remain the focal point. Use generous section spacing, dense readable tables, fine separators, 12–16px card radii, and restrained shadows. Motion is purposeful and short (120–180ms); respect reduced-motion settings.

## UX hierarchy

Lead with an operator brief: what changed, what needs attention, and the next decision. Follow with profit metrics, cash runway/obligations, Meta credit, inventory risk, and underlying transactions. Keep source, timestamp, currency and confidence next to the number. Explain missing coverage rather than replacing it with zero.

Store switching changes context and accent together. Preserve explicit store labels; theme selection never proves an account/entity mapping. Keep semantic success/warning/danger colors independent of store colors. Yellow is not inherently a warning and lavender is not inherently an estimate. Use text/icon labels alongside color.

Invoice UX: original invoice alongside editable extraction; visible date/entity/store selectors, allocations and total checks; explicit confirmation before posting. Tables offer drill-down rather than burying financial provenance in tooltips.

## Accessibility and responsive behavior

Meet WCAG AA text contrast (4.5:1 normal, 3:1 large) and 3:1 meaningful UI boundaries. Use dark #101113 text on both primary-colored buttons, never white text on yellow. Verify actual foreground/background pairs during implementation. Visible keyboard focus, semantic controls, descriptive chart summaries, accessible tables, non-color status labels, and practical touch targets are required.

Desktop uses a quiet sidebar and a broad work area. Smaller screens stack panels and allow table scrolling without page overflow. Respect reduced motion; no flashing live indicators. Choose responsive behavior based on content, not a fixed desktop screenshot.

## Concrete concept

[design-preview.html](design-preview.html) is a self-contained visual concept with a working store-theme switch and illustrative DEMO figures. It has no integrations, financial engines, uploads, or persisted records. This is a proposed UX direction, not a running Company OS application. Open the file in a browser; no installation or network dependency is required.
