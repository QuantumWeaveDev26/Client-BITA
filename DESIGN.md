# Design

The BITA app's visual system (approved by Naveen, 6 Nov 2026: "Notion / Vercel" style). Product facts live in `PRODUCT.md`.

## Principles

- **Clean black and white.** White surfaces, near-black ink, and fine grey lines instead of heavy boxes or shadows.
- **Colour only for status**, always as a small dot plus words, never colour alone. Red: overdue, blocked or needs action now. Amber: waiting. Green: done or accepted. Blue: scheduled or informational.
- **One obvious action per row.** The main action is a black button; everything else is a white button with a grey border.
- **Phone and desktop are equal.** Desktop has a left sidebar; phone has a top bar with the menu as a scrolling row. The technician area is phone-first, with big cards and full-width buttons.

## Tokens (in `app/globals.css`)

| Token | Value | Use |
| --- | --- | --- |
| `ink` | #0a0a0a | Text, primary buttons |
| `ink-2` | #4d4d4d | Secondary text |
| `ink-3` | #8f8f8f | Meta text, labels, counts |
| `line` | #ebebeb | Borders and dividers |
| `line-2` | #f2f2f2 | Row separators inside a list |
| `side` | #fafafa | Sidebar and hover surfaces |
| `bad` / `wait` / `ok` / `info` | #dc2626 / #d97706 / #16a34a / #2563eb | Status only |

Type: **Geist** for everything, and **Geist Mono** only for codes and numbers people read character by character (Job IDs, report numbers, serials). Sizes: page title 22px semibold with -0.02em tracking; body 14px; meta 12.5px; the three daily numbers 28px semibold, tabular.

Shape: lists and panels have a 12px radius and a 1px `line` border, with no shadow. Buttons and inputs have an 8px radius. Pills only for small tags.

## Components (`components/ui.tsx`, `components/app-shell.tsx`)

- `AppShell`: sidebar with a menu per role (management, office, reviewer); the technician area has its own phone layout in `app/(field)/layout.tsx`.
- `PageHeader` (title, subtitle, actions), `Stats` (the three daily numbers in one divided strip), `SectionTitle`.
- `List` + `ListRow` (status dot or avatar, title, detail line, one action), `EmptyRow` (says plainly that nothing is waiting).
- `Status` / `StatusDot`, `Badge`, `Mono`, `Avatar`, `Card` (never nested).
- `Button`, `SecondaryButton`, `ButtonLink` (primary, secondary, small), `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `ErrorNote`, `SavedNote`.

Screens use only these components and the tokens above. A new component goes into `components/ui.tsx`; screens never define their own colours or fonts.

## Exceptions

Inspection reports (`templates/reports/`) reproduce BITA's own paper formats exactly, so they follow BITA's layout, not this system.
