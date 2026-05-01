import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog } from '@/components/Dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/Button';
import { InputField } from '@/components/FormField';
import { fetchApi } from '@/services/api';
import { toast } from '@/stores/toastStore';

export function PendingPairings() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [pairingDevice, setPairingDevice] = useState<Device | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [rejectingDevice, setRejectingDevice] = useState<Device | null>(null);

  const { data: pendingDevices = [], isLoading } = useQuery<Device[]>({
    queryKey: ['devices', 'pending'],
    retry: false,
    queryFn: async () => {
      try {
        return await fetchApi<Device[]>('/devices/pending');
      } catch (error) {
        if (error instanceof Error && /nicht authentifiziert|invalid token|session expired|user not found|no token provided/i.test(error.message)) {
          await logout();
          throw new Error('unauthorized');
        }
        throw error;
      }
    },
    refetchInterval: 5000,
  });

  const pairDevice = useMutation({
    mutationFn: async (data: { pairingCode: string; name: string; groupName?: string | null }) => {
      return fetchApi('/devices/pair', {
        method: 'POST',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices', 'pending'] });
      setPairingDevice(null);
      setDeviceName('');
      setGroupName('');
      toast.success('Gerät erfolgreich gekoppelt.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Pairing fehlgeschlagen.');
    },
  });

  const rejectDevice = useMutation({
    mutationFn: async (deviceId: string) => {
      return fetchApi(`/devices/${deviceId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices', 'pending'] });
      setRejectingDevice(null);
      toast.success('Pairing-Anfrage abgelehnt.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Ablehnen fehlgeschlagen.');
    },
  });

  const handlePairClick = (device: Device) => {
    setPairingDevice(device);
    setDeviceName(device.name);
    setGroupName(device.groupName || '');
  };

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingDevice?.pairingCode || !deviceName.trim()) return;

    pairDevice.mutate({
      pairingCode: pairingDevice.pairingCode,
      name: deviceName.trim(),
      groupName: groupName.trim() || null,
    });
  };

  const handleCloseDialog = () => {
    if (!pairDevice.isPending) {
      setPairingDevice(null);
      setDeviceName('');
      setGroupName('');
    }
  };

  if (pendingDevices.length === 0) return null;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-spa-bg-secondary bg-spa-surface">
        {/* Gold accent bar + collapsible header */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between border-l-4 border-l-spa-primary px-6 py-4 text-left"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">📡</span>
            <span className="text-sm font-semibold text-spa-text-primary">
              Ausstehende Pairings ({pendingDevices.length})
            </span>
            {isLoading && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-spa-primary border-t-transparent" />
            )}
          </div>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-spa-text-secondary" />
            : <ChevronDown className="h-4 w-4 text-spa-text-secondary" />
          }
        </button>

        {expanded && (
          <div className="border-t border-spa-bg-secondary px-6 pb-6 pt-4 space-y-4">
            {pendingDevices.map((device) => (
              <div
                key={device.id}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-5 rounded-xl border border-dashed border-spa-bg-secondary bg-spa-surface p-5"
              >
                {/* Pairing Code */}
                <div className="shrink-0 rounded-lg border border-dashed border-spa-text-secondary/30 px-6 py-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-spa-text-secondary">
                    Code
                  </div>
                  <div className="mt-1 text-2xl font-bold tracking-[0.2em] font-mono text-spa-text-primary">
                    {device.pairingCode}
                  </div>
                </div>

                {/* Device Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-spa-text-primary">
                    {device.name}
                  </p>
                  <p className="text-xs text-spa-text-secondary mt-0.5">
                    Anfrage vor {timeSince(device.createdAt)} (IP: {device.id.slice(0, 15)})
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRejectingDevice(device)}
                    disabled={rejectDevice.isPending}
                    className="rounded-lg border border-spa-bg-secondary bg-spa-surface px-4 py-2 text-sm font-medium text-spa-text-primary transition-colors hover:bg-spa-bg-primary disabled:opacity-50"
                  >
                    Ablehnen
                  </button>
                  <Button size="sm" onClick={() => handlePairClick(device)}>
                    Koppeln
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
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
          <div className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary p-4 text-center">
            <div className="text-xs text-spa-text-secondary mb-1">Pairing-Code</div>
            <div className="text-3xl font-bold font-mono text-spa-primary tracking-widest">
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

          <InputField
            label="Gerätegruppe"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="z.B. Saunawelt West"
            disabled={pairDevice.isPending}
            hint="Optional: Das Gerät wird direkt in eine Gruppe einsortiert."
          />
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={Boolean(rejectingDevice)}
        title="Pairing-Anfrage ablehnen?"
        message={
          rejectingDevice
            ? `Code „${rejectingDevice.pairingCode ?? '?'}" wird verworfen. Das Display kann anschließend einen neuen Code anfordern.`
            : ''
        }
        confirmLabel="Ablehnen"
        variant="danger"
        onConfirm={() => {
          if (rejectingDevice) rejectDevice.mutate(rejectingDevice.id);
        }}
        onCancel={() => setRejectingDevice(null)}
      />
    </>
  );
}

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} Std.`;
  return `${Math.floor(hours / 24)} Tagen`;
}
