# Warrant design system

Product: security evaluation console (SaaS dashboard + product site).
Audience: reviewers, security engineers, internship/MITACS readers.

## Intent

Calm authority. A warrant is a legal instrument, not a cyber-hud. The interface should feel like a well-set type specimen and a laboratory notebook — precise, quiet, expensive — not a purple AI landing page.

## Style

Apple-informed restraint: translucent chrome, materials with depth, springs that settle without bounce unless the user threw something. One accent. No stacked glass. No emoji icons.

## Color tokens

| Token | Role | Value |
| --- | --- | --- |
| `--bg` | Page | `#0c0b09` warm near-black |
| `--surface` | Cards | `#161410` |
| `--surface-2` | Nested | `#1e1b16` |
| `--ink` | Primary text | `#f3eee4` |
| `--muted` | Secondary | `#9a9386` |
| `--line` | Hairline | `rgba(243, 238, 228, 0.10)` |
| `--accent` | Warrant brass | `#c4a05a` |
| `--safe` | Passed / allowed | `#8fb08a` |
| `--hijack` | Failed / leaked | `#d36b5c` |
| `--blocked` | Guard denied | `#c4a05a` |

Never report attack-stop without benign-pass. Never encode outcome by color alone — always pair with a word.

## Type

- Display: Instrument Serif. Tight leading (~1.05), tracking −0.02em at large sizes.
- UI: Geist. Body 16px / 1.55.
- Data: IBM Plex Mono. Tabular figures for rates.

## Motion

- Default spring: critically damped, ~300–400ms, transform/opacity only.
- Press: scale 0.97 on pointer-down.
- `prefers-reduced-motion`: cross-fade only.
- `prefers-reduced-transparency`: solid chrome, no blur.

## Anti-patterns

Generic Inter + indigo gradient. Neon grids. Emoji as icons. Color-only status. Hover-only actions. Blocking page transitions. Confetti delight.
