import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { DeviceList } from '@/components/Devices/DeviceList';
import { DeviceEditDialog } from '@/components/Devices/DeviceEditDialog';
import { PendingPairings } from '@/components/Devices/PendingPairings';
import {
  useDevices,
  useUpdateDevice,
  useDeleteDevice,
  useSendCommand,
} from '@/hooks/useDevices';
import type { Device, UpdateDeviceRequest } from '@/types/device.types';
import { StatCard } from '@/components/Dashboard/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Monitor, RefreshCw, Wifi, WifiOff, ToggleRight } from 'lucide-react';
import { Button } from '@/components/Button';
import { ErrorAlert } from '@/components/ErrorAlert';

export function DevicesPage() {
  const { data: devices = [], isLoading, error, refetch } = useDevices();
  const updateDevice = useUpdateDevice();
  const deleteDevice = useDeleteDevice();
  const sendCommand = useSendCommand();

  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);

  const handleUpdateDevice = (id: string, updates: UpdateDeviceRequest) => {
    updateDevice.mutate({ id, updates }, {
      onSuccess: () => {
        setEditingDevice(null);
      },
    });
  };

  const handleDeleteDevice = () => {
    if (!deletingDevice) return;

    deleteDevice.mutate(deletingDevice.id, {
      onSuccess: () => {
        setDeletingDevice(null);
      },
    });
  };

  const handleReload = (device: Device) => {
    sendCommand.mutate({
      id: device.id,
      command: { action: 'reload' },
    });
  };

  const handleRestart = (device: Device) => {
    sendCommand.mutate({
      id: device.id,
      command: { action: 'restart' },
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <LoadingSpinner label="Lade Geräte..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <PageHeader title="Geräte" description="Verwalte Displays, Pairings und Ausspielmodi." icon={Monitor} />
        <ErrorAlert error={error} onRetry={() => refetch()} />
      </Layout>
    );
  }

  const pairedDevices = devices.filter((device) => device.pairedAt !== null);
  const pendingPairings = Math.max(devices.length - pairedDevices.length, 0);

  const onlineDevices = pairedDevices.filter((device) => {
    if (!device.lastSeen) return false;
    const lastSeen = new Date(device.lastSeen);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSeen.getTime()) / 1000 / 60;
    return diffMinutes < 5;
  }).length;
  const offlineDevices = Math.max(pairedDevices.length - onlineDevices, 0);
  const overrideDevices = pairedDevices.filter((device) => device.mode === 'override').length;

  return (
    <Layout>
      <div>
        <PageHeader
          title="Geräte"
          description="Verwalte Displays, Pairings und Ausspielmodi zentral an einem Ort."
          icon={Monitor}
          actions={(
            <Button variant="secondary" icon={RefreshCw} onClick={() => refetch()}>
              Aktualisieren
            </Button>
          )}
          badges={[
            { label: `${pairedDevices.length} gekoppelt`, tone: 'info' },
            { label: `${onlineDevices} online`, tone: onlineDevices > 0 ? 'success' : 'neutral' },
            { label: `${offlineDevices} offline`, tone: offlineDevices > 0 ? 'warning' : 'neutral' },
            { label: `${pendingPairings} pending`, tone: pendingPairings > 0 ? 'warning' : 'neutral' },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Gesamt" value={pairedDevices.length} icon={Monitor} color="primary" />
          <StatCard title="Online" value={onlineDevices} icon={Wifi} color="success" />
          <StatCard title="Offline" value={offlineDevices} icon={WifiOff} color={offlineDevices > 0 ? 'warning' : 'neutral'} />
          <StatCard title="Override-Modus" value={overrideDevices} icon={ToggleRight} color="info" />
        </div>

        <PendingPairings />

        {pairedDevices.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Monitor className="w-16 h-16 text-spa-text-secondary mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-spa-text-primary mb-2">
              Keine gekoppelten Geräte
            </h3>
            <p className="text-spa-text-secondary">
              Öffne die Display-URL auf einem Gerät, um eine Kopplungsanfrage zu starten.
            </p>
          </div>
        )}

        <DeviceList
          devices={pairedDevices}
          onEdit={setEditingDevice}
          onDelete={setDeletingDevice}
          onReload={handleReload}
          onRestart={handleRestart}
        />

        <DeviceEditDialog
          device={editingDevice}
          isOpen={Boolean(editingDevice)}
          onClose={() => setEditingDevice(null)}
          onSave={handleUpdateDevice}
          isSaving={updateDevice.isPending}
        />

        <ConfirmDialog
          isOpen={Boolean(deletingDevice)}
          title="Display löschen?"
          message={`Möchtest du das Display "${deletingDevice?.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
          confirmLabel={deleteDevice.isPending ? 'Wird gelöscht...' : 'Löschen'}
          variant="danger"
          onConfirm={handleDeleteDevice}
          onCancel={() => setDeletingDevice(null)}
        />
      </div>
    </Layout>
  );
}
