import { useState } from 'react';
import {
  Monitor,
  Circle,
  Settings,
  RefreshCw,
  Power,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';
import type { Device } from '@/types/device.types';
import {
  getDeviceStatus,
  formatLastSeen,
  getStatusColor,
  getStatusLabel,
  getModeLabel,
} from '@/types/device.types';
import { hasDeviceOverrides } from '@/utils/deviceUtils';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { DeviceSnapshotPreview } from './DeviceSnapshotPreview';

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
  const [expanded, setExpanded] = useState(false);
  const status = getDeviceStatus(device.lastSeen);
  const statusColor = getStatusColor(status);
  const hasOverrides = hasDeviceOverrides(device);
  const isOverrideMode = device.mode === 'override';
  const isOverrideActive = hasOverrides && isOverrideMode;
  const hasGroup = typeof device.groupName === 'string' && device.groupName.trim() !== '';
  const modeBadgeClass = isOverrideMode
    ? 'bg-spa-info-light text-spa-info-dark'
    : 'bg-spa-bg-secondary text-spa-text-secondary';

  return (
    <div className={`bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow ${
      selected ? 'border-spa-primary ring-1 ring-spa-primary/20' : 'border-spa-bg-secondary'
    }`}>
      <div className="p-4 border-b border-spa-bg-secondary">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <label className="flex items-center self-start mt-1">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelection(device.id)}
                aria-label={`${device.name} auswählen`}
                className="h-4 w-4 rounded border-spa-bg-secondary text-spa-primary focus:ring-spa-primary"
              />
            </label>
            <div className="p-2 bg-spa-bg-primary rounded-lg">
              <Monitor className="w-6 h-6 text-spa-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-spa-text-primary truncate">
                {device.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
                  <Circle className="w-2 h-2 fill-current" />
                  {getStatusLabel(status)}
                </span>
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${modeBadgeClass}`}>
                  <Settings className="w-3 h-3" />
                  {getModeLabel(device.mode)}
                </span>
                {hasGroup && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-spa-bg-primary text-spa-text-secondary">
                    {device.groupName}
                  </span>
                )}
                {device.maintenanceMode && (
                  <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-spa-warning-light text-spa-warning-dark">
                    <AlertCircle className="w-3 h-3" />
                    Wartung
                  </span>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu
            ariaLabel="Geräte-Aktionen"
            width="w-56"
            sections={[
              [{ label: 'Bearbeiten', icon: Edit2, onClick: () => onEdit(device) }],
              [
                { label: 'Neu laden', icon: RefreshCw, onClick: () => onReload(device) },
                { label: 'Neustart', icon: Power, onClick: () => onRestart(device) },
                { label: 'Cache leeren', icon: RefreshCw, onClick: () => onClearCache(device) },
              ],
              [{ label: device.maintenanceMode ? 'Wartungsmodus beenden' : 'Wartungsmodus aktivieren', icon: AlertCircle, onClick: () => onToggleMaintenance(device) }],
              [{ label: 'Löschen', icon: Trash2, onClick: () => onDelete(device), variant: 'danger' }],
            ]}
          />
        </div>
      </div>

      {/* Expandable details toggle */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-spa-text-secondary hover:text-spa-text-primary hover:bg-spa-bg-primary/60 transition-colors"
        aria-expanded={expanded}
        aria-label={expanded ? 'Details ausblenden' : 'Details anzeigen'}
      >
        <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
        {expanded ? 'Weniger' : 'Details'}
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          <DeviceSnapshotPreview
            snapshotUrl={device.snapshotUrl}
            capturedAt={device.snapshotCapturedAt}
            alt={`Live-Snapshot von ${device.name}`}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-spa-text-secondary">ID</p>
              <p className="text-spa-text-primary font-mono text-xs mt-1 truncate">
                {device.id}
              </p>
            </div>
            <div>
              <p className="text-spa-text-secondary">Letzte Aktivität</p>
              <p className="text-spa-text-primary font-medium mt-1">
                {formatLastSeen(device.lastSeen)}
              </p>
            </div>
            <div>
              <p className="text-spa-text-secondary">Gruppe</p>
              <p className="text-spa-text-primary font-medium mt-1">
                {hasGroup ? device.groupName : 'Ohne Gruppe'}
              </p>
            </div>
          </div>

          {device.pairedAt && (
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-spa-success mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-spa-text-secondary">
                  Gekoppelt am {new Date(device.pairedAt).toLocaleDateString('de-DE')}
                </p>
              </div>
            </div>
          )}

          {device.maintenanceMode && (
            <div className="flex items-start gap-2 text-sm rounded-lg p-3 bg-spa-warning-light">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-spa-warning-dark" />
              <div className="flex-1">
                <p className="font-medium text-spa-warning-dark">
                  Wartungsmodus aktiv
                </p>
                <p className="text-xs mt-1 text-spa-warning-dark/80">
                  Dieses Display ist für Wartung oder Rollout-Arbeiten markiert und kann gesammelt angesteuert werden.
                </p>
              </div>
            </div>
          )}

          {hasOverrides && (
            <div className={`flex items-start gap-2 text-sm rounded-lg p-3 ${isOverrideActive ? 'bg-spa-info-light' : 'bg-spa-warning-light'}`}>
              <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isOverrideActive ? 'text-spa-info' : 'text-spa-warning'}`} />
              <div className="flex-1">
                <p className={`font-medium ${isOverrideActive ? 'text-spa-info-dark' : 'text-spa-warning-dark'}`}>
                  {isOverrideActive ? 'Device Overrides aktiv' : 'Device Overrides hinterlegt'}
                </p>
                <p className={`text-xs mt-1 ${isOverrideActive ? 'text-spa-info-dark/80' : 'text-spa-warning-dark/80'}`}>
                  {isOverrideActive
                    ? 'Dieses Gerät verwendet angepasste Einstellungen'
                    : 'Overrides sind gespeichert, aber Modus steht auf Automatisch'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
