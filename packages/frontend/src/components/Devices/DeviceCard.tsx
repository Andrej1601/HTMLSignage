import { useState } from 'react';
import {
  Monitor,
  Circle,
  MoreVertical,
  Settings,
  RefreshCw,
  Power,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { Device } from '@/types/device.types';
import {
  getDeviceStatus,
  formatLastSeen,
  getStatusColor,
  getStatusLabel,
  getModeLabel,
} from '@/types/device.types';

interface DeviceCardProps {
  device: Device;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onReload: (device: Device) => void;
  onRestart: (device: Device) => void;
}

export function DeviceCard({
  device,
  onEdit,
  onDelete,
  onReload,
  onRestart,
}: DeviceCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = getDeviceStatus(device.lastSeen);
  const statusColor = getStatusColor(status);
  const hasScheduleOverride = Boolean(
    device.overrides?.schedule &&
    typeof device.overrides.schedule === 'object' &&
    'presets' in device.overrides.schedule
  );
  const hasSettingsOverride = Boolean(
    device.overrides?.settings &&
    typeof device.overrides.settings === 'object' &&
    Object.keys(device.overrides.settings).length > 0
  );
  const hasOverrides = hasScheduleOverride || hasSettingsOverride;
  const isOverrideMode = device.mode === 'override';
  const isOverrideActive = hasOverrides && isOverrideMode;
  const modeBadgeClass = isOverrideMode
    ? 'bg-blue-100 text-blue-700'
    : 'bg-gray-100 text-gray-700';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-spa-bg-secondary hover:shadow-md transition-shadow">
      <div className="p-4 border-b border-spa-bg-secondary">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 bg-spa-bg-primary rounded-lg">
              <Monitor className="w-6 h-6 text-spa-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-spa-text-primary truncate">
                {device.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
                  <Circle className="w-2 h-2 fill-current" />
                  {getStatusLabel(status)}
                </span>
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${modeBadgeClass}`}>
                  <Settings className="w-3 h-3" />
                  {getModeLabel(device.mode)}
                </span>
              </div>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 hover:bg-spa-bg-primary rounded-lg transition-colors"
              aria-label="Geräte-Aktionen"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-5 h-5 text-spa-text-secondary" aria-hidden="true" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-spa-bg-secondary z-20">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        onEdit(device);
                        setMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-spa-text-primary hover:bg-spa-bg-primary flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Bearbeiten
                    </button>
                    <div className="border-t border-spa-bg-secondary my-1" />
                    <button
                      onClick={() => {
                        onReload(device);
                        setMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-spa-text-primary hover:bg-spa-bg-primary flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Neu laden
                    </button>
                    <button
                      onClick={() => {
                        onRestart(device);
                        setMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-spa-text-primary hover:bg-spa-bg-primary flex items-center gap-2"
                    >
                      <Power className="w-4 h-4" />
                      Neustart
                    </button>
                    <div className="border-t border-spa-bg-secondary my-1" />
                    <button
                      onClick={() => {
                        onDelete(device);
                        setMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Löschen
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
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
        </div>

        {device.pairedAt && (
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-spa-text-secondary">
                Gekoppelt am {new Date(device.pairedAt).toLocaleDateString('de-DE')}
              </p>
            </div>
          </div>
        )}

        {hasOverrides && (
          <div className={`flex items-start gap-2 text-sm rounded-lg p-3 ${isOverrideActive ? 'bg-blue-50' : 'bg-amber-50'}`}>
            <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isOverrideActive ? 'text-blue-600' : 'text-amber-600'}`} />
            <div className="flex-1">
              <p className={`font-medium ${isOverrideActive ? 'text-blue-900' : 'text-amber-900'}`}>
                {isOverrideActive ? 'Device Overrides aktiv' : 'Device Overrides hinterlegt'}
              </p>
              <p className={`text-xs mt-1 ${isOverrideActive ? 'text-blue-700' : 'text-amber-700'}`}>
                {isOverrideActive
                  ? 'Dieses Gerät verwendet angepasste Einstellungen'
                  : 'Overrides sind gespeichert, aber Modus steht auf Automatisch'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
