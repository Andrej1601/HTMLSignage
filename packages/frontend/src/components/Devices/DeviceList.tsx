import { DeviceCard } from './DeviceCard';
import type { Device } from '@/types/device.types';
import { Monitor } from 'lucide-react';

interface DeviceListProps {
  devices: Device[];
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onReload: (device: Device) => void;
  onRestart: (device: Device) => void;
}

export function DeviceList({
  devices,
  onEdit,
  onDelete,
  onReload,
  onRestart,
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {devices.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          onEdit={onEdit}
          onDelete={onDelete}
          onReload={onReload}
          onRestart={onRestart}
        />
      ))}
    </div>
  );
}
