# @htmlsignage/design-sdk

Contract, tokens, and runtime validators for HTMLSignage design packs.

This package defines *what a design is*. Concrete design packs live
under `packages/designs/*` and implement the contract declared here.

---

## Build a design in 30 minutes

### 1. Scaffold the package

```bash
pnpm new-design modern-oasis --name "Modern Oasis"
```

Creates `packages/designs/modern-oasis/` with:

- `src/manifest.ts` — id, version, supported slide types, capabilities.
- `src/tokens.ts` — default `DesignTokens` (colours, typography,
  spacing, radius, motion).
- `src/slides/*.tsx` — six renderer stubs, one per slide type.
- `src/index.ts` — exports the `Design` object.
- `tests/contract.test.ts` — schema + renderer-coverage checks.

### 2. Customize the tokens

Edit `src/tokens.ts`. Values are merged with tenant/slideshow/device
overrides at render time, so the pack only defines its *baseline*.

### 3. Customize the slide renderers

Each renderer is a plain React component receiving:

- `data` — normalized headless data for the slide type (e.g.
  `SaunaDetailData`, `EventsPanelData`). Produced by the host; no
  backend access required in the pack.
- `tokens` — fully resolved `DesignTokens` (pack default + overrides).
- `context` — `{ zoneId, durationMs, locale, viewport, onVideoEnded? }`.
  Use `viewport.isCompact` / `isUltraCompact` to adapt layout; use
  `context.onVideoEnded` inside `MediaVideoRenderer` to let the host
  advance the slideshow.

### 4. Register the pack in the host

Add the workspace dep:

```jsonc
// packages/frontend/package.json
"dependencies": {
  "@htmlsignage/design-modern-oasis": "workspace:*"
}
```

Add a registry entry:

```ts
// packages/frontend/src/designs/registry.ts
export type DesignId = 'wellness-classic' | 'modern-oasis';

export const DESIGN_REGISTRY: Record<DesignId, () => Promise<Design>> = {
  'wellness-classic': () =>
    import('@htmlsignage/design-wellness-classic')
      .then((m) => m.wellnessClassicDesign),
  'modern-oasis': () =>
    import('@htmlsignage/design-modern-oasis')
      .then((m) => m.modernOasisDesign),
};
```

Then:

```bash
pnpm install
pnpm -F @htmlsignage/design-modern-oasis test     # contract test
pnpm -F frontend typecheck                        # host still compiles
npm run build                                     # bundles the new pack
```

### 5. Test live

In the admin under **Einstellungen → System → Design-Packs**:

1. Toggle *"Design-Packs aktivieren"*.
2. Pick `modern-oasis` from the design dropdown.
3. Save.
4. Hard-refresh the display.

---

## Architecture invariants

The host guarantees these contracts; packs can rely on them:

- **No backend access in renderers.** All data is handed to you as
  strongly typed JSON via the `data` prop. Images arrive as resolved
  URLs, times as ISO-8601 strings, status as pre-computed booleans.
- **No global styles.** Packs render self-contained; nothing they do
  should leak out of their container.
- **Viewport measurement is free.** `context.viewport` updates via
  `ResizeObserver`; rely on it for responsive decisions.
- **Token overrides are already merged.** `tokens` is the final value
  — don't re-apply tenant/slideshow overrides inside a renderer.
- **Error boundaries wrap every renderer.** If your renderer throws,
  the host falls back to the previous design or the legacy path.
  This doesn't mean throwing is free — crashes appear in telemetry.

---

## Updating the SDK

Breaking contract changes bump the SDK major version
(`DESIGN_SDK_API_VERSION`). Packs targeting an incompatible major are
rejected by the loader. Keep `manifest.apiVersion` in sync with the
SDK major you develop against.

Additive changes (new optional fields on data shapes, new context
members, new tokens) are minor bumps — existing packs keep working.

---

## Reference

- Contract types: `src/contract.ts`
- Token definitions: `src/tokens.ts`
- Slide-data shapes: `src/slide-data.ts`
- Runtime schemas: `src/schemas.ts`
- Existing pack: `packages/designs/wellness-classic/`
- Scaffolder: `bin/new-design.mjs`
