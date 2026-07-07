# Demo — the same card, guessed vs. token-correct

This directory contains one component, `SettingsCard`, built **twice**:

- [`without.tsx`](./without.tsx) — no design system in context. The model guesses
  every color, size, radius, and spacing value from generic Tailwind muscle memory.
- [`with.tsx`](./with.tsx) — the model is told *"use the design system via the
  tokensmith tools."* Every literal is resolved live through
  `mcp__tokensmith__resolve_token` / `list_tokens` against the **Meridian** token set,
  and each value cites the token path that produced it.
- [`preview.html`](./preview.html) — a zero-dependency static render of both cards
  side by side (`preview.png` is a screenshot of it). Open it in any browser; no build.

Same prompt structure, same layout. The only difference is whether the model could
**read the design system** instead of inventing it.

## The contrast

Every guessed value below is plausible in isolation — and wrong for Meridian. A
human reviewer would have to catch each one by hand in PR. With tokensmith the model
resolves the real value (following alias chains up to 3 deep) and never guesses.

| Role | Token path | Guessed (`without`) | Token-correct (`with`) | Match? |
|---|---|---|---|---|
| Card surface | `color.surface.raised` | `#ffffff` | `#f7f8fa` | ✗ |
| Card border | `color.border.default` | `#e5e7eb` | `#c6ccd4` | ✗ |
| Card radius | `radius.lg` | `12px` | `16px` | ✗ |
| Card padding | `space.inset.card` | `24px` | `16px` | ✗ |
| Font family | `type.family.sans` | `-apple-system, system-ui` | `Inter, system-ui` | ✗ |
| Title size | `type.size.lg` | `18px` | `20px` | ✗ |
| Title weight | `type.weight.bold` | `600` | `700` | ✗ |
| Title color | `color.text.default` | `#111827` | `#161a21` | ✗ |
| Muted text | `color.text.muted` | `#6b7280` | `#5b6472` | ✗ |
| Input radius | `radius.interactive` | `6px` | `8px` | ✗ |
| Input padding | `space.inset.control` | `10px 12px` | `8px` | ✗ |
| **Primary action bg** | `color.action.primary` | `#2563eb` | `#2557c7` | ✗ |
| Primary hover | `color.action.primary-hover` | *(none)* | `#1a419c` | ✗ |
| Button radius | `radius.interactive` | `6px` | `8px` | ✗ |
| Destructive | `color.text.danger` | `#ef4444` | `#c92c3d` | ✗ |

**15 of 15 values guessed wrong.** Not one Tailwind default happened to land on a
Meridian token.

## Why the misses are invisible without tokens

`#2563eb` vs `#2557c7` is a 6-point shift in one channel — it renders as "blue,"
passes visual review, and ships. `radius: 12` vs `16`, `#6b7280` vs `#5b6472` — each
is individually defensible and collectively off-brand. This is exactly the drift a
token system exists to prevent, and exactly the drift an LLM reintroduces the moment
it can't *read* the tokens.

## The alias chains tokensmith resolved

The primary action color isn't a flat hex — it's a 3-deep semantic chain. tokensmith
walks it and returns the computed value plus the full path, so the model uses the
*role* (`action.primary`) while getting the *value* right:

```
color.action.primary  ->  color.brand.primary  ->  color.base.blue-600  =  #2557c7
color.text.danger      ->  color.action.destructive  ->  color.base.red-600  =  #c92c3d
space.inset.card       ->  space.4  =  16px
radius.interactive     ->  radius.md  =  8px
```

That indirection is the whole point: designers rename `base.blue-600` or repoint
`brand.primary` once, and every consumer that asked for `action.primary` moves with
it. The guessed component is frozen at whatever hex the model remembered.

## Reproduce

The token values above were pulled live in-session:

```
mcp__tokensmith__ping                                 -> pong
mcp__tokensmith__resolve_token  color.action.primary  -> #2557c7  (+ 3-path chain)
mcp__tokensmith__list_tokens    color | space | radius | type
```

Point any MCP-capable client at the tokensmith server, load the Meridian example
system (`examples/tokens.json`), and the same resolutions come back.
