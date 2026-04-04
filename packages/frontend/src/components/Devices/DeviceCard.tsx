import {
  Circle,
  Edit2,
  Trash2,
  RefreshCw,
  Power,
  AlertCircle,
  Wrench,
} from 'lucide-react';
import type { Device } from '@/types/device.types';
import {
  getDeviceStatus,
  formatLastSeen,
  getStatusLabel,
  getDeviceSlideshowLabel,
} from '@/types/device.types';
import { DeviceSnapshotPreview } from './DeviceSnapshotPreview';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { Button } from '@/components/Button';

interface DeviceCardProps {
  device: Device;
  selected: boolean;
  onToggleSelection: (deviceId: string) => void;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onReload: (device: Device) => void;
  onRestart: (device: Device) => void;
  onClearCache: (device: Device) => void;
  onToggleMaintenance: (device: Device) => void;
}

export function DeviceCard({
  device,
  selected,
  onToggleSelection,
  onEdit,
  onDelete,
  onReload,
  onRestart,
  onClearCache,
  onToggleMaintenance,
}: DeviceCardProps) {
  const status = getDeviceStatus(device.lastSeen);
  const isOnline = status === 'online';
  const slideshowLabel = getDeviceSlideshowLabel(device);

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md ${
        selected ? 'border-spa-primary ring-2 ring-spa-primary/20' : 'border-spa-bg-secondary'
      }`}
    >
      {/* Header: Name + Status */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <label className="flex items-center flex-shrink-0">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSelection(device.id)}
                  aria-label={`${device.name} auswählen`}
                  className="h-4 w-4 rounded border-spa-bg-secondary text-spa-primary focus:ring-spa-primary"
                />
              </label>
              <h3 className="text-base font-semibold text-spa-text-primary truncate">
                {device.name}
              </h3>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${
                isOnline ? 'text-emerald-600' : 'text-red-500'
              }`}>
                <Circle className={`h-2 w-2 fill-current`} />
                {getStatusLabel(status).toUpperCase()}
              </span>
              {device.maintenanceMode && (
                <span className="flex items-center gap-1 text-xs font-medium text-spa-warning-dark">
                  <Wrench className="h-3 w-3" />
                  Wartung
                </span>
              )}
            </div>
          </div>

          <DropdownMenu
            ariaLabel="Geräte-Aktionen"
            width="w-52"
            sections={[
              [
                { label: 'Neu laden', icon: RefreshCw, onClick: () => onReload(device) },
                { label: 'Neustart', icon: Power, onClick: () => onRestart(device) },
                { label: 'Cache leeren', icon: RefreshCw, onClick: () => onClearCache(device) },
              ],
              [{ label: device.maintenanceMode ? 'Wartung beenden' : 'Wartung aktivieren', icon: AlertCircle, onClick: () => onToggleMaintenance(device) }],
              [{ label: 'Löschen', icon: Trash2, onClick: () => onDelete(device), variant: 'danger' }],
            ]}
          />
        </div>
      </div>

      {/* Snapshot */}
      <div className="px-5">
        <DeviceSnapshotPreview
          snapshotUrl={device.snapshotUrl}
          capturedAt={device.snapshotCapturedAt}
          alt={`Snapshot von ${device.name}`}
          compact
        />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 pt-4 pb-2 text-xs">
        <div>
          <span className="text-spa-text-secondary">Device ID</span>
          <p className="font-medium text-spa-text-primary font-mono truncate mt-0.5">
            {device.id.length > 12 ? `${device.id.slice(0, 12)}…` : device.id}
          </p>
        </div>
        <div>
          <span className="text-spa-text-secondary">Zuletzt gesehen</span>
          <p className={`font-medium mt-0.5 ${isOnline ? 'text-emerald-600' : 'text-spa-warning-dark'}`}>
            {formatLastSeen(device.lastSeen)}
          </p>
        </div>
        <div className="col-span-2">
          <span className="text-spa-text-secondary">Slideshow</span>
          <p className="font-medium text-spa-text-primary mt-0.5 truncate">
            {slideshowLabel}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-5 pb-5 pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={() => onEdit(device)}
        >
          Details
        </Button>
        <Button
          size="sm"
          icon={Edit2}
          className="flex-1"
          onClick={() => onEdit(device)}
        >
          Bearbeiten
        </Button>
      </div>
    </div>
  );
}
