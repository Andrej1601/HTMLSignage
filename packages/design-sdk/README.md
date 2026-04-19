# `@htmlsignage/design-sdk`

The contract every HTMLSignage design pack implements. This package
ships three things:

- **Types and schemas** (`src/`) — the shapes packs must target
- **A starter template** (`templates/starter/`) — a full working pack
  skeleton with one stub renderer per slide type
- **A scaffolding CLI** (`bin/new-design.mjs`) — creates a new pack
  from the starter in one command

## Building a new design pack

### 1. Scaffold

From the repo root:

```sh
pnpm new-design mineral-noir \
  --name "Mineral Noir" \
  --description "Architektonischer Dark-Luxus."
```

This creates `packages/designs/mineral-noir/` with:

```
packages/designs/mineral-noir/
├── package.json            — workspace entry for the pack
├── tsconfig.json           — minimal TS config
└── src/
    ├── index.ts            — exports the `Design` object
    ├── manifest.ts         — id, version, capabilities, supported slides
    ├── tokens.ts           — default tokens (colors, typography, spacing…)
    └── slides/
        ├── SchedulePanelRenderer.tsx
        ├── SaunaDetailRenderer.tsx
        ├── InfosSlideRenderer.tsx
        ├── EventsSlideRenderer.tsx
        ├── MediaImageRenderer.tsx
        └── MediaVideoRenderer.tsx
```

The CLI also adds `@htmlsignage/design-mineral-noir` to the frontend's
`package.json` dependencies.

### 2. Install workspace deps

```sh
pnpm install
```

### 3. Register the pack

Open `packages/frontend/src/designs/registry.ts` and add the new pack
id to the `DesignId` union plus a lazy loader entry. The CLI prints the
exact snippet when it finishes.

### 4. Select the pack on a device

In the admin UI, enable design packs (Settings → System → "Design
Packs" card) and choose the new pack id. On the live display, the
pack renders all slide types.

### 5. Iterate

- **Tokens first.** Start in `src/tokens.ts`. The stub renderers style
  exclusively through `tokens.*` — just changing colors / typography /
  spacing there gives you a distinct look without touching renderer
  code.
- **Renderers second.** Once the token palette feels right, rewrite
  renderers one at a time. Consume the headless `data` argument,
  style with `tokens`, respond to `context.viewport` for responsive
  behaviour.
- **Dispatch on variants.** When you want multiple layouts within a
  slide type (list / matrix / timeline for schedule, split / hero /
  portrait for sauna-detail), dispatch on `data.styleHint` inside the
  renderer.

## Rules a pack must follow

1. **No host imports.** Pack code may only import from its own
   `src/`, from `@htmlsignage/design-sdk`, and from peer-deps (React).
   Never reach into `packages/frontend/src/...`.

2. **Style via tokens, not hardcoded.** If you find yourself wanting
   a colour the tokens don't have, extend `tokens.ts` (and the SDK
   `ColorTokens` if it's generally useful), don't hardcode it inline.

3. **Render what `data` gives you.** The host computes `data` via
   pure hooks. Packs must not fetch, re-derive, or mutate it.

4. **Handle empty / missing state.** Every renderer receives a fully
   typed `data` object but individual fields may be `null`/`undefined`
   (no image, zero upcoming entries, etc.). Render an informative
   empty state rather than crashing — the `DesignErrorBoundary` will
   catch runtime throws, but silent mis-renders are worse.

5. **Respond to `viewport`.** The host measures the wrapping element
   and passes `context.viewport` with `isNarrow`, `isShort`,
   `isCompact`, `isUltraCompact`. Use these for responsive decisions
   instead of CSS `@media` queries (the zone may be much smaller
   than the window).

## Anatomy of a Design

```ts
import type { Design } from '@htmlsignage/design-sdk';

export const myDesign: Design = {
  manifest: {
    id: 'my-design',               // matches DesignId in the registry
    version: '0.1.0',
    apiVersion: DESIGN_SDK_API_VERSION,
    name: 'My Design',
    description: '…',
    author: '…',
    supportedSlides: ['content-panel', 'sauna-detail', /* … */],
    capabilities: ['light-mode', 'landscape'],
    status: 'beta',
    defaultTokens: myTokens,
  },
  renderers: {
    'content-panel': SchedulePanelRenderer,
    'sauna-detail': SaunaDetailRenderer,
    /* … */
  },
};
```

The host validates `manifest` with zod at load time
(`safeParseDesignManifest`). Missing `apiVersion` or an incompatible
major version causes the pack to fail-safe: the host falls back to
the legacy renderer path and logs the reason.

## Testing

Pack source is type-checked via the workspace typecheck:

```sh
pnpm --filter @htmlsignage/design-<id> typecheck
```

For live iteration, run the frontend in dev mode (`pnpm frontend`)
and toggle the pack in the admin UI — the hot reload picks up
renderer changes in seconds.
