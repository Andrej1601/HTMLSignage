/**
 * Design SDK API version.
 *
 * A design pack declares which API it implements via `manifest.apiVersion`.
 * The core loader only mounts designs whose `apiVersion` matches the major
 * version of this constant. Breaking changes to the contract require a major
 * bump and a migration path for designs.
 *
 * Semver is interpreted as: "major" = incompatible contract change,
 * "minor" = additive contract change (old designs still work),
 * "patch" = non-contract fix.
 */
export const DESIGN_SDK_API_VERSION = '1.0.0' as const;

export function isApiVersionCompatible(designApiVersion: string): boolean {
  const designMajor = designApiVersion.split('.')[0];
  const sdkMajor = DESIGN_SDK_API_VERSION.split('.')[0];
  return designMajor === sdkMajor;
}
