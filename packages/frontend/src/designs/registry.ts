import type { Design } from '@htmlsignage/design-sdk';
import { isApiVersionCompatible, safeParseDesignManifest } from '@htmlsignage/design-sdk';

export type DesignId =
  | 'wellness-classic'
  | 'wellness-list'
  | 'wellness-timeline'
  | 'modern-oasis'
  | 'editorial-resort'
  | 'mineral-noir';

/**
 * Registry of design packs available to the host.
 *
 * Each entry is a thunk returning a dynamic import. Designs are therefore
 * lazy-loaded — only the active pack lands in the display client bundle.
 *
 * Adding a new design means: (1) add it as a workspace dep in
 * `packages/frontend/package.json`, (2) add a row here, (3) extend
 * `DesignId`.
 */
export const DESIGN_REGISTRY: Record<DesignId, () => Promise<Design>> = {
  'wellness-classic': () =>
    import('@htmlsignage/design-wellness-classic').then((mod) => mod.wellnessClassicDesign),
  'wellness-list': () =>
    import('@htmlsignage/design-wellness-list').then((mod) => mod.wellnessListDesign),
  'wellness-timeline': () =>
    import('@htmlsignage/design-wellness-timeline').then((mod) => mod.wellnessTimelineDesign),
  'modern-oasis': () =>
    import('@htmlsignage/design-modern-oasis').then((mod) => mod.modernOasisDesign),
  'editorial-resort': () =>
    import('@htmlsignage/design-editorial-resort').then((mod) => mod.editorialResortDesign),
  'mineral-noir': () =>
    import('@htmlsignage/design-mineral-noir').then((mod) => mod.mineralNoirDesign),
};

export const DESIGN_IDS = Object.keys(DESIGN_REGISTRY) as DesignId[];

export const DEFAULT_DESIGN_ID: DesignId = 'wellness-classic';

export function isKnownDesignId(value: unknown): value is DesignId {
  return typeof value === 'string' && value in DESIGN_REGISTRY;
}

/**
 * Load a design pack and validate its manifest + API compatibility.
 *
 * Throws with a structured reason if the pack's manifest fails schema
 * validation or targets an incompatible SDK major version. The host
 * catches this and falls back to the legacy renderer path.
 */
export async function loadDesign(id: DesignId): Promise<Design> {
  const loader = DESIGN_REGISTRY[id];
  if (!loader) {
    throw new Error(`Unknown design id: ${id}`);
  }

  const design = await loader();
  const parsed = safeParseDesignManifest(design.manifest);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Design "${id}" has an invalid manifest: ${issues}`);
  }

  if (!isApiVersionCompatible(design.manifest.apiVersion)) {
    throw new Error(
      `Design "${id}" targets SDK ${design.manifest.apiVersion}, incompatible with host.`,
    );
  }

  return design;
}
