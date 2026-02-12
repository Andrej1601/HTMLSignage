import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Check, RefreshCw, Link as LinkIcon } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config/env';

export function PendingPairings() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [pairingDevice, setPairingDevice] = useState<Device | null>(null);
  const [deviceName, setDeviceName] = useState('');

  // Fetch pending devices (unpaired with pairing codes)
  const { data: pendingDevices = [], refetch, isLoading } = useQuery<Device[]>({
    queryKey: ['devices', 'pending'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/devices/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch pending devices');
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Pair device mutation
  const pairDevice = useMutation({
    mutationFn: async (data: { pairingCode: string; name: string }) => {
      const response = await fetch(`${API_URL}/api/devices/pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Pairing failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices', 'pending'] });
      setPairingDevice(null);
      setDeviceName('');
    },
  });

  const handlePairClick = (device: Device) => {
    setPairingDevice(device);
    setDeviceName(device.name);
  };

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingDevice?.pairingCode || !deviceName.trim()) return;

    pairDevice.mutate({
      pairingCode: pairingDevice.pairingCode,
      name: deviceName.trim(),
    });
  };

  if (pendingDevices.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-yellow-600" />
              <h3 className="text-lg font-semibold text-yellow-900">
                Nicht verbundene Geräte
              </h3>
              {isLoading && (
                <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />
              )}
            </div>
            <button
              onClick={() => refetch()}
              className="text-sm text-yellow-700 hover:text-yellow-900 underline"
            >
              Aktualisieren
            </button>
          </div>

          <p className="text-sm text-yellow-800 mb-4">
            Diese Geräte warten darauf, verbunden zu werden. Der Pairing-Code wird auf dem Gerät angezeigt.
          </p>

          {/* Pending Devices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingDevices.map((device) => (
              <div
                key={device.id}
                className="bg-white rounded-lg p-4 border border-yellow-200 hover:border-yellow-400 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm font-medium text-gray-900">
                      {device.name}
                    </span>
                  </div>
                </div>

                {/* Pairing Code Display */}
                <div className="bg-gradient-to-br from-spa-primary to-spa-primary-dark text-white rounded-lg p-4 mb-3">
                  <div className="text-xs opacity-75 mb-1">Pairing-Code</div>
                  <div className="text-3xl font-bold tracking-wider font-mono">
                    {device.pairingCode}
                  </div>
                </div>

                {/* Device Info */}
                <div className="text-xs text-gray-500 mb-3 space-y-1">
                  <div>ID: {device.id.slice(0, 12)}...</div>
                  <div>Erstellt: {new Date(device.createdAt).toLocaleString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}</div>
                </div>

                {/* Connect Button */}
                <button
                  onClick={() => handlePairClick(device)}
                  className="w-full px-4 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <LinkIcon className="w-4 h-4" />
                  Verbinden
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pairing Dialog */}
      {pairingDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-spa-text-primary">
                Gerät verbinden
              </h3>
              <button
                onClick={() => {
                  setPairingDevice(null);
                  setDeviceName('');
                }}
                disabled={pairDevice.isPending}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePairSubmit} className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-600 mb-2">Pairing-Code</div>
                <div className="text-3xl font-bold font-mono text-spa-primary">
                  {pairingDevice.pairingCode}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-spa-text-primary mb-2">
                  Gerätename *
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="z.B. Sauna Haupteingang"
                  required
                  disabled={pairDevice.isPending}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-spa-primary focus:border-transparent"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Gib dem Gerät einen aussagekräftigen Namen zur Identifikation
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setPairingDevice(null);
                    setDeviceName('');
                  }}
                  disabled={pairDevice.isPending}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={pairDevice.isPending || !deviceName.trim()}
                  className="flex-1 px-4 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {pairDevice.isPending ? 'Verbinde...' : 'Verbinden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
