import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Check, RefreshCw, Link as LinkIcon } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';
import { InputField } from '@/components/FormField';
import { fetchApi } from '@/services/api';

export function PendingPairings() {
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();
  const [pairingDevice, setPairingDevice] = useState<Device | null>(null);
  const [deviceName, setDeviceName] = useState('');

  // Fetch pending devices (unpaired with pairing codes)
  const { data: pendingDevices = [], refetch, isLoading } = useQuery<Device[]>({
    queryKey: ['devices', 'pending', token],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      if (!token) throw new Error('unauthorized');
      try {
        return await fetchApi<Device[]>('/devices/pending', { token });
      } catch (error) {
        if (error instanceof Error && /nicht authentifiziert|invalid token|session expired|user not found|no token provided/i.test(error.message)) {
          await logout();
          throw new Error('unauthorized');
        }
        throw error;
      }
    },
    refetchInterval: token ? 5000 : false, // Refresh every 5 seconds when authenticated
  });

  // Pair device mutation
  const pairDevice = useMutation({
    mutationFn: async (data: { pairingCode: string; name: string }) => {
      if (!token) throw new Error('unauthorized');
      return fetchApi('/devices/pair', {
        method: 'POST',
        token,
        data,
      });
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

  const handleCloseDialog = () => {
    if (!pairDevice.isPending) {
      setPairingDevice(null);
      setDeviceName('');
    }
  };

  if (pendingDevices.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mb-6">
        <div className="bg-spa-warning-light border border-spa-warning/30 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-spa-warning-dark" />
              <h3 className="text-lg font-semibold text-spa-warning-dark">
                Nicht verbundene Geräte
              </h3>
              {isLoading && (
                <RefreshCw className="w-4 h-4 text-spa-warning-dark animate-spin" />
              )}
            </div>
            <button
              onClick={() => refetch()}
              className="text-sm text-spa-warning-dark hover:underline"
            >
              Aktualisieren
            </button>
          </div>

          <p className="text-sm text-spa-warning-dark/80 mb-4">
            Diese Geräte warten darauf, verbunden zu werden. Der Pairing-Code wird auf dem Gerät angezeigt.
          </p>

          {/* Pending Devices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingDevices.map((device) => (
              <div
                key={device.id}
                className="bg-white rounded-lg p-4 border border-spa-warning/30 hover:border-spa-warning transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-spa-warning-dark" />
                    <span className="text-sm font-medium text-spa-text-primary">
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
                <div className="text-xs text-spa-text-secondary mb-3 space-y-1">
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
                <Button icon={LinkIcon} fullWidth onClick={() => handlePairClick(device)}>
                  Verbinden
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pairing Dialog */}
      <Dialog
        isOpen={Boolean(pairingDevice)}
        onClose={handleCloseDialog}
        title="Gerät verbinden"
        closeDisabled={pairDevice.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseDialog} disabled={pairDevice.isPending}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              form="pair-form"
              icon={Check}
              disabled={!deviceName.trim()}
              loading={pairDevice.isPending}
              loadingText="Verbinde..."
            >
              Verbinden
            </Button>
          </>
        }
      >
        <form id="pair-form" onSubmit={handlePairSubmit} className="space-y-4">
          <div className="bg-spa-bg-primary rounded-lg p-4">
            <div className="text-sm text-spa-text-secondary mb-2">Pairing-Code</div>
            <div className="text-3xl font-bold font-mono text-spa-primary">
              {pairingDevice?.pairingCode}
            </div>
          </div>

          <InputField
            label="Gerätename"
            required
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="z.B. Sauna Haupteingang"
            disabled={pairDevice.isPending}
            hint="Gib dem Gerät einen aussagekräftigen Namen zur Identifikation"
            autoFocus
          />
        </form>
      </Dialog>
    </>
  );
}
