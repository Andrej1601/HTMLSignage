import type { InfoItem } from '@/types/settings.types';

interface InfoPickerFieldProps {
  infos: InfoItem[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}

export function InfoPickerField({ infos, selectedId, onSelect }: InfoPickerFieldProps) {
  const selectedInfo = infos.find((i) => i.id === selectedId);

  return (
    <div>
      <label className="block text-sm font-medium text-spa-text-primary mb-2">
        Info auswählen *
      </label>
      {infos.length === 0 ? (
        <p className="text-sm text-red-600">
          Keine Infos konfiguriert. Bitte lege zuerst Infos unter Einstellungen → Infos an.
        </p>
      ) : (
        <div className="space-y-2">
          <select
            value={selectedId || ''}
            onChange={(e) => onSelect(e.target.value || undefined)}
            className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
          >
            <option value="">Bitte wählen...</option>
            {infos.map((info) => (
              <option key={info.id} value={info.id}>
                {info.title}
              </option>
            ))}
          </select>
          {selectedInfo && (
            <div className="text-xs text-spa-text-secondary bg-spa-bg-primary rounded-md p-3 border border-spa-bg-secondary">
              {selectedInfo.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
