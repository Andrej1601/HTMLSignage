# @htmlsignage/design-wellness-list

Wellness List — design pack for HTMLSignage.

## Getting started

1. Edit `src/tokens.ts` to set the default palette, typography and spacing.
2. Customize the six slide renderers in `src/slides/*.tsx`. Each receives:
   - `data`: headless data for the slide (typed per slide kind).
   - `tokens`: the merged `DesignTokens` (pack default + any overrides).
   - `context`: zone viewport, locale, video-ended callback.
3. Run `pnpm -F @htmlsignage/design-wellness-list test` to verify the contract.

## Activating this design

The pack is already registered as a workspace dependency. To surface it in
the admin design picker, add an entry to
`packages/frontend/src/designs/registry.ts`:

```ts
import type { Design } from '@htmlsignage/design-sdk';
// ...
export type DesignId = 'wellness-classic' | 'wellness-list';

export const DESIGN_REGISTRY: Record<DesignId, () => Promise<Design>> = {
  'wellness-classic': () =>
    import('@htmlsignage/design-wellness-classic').then((m) => m.wellnessClassicDesign),
  'wellness-list': () =>
    import('@htmlsignage/design-wellness-list').then((m) => m.wellnessListDesign),
};
```

…and add the workspace dep to `packages/frontend/package.json`:

```json
"@htmlsignage/design-wellness-list": "workspace:*",
```

Then `pnpm install` and reload the admin.
