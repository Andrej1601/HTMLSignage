import type { Sauna } from '@/types/sauna.types';
import clsx from 'clsx';

interface SaunaPickerFieldProps {
  saunas: Sauna[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function SaunaPickerField({ saunas, selectedId, onSelect }: SaunaPickerFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-spa-text-primary mb-2">
        Sauna auswählen *
      </label>
      {saunas.length === 0 ? (
        <p className="text-sm text-red-600">
          Keine Saunas konfiguriert. Bitte erstelle zuerst Saunas.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {saunas.map((sauna) => (
            <button
              key={sauna.id}
              onClick={() => onSelect(sauna.id)}
              className={clsx(
                'p-3 rounded-lg border-2 transition-all text-left',
                selectedId === sauna.id
                  ? 'border-spa-primary bg-spa-primary/5'
                  : 'border-spa-bg-secondary hover:border-spa-primary/50'
              )}
              style={{
                borderColor: selectedId === sauna.id ? undefined : sauna.color,
              }}
            >
              <div className="font-semibold text-spa-text-primary">{sauna.name}</div>
              {sauna.info?.temperature && (
                <div className="text-xs text-spa-text-secondary mt-1">
                  {sauna.info.temperature}°C
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
