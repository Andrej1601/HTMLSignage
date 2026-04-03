import { SectionCard } from '@/components/SectionCard';
import type { Sauna } from '@/types/sauna.types';
import { SAUNA_STATUS_LABELS, SAUNA_STATUS_COLORS } from '@/types/sauna.types';

interface SaunaStatusInfoProps {
  saunas: Sauna[];
}

export function SaunaStatusInfo({ saunas }: SaunaStatusInfoProps) {
  return (
    <SectionCard title="Sauna-Status">
      <div className="flex flex-wrap gap-3">
        {saunas
          .sort((a, b) => a.order - b.order)
          .map((sauna) => (
            <div
              key={sauna.id}
              className="flex items-center gap-2 px-3 py-2 rounded-md border"
              style={{
                borderColor: sauna.color || '#10b981',
                backgroundColor: `${sauna.color || '#10b981'}10`,
              }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: SAUNA_STATUS_COLORS[sauna.status] }}
              />
              <span className="font-medium text-sm">{sauna.name}</span>
              <span className="text-xs text-spa-text-secondary">
                ({SAUNA_STATUS_LABELS[sauna.status]})
              </span>
              {sauna.info?.temperature && (
                <span className="text-xs text-spa-text-secondary ml-2">
                  {sauna.info.temperature}°C
                </span>
              )}
            </div>
          ))}
      </div>
    </SectionCard>
  );
}
