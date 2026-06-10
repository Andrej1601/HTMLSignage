// Sauna Management Types

export type SaunaStatus = 'active' | 'no-aufguss' | 'out-of-order' | 'hidden';

export interface SaunaInfo {
  temperature?: number; // Temperatur in °C
  humidity?: number; // Luftfeuchtigkeit in %
  capacity?: number; // Max. Personenanzahl
  features?: string[]; // z.B. ["Bio", "Finnisch", "Aufguss"]
}

export interface Sauna {
  id: string;
  name: string;
  status: SaunaStatus;
  order: number; // Sortierreihenfolge
  imageId?: string; // Media ID
  color?: string; // Farbe für visuelle Unterscheidung
  info?: SaunaInfo;
  description?: string; // Information/Hinweis (im Display als Info-Badge genutzt)
}

export interface SaunaSettings {
  saunas: Sauna[];
}

// Status Labels
export const SAUNA_STATUS_LABELS: Record<SaunaStatus, string> = {
  active: 'Aufgüsse',
  'no-aufguss': 'Keine Aufgüsse',
  'out-of-order': 'Außer Betrieb',
  hidden: 'Ausgeblendet',
};

// Status Colors — reference the spa theme tokens (CSS variables) so the status
// dots stay consistent with the palette and adapt to light/dark mode. Used in
// inline `style={{ backgroundColor }}`, where CSS var references are valid.
export const SAUNA_STATUS_COLORS: Record<SaunaStatus, string> = {
  active: 'var(--color-spa-success)',
  'no-aufguss': 'var(--color-spa-warning)',
  'out-of-order': 'var(--color-spa-error)',
  hidden: 'var(--color-spa-text-secondary)',
};

// Helper functions
export function getVisibleSaunas(saunas: Sauna[]): Sauna[] {
  return saunas
    .filter((s) => s.status !== 'hidden')
    .sort((a, b) => a.order - b.order);
}

export function getActiveSaunas(saunas: Sauna[]): Sauna[] {
  return saunas
    .filter((s) => s.status === 'active')
    .sort((a, b) => a.order - b.order);
}

export function getSaunaById(saunas: Sauna[], id: string): Sauna | undefined {
  return saunas.find((s) => s.id === id);
}

export function createEmptySauna(): Omit<Sauna, 'id'> {
  return {
    name: '',
    status: 'active',
    order: 0,
    color: '#10b981',
    info: {
      temperature: 90,
      humidity: 10,
    },
  };
}
