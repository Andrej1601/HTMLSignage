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
  description?: string; // Beschreibung für Anzeige
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

// Status Colors
export const SAUNA_STATUS_COLORS: Record<SaunaStatus, string> = {
  active: '#10b981', // green
  'no-aufguss': '#f59e0b', // amber
  'out-of-order': '#ef4444', // red
  hidden: '#6b7280', // gray
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
