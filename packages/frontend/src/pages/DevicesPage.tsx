import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { DeviceList } from '@/components/Devices/DeviceList';
import { DeviceEditDialog } from '@/components/Devices/DeviceEditDialog';
import { PendingPairings } from '@/components/Devices/PendingPairings';
import {
  useDevices,
  useUpdateDevice,
  useDeleteDevice,
  useSendCommand
} from '@/hooks/useDevices';
import type { Device, UpdateDeviceRequest } from '@/types/device.types';
import { RefreshCw, Monitor } from 'lucide-react';

export function DevicesPage() {
  const { data: devices = [], isLoading, refetch } = useDevices();
  const updateDevice = useUpdateDevice();
  const deleteDevice = useDeleteDevice();
  const sendCommand = useSendCommand();

  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);

  const handleUpdateDevice = (id: string, updates: UpdateDeviceRequest) => {
    updateDevice.mutate({ id, updates }, {
      onSuccess: () => {
        setEditingDevice(null);
      }
    });
  };

  const handleDeleteDevice = () => {
    if (!deletingDevice) return;

    deleteDevice.mutate(deletingDevice.id, {
      onSuccess: () => {
        setDeletingDevice(null);
      }
    });
  };

  const handleReload = (device: Device) => {
    sendCommand.mutate({
      id: device.id,
      command: { action: 'reload' }
    });
  };

  const handleRestart = (device: Device) => {
    sendCommand.mutate({
      id: device.id,
      command: { action: 'restart' }
    });
  };

  const handleManageOverrides = (device: Device) => {
    // TODO: Open overrides management dialog
    console.log('Manage overrides for device:', device.id);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-spa-text-secondary">Lade Geräte...</div>
        </div>
      </Layout>
    );
  }

  // Filter to only show paired devices in main list
  const pairedDevices = devices.filter(d => d.pairedAt !== null);

  const onlineDevices = pairedDevices.filter(d => {
    if (!d.lastSeen) return false;
    const lastSeen = new Date(d.lastSeen);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSeen.getTime()) / 1000 / 60;
    return diffMinutes < 5;
  }).length;

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-spa-text-primary mb-2">Geräte</h2>
              <p className="text-spa-text-secondary">
                Verwalte deine Displays und deren Einstellungen
              </p>
            </div>

            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-secondary/20 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Aktualisieren
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-spa-bg-primary rounded-lg">
                  <Monitor className="w-6 h-6 text-spa-primary" />
                </div>
                <div>
                  <p className="text-sm text-spa-text-secondary">Gesamt</p>
                  <p className="text-2xl font-bold text-spa-text-primary">{pairedDevices.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Monitor className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-spa-text-secondary">Online</p>
                  <p className="text-2xl font-bold text-green-600">{onlineDevices}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Monitor className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-spa-text-secondary">Offline</p>
                  <p className="text-2xl font-bold text-orange-600">{pairedDevices.length - onlineDevices}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Pairings */}
        <PendingPairings />

        {/* Device List */}
        <DeviceList
          devices={pairedDevices}
          onEdit={setEditingDevice}
          onDelete={setDeletingDevice}
          onReload={handleReload}
          onRestart={handleRestart}
          onManageOverrides={handleManageOverrides}
        />

        {/* Edit Dialog */}
        <DeviceEditDialog
          device={editingDevice}
          isOpen={!!editingDevice}
          onClose={() => setEditingDevice(null)}
          onSave={handleUpdateDevice}
          isSaving={updateDevice.isPending}
        />

        {/* Delete Confirmation Dialog */}
        {deletingDevice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-spa-text-primary mb-4">
                Display löschen?
              </h3>
              <p className="text-spa-text-secondary mb-6">
                Möchtest du das Display "{deletingDevice.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDeletingDevice(null)}
                  disabled={deleteDevice.isPending}
                  className="flex-1 px-4 py-2 bg-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-secondary/20 transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDeleteDevice}
                  disabled={deleteDevice.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteDevice.isPending ? 'Wird gelöscht...' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
