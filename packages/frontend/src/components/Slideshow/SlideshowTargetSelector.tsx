import { StatusBadge } from '@/components/StatusBadge';
import { SectionCard } from '@/components/SectionCard';
import { Monitor, SlidersHorizontal } from 'lucide-react';
import { getDeviceStatus, getModeLabel, getStatusColor, getStatusLabel } from '@/types/device.types';
import type { Device } from '@/types/device.types';
import type { SlideshowWorkflowEntry } from '@/services/api';
import {
  getDeviceSlideshowSource,
  toDeviceTarget,
  type EditorTarget,
} from '@/pages/slideshowPage.utils';

interface SlideshowTargetSelectorProps {
  target: EditorTarget;
  pairedDevices: Device[];
  draft: SlideshowWorkflowEntry | null;
  disabled: boolean;
  onSelectTarget: (target: EditorTarget) => void;
  onDeviceModeChange: (device: Device, mode: 'auto' | 'override') => void;
}

export function SlideshowTargetSelector({
  target,
  pairedDevices,
  draft,
  disabled,
  onSelectTarget,
  onDeviceModeChange,
}: SlideshowTargetSelectorProps) {
  return (
    <SectionCard
      title="Geräte-Ausspielung"
      icon={Monitor}
    >
      <div className="space-y-1.5">
        <div
          onClick={() => onSelectTarget('global')}
          className={`rounded-lg border px-4 py-2.5 cursor-pointer transition-colors ${
            target === 'global'
              ? 'border-spa-primary bg-spa-primary/5'
              : 'border-spa-bg-secondary hover:border-spa-primary/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="h-4 w-4 text-spa-primary flex-shrink-0" />
            <span className="font-semibold text-sm text-spa-text-primary flex-1">Globale Slideshow</span>
            {target === 'global' && draft && (
              <StatusBadge label="Entwurf" tone="warning" showDot={false} />
            )}
            {target === 'global' && (
              <StatusBadge label="Im Editor" tone="success" showDot={false} />
            )}
          </div>
        </div>

        {pairedDevices.length === 0 ? (
          <div className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary/40 px-4 py-6 text-center text-sm text-spa-text-secondary">
            <Monitor className="w-8 h-8 text-spa-text-secondary mx-auto mb-2" />
            Keine gekoppelten Displays vorhanden.
          </div>
        ) : (
          pairedDevices.map((device) => {
            const source = getDeviceSlideshowSource(device);
            const status = getDeviceStatus(device.lastSeen);
            const statusColor = getStatusColor(status);
            const isSelected = target === toDeviceTarget(device.id);

            return (
              <div
                key={device.id}
                onClick={() => onSelectTarget(toDeviceTarget(device.id))}
                className={`rounded-lg border px-4 py-2.5 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-spa-primary bg-spa-primary/5'
                    : 'border-spa-bg-secondary hover:border-spa-primary/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {getStatusLabel(status)}
                  </span>
                  <span className="font-semibold text-sm text-spa-text-primary flex-1 min-w-0 truncate">{device.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={device.mode}
                      onChange={(event) => onDeviceModeChange(device, event.target.value as 'auto' | 'override')}
                      disabled={disabled}
                      className="rounded-lg border border-spa-bg-secondary px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-spa-primary disabled:opacity-60"
                    >
                      <option value="auto">{getModeLabel('auto')}</option>
                      <option value="override">{getModeLabel('override')}</option>
                    </select>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${source.badgeClass}`}>
                    {source.label}
                  </span>
                  {isSelected && draft && (
                    <StatusBadge label="Entwurf" tone="warning" showDot={false} />
                  )}
                  {isSelected && (
                    <StatusBadge label="Im Editor" tone="success" showDot={false} />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}
