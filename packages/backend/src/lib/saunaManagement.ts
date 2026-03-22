/**
 * Updates the status of a specific sauna within a settings data object.
 * Returns the modified data object (mutated in place for the saunas array).
 * Throws if the sauna is not found.
 */
export function updateSaunaStatusInSettings(
  data: Record<string, unknown>,
  saunaId: string,
  status: string,
): Record<string, unknown> {
  const saunas = Array.isArray(data.saunas)
    ? [...data.saunas] as Array<Record<string, unknown>>
    : [];

  const saunaIndex = saunas.findIndex((s) => s.id === saunaId);
  if (saunaIndex === -1) {
    throw new SaunaNotFoundError(saunaId);
  }

  saunas[saunaIndex] = { ...saunas[saunaIndex], status };
  data.saunas = saunas;
  return data;
}

export class SaunaNotFoundError extends Error {
  constructor(public readonly saunaId: string) {
    super(`Sauna ${saunaId} nicht gefunden`);
    this.name = 'SaunaNotFoundError';
  }
}
