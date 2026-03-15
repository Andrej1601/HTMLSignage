import { DeviceCard } from './DeviceCard';
import { getDeviceGroupLabel, type Device } from '@/types/device.types';
import { Monitor } from 'lucide-react';

interface DeviceListProps {
  devices: Device[];
  selectedDeviceIds: string[];
  onToggleSelection: (deviceId: string) => void;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onReload: (device: Device) => void;
  onRestart: (device: Device) => void;
  onClearCache: (device: Device) => void;
  onToggleMaintenance: (device: Device) => void;
}

export function DeviceList({
  devices,
  selectedDeviceIds,
  onToggleSelection,
  onEdit,
  onDelete,
  onReload,
  onRestart,
  onClearCache,
  onToggleMaintenance,
}: DeviceListProps) {
  if (devices.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <Monitor className="w-16 h-16 text-spa-text-secondary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-spa-text-primary mb-2">
          Keine Geräte gefunden
        </h3>
        <p className="text-spa-text-secondary">
          Füge dein erstes Display hinzu, um loszulegen
        </p>
      </div>
    );
  }

  const selectedDeviceIdSet = new Set(selectedDeviceIds);
  const groupedDevices = new Map<string, { label: string; devices: Device[] }>();

  devices.forEach((device) => {
    const groupLabel = getDeviceGroupLabel(device.groupName);
    const groupKey = typeof device.groupName === 'string' && device.groupName.trim() !== ''
      ? device.groupName.trim()
      : '__ungrouped__';
    const existingGroup = groupedDevices.get(groupKey);

    if (existingGroup) {
      existingGroup.devices.push(device);
      return;
    }

    groupedDevices.set(groupKey, { label: groupLabel, devices: [device] });
  });

  return (
    <div className="space-y-6">
      {Array.from(groupedDevices.entries()).map(([groupKey, group]) => (
        <section key={groupKey} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-spa-text-primary">
                {group.label}
              </h3>
              <p className="text-sm text-spa-text-secondary">
                {group.devices.length} Gerät{group.devices.length === 1 ? '' : 'e'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {group.devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                selected={selectedDeviceIdSet.has(device.id)}
                onToggleSelection={onToggleSelection}
                onEdit={onEdit}
                onDelete={onDelete}
                onReload={onReload}
                onRestart={onRestart}
                onClearCache={onClearCache}
                onToggleMaintenance={onToggleMaintenance}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
