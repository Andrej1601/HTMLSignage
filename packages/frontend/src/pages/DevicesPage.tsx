import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Monitor,
  Power,
  RefreshCw,
  ToggleRight,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { DeviceList } from '@/components/Devices/DeviceList';
import { DeviceEditDialog } from '@/components/Devices/DeviceEditDialog';
import { PendingPairings } from '@/components/Devices/PendingPairings';
import {
  useBulkSendCommand,
  useBulkUpdateDevices,
  useDeleteDevice,
  useDevices,
  useSendCommand,
  useUpdateDevice,
} from '@/hooks/useDevices';
import {
  getDeviceGroupLabel,
  getDeviceStatus,
  type Device,
  type DeviceControlCommand,
  type UpdateDeviceRequest,
} from '@/types/device.types';
import { StatCard } from '@/components/Dashboard/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/Button';
import { ErrorAlert } from '@/components/ErrorAlert';
import { SectionCard } from '@/components/SectionCard';

type DeviceGroupFilter = 'all' | '__ungrouped__' | string;

interface PendingBulkAction {
  kind: 'command' | 'update';
  title: string;
  message: string;
  confirmLabel: string;
  variant?: 'warning' | 'default';
  action?: DeviceControlCommand['action'];
  updates?: Pick<UpdateDeviceRequest, 'mode' | 'maintenanceMode'>;
}

function normalizeGroupKey(groupName?: string | null): string {
  const trimmed = typeof groupName === 'string' ? groupName.trim() : '';
  return trimmed.length > 0 ? trimmed : '__ungrouped__';
}

function getFilterButtonClass(active: boolean): string {
  return active
    ? 'bg-spa-primary text-white shadow-sm'
    : 'bg-spa-bg-primary text-spa-text-secondary hover:bg-spa-bg-secondary';
}

export function DevicesPage() {
  const { data: devices = [], isLoading, error, refetch } = useDevices();
  const updateDevice = useUpdateDevice();
  const deleteDevice = useDeleteDevice();
  const sendCommand = useSendCommand();
  const bulkUpdateDevices = useBulkUpdateDevices();
  const bulkSendCommand = useBulkSendCommand();

  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [activeGroupFilter, setActiveGroupFilter] = useState<DeviceGroupFilter>('all');
  const [pendingBulkAction, setPendingBulkAction] = useState<PendingBulkAction | null>(null);

  const pairedDevices = useMemo(
    () => devices.filter((device) => device.pairedAt !== null),
    [devices],
  );

  const deviceStats = useMemo(() => {
    let online = 0;
    let offline = 0;
    let override = 0;
    let maintenance = 0;
    for (const device of pairedDevices) {
      const status = getDeviceStatus(device.lastSeen);
      if (status === 'online') online++;
      if (status === 'offline') offline++;
      if (device.mode === 'override') override++;
      if (device.maintenanceMode) maintenance++;
    }
    return { online, offline, override, maintenance };
  }, [pairedDevices]);

  const pendingPairings = Math.max(devices.length - pairedDevices.length, 0);

  useEffect(() => {
    const validIds = new Set(pairedDevices.map((device) => device.id));
    setSelectedDeviceIds((current) => {
      const nextSelection = current.filter((id) => validIds.has(id));

      if (
        nextSelection.length === current.length &&
        nextSelection.every((id, index) => id === current[index])
      ) {
        return current;
      }

      return nextSelection;
    });

    const hasMatchingFilter = activeGroupFilter === 'all'
      || pairedDevices.some((device) => normalizeGroupKey(device.groupName) === activeGroupFilter);

    if (!hasMatchingFilter && activeGroupFilter !== 'all') {
      setActiveGroupFilter('all');
    }
  }, [activeGroupFilter, pairedDevices]);

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
        setSelectedDeviceIds((current) => current.filter((id) => id !== deletingDevice.id));
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

  const handleClearCache = (device: Device) => {
    sendCommand.mutate({
      id: device.id,
      command: { action: 'clear-cache' },
    });
  };

  const handleToggleMaintenance = (device: Device) => {
    updateDevice.mutate({
      id: device.id,
      updates: {
        maintenanceMode: !device.maintenanceMode,
      },
    });
  };

  const groupFilters = useMemo(() => {
    const entries = new Map<string, { label: string; count: number }>();

    for (const device of pairedDevices) {
      const groupKey = normalizeGroupKey(device.groupName);
      const existing = entries.get(groupKey);
      if (existing) {
        existing.count += 1;
      } else {
        entries.set(groupKey, { label: getDeviceGroupLabel(device.groupName), count: 1 });
      }
    }

    return [
      { key: 'all' as const, label: 'Alle Geräte', count: pairedDevices.length },
      ...Array.from(entries.entries())
        .sort((left, right) => left[1].label.localeCompare(right[1].label, 'de'))
        .map(([key, value]) => ({ key, label: value.label, count: value.count })),
    ];
  }, [pairedDevices]);

  const visibleDevices = useMemo(() => {
    const filtered = activeGroupFilter === 'all'
      ? pairedDevices
      : pairedDevices.filter((device) => normalizeGroupKey(device.groupName) === activeGroupFilter);

    return filtered.slice().sort((left, right) => {
      const groupCompare = getDeviceGroupLabel(left.groupName).localeCompare(getDeviceGroupLabel(right.groupName), 'de');
      if (groupCompare !== 0) return groupCompare;
      if (Boolean(left.maintenanceMode) !== Boolean(right.maintenanceMode)) {
        return Number(Boolean(right.maintenanceMode)) - Number(Boolean(left.maintenanceMode));
      }
      return left.name.localeCompare(right.name, 'de');
    });
  }, [activeGroupFilter, pairedDevices]);

  const visibleDeviceIds = visibleDevices.map((device) => device.id);
  const selectedVisibleCount = visibleDeviceIds.filter((id) => selectedDeviceIds.includes(id)).length;
  const allVisibleSelected = visibleDeviceIds.length > 0 && selectedVisibleCount === visibleDeviceIds.length;
  const activeFilterLabel = activeGroupFilter === 'all'
    ? 'Alle Geräte'
    : groupFilters.find((filter) => filter.key === activeGroupFilter)?.label || 'Geräte';

  const toggleVisibleSelection = () => {
    setSelectedDeviceIds((current) => {
      const nextSelection = new Set(current);

      if (allVisibleSelected) {
        visibleDeviceIds.forEach((id) => nextSelection.delete(id));
      } else {
        visibleDeviceIds.forEach((id) => nextSelection.add(id));
      }

      return Array.from(nextSelection);
    });
  };

  const toggleSingleSelection = (deviceId: string) => {
    setSelectedDeviceIds((current) => (
      current.includes(deviceId)
        ? current.filter((id) => id !== deviceId)
        : [...current, deviceId]
    ));
  };

  const openBulkCommand = (
    action: DeviceControlCommand['action'],
    title: string,
    message: string,
    confirmLabel: string,
  ) => {
    if (selectedDeviceIds.length === 0) return;

    setPendingBulkAction({
      kind: 'command',
      action,
      title,
      message,
      confirmLabel,
    });
  };

  const openBulkUpdate = (
    updates: Pick<UpdateDeviceRequest, 'mode' | 'maintenanceMode'>,
    title: string,
    message: string,
    confirmLabel: string,
    variant: PendingBulkAction['variant'] = 'default',
  ) => {
    if (selectedDeviceIds.length === 0) return;

    setPendingBulkAction({
      kind: 'update',
      updates,
      title,
      message,
      confirmLabel,
      variant,
    });
  };

  const handleConfirmBulkAction = () => {
    if (!pendingBulkAction || selectedDeviceIds.length === 0) return;

    const deviceIds = [...selectedDeviceIds];
    const action = pendingBulkAction;
    setPendingBulkAction(null);

    if (action.kind === 'command' && action.action) {
      bulkSendCommand.mutate({
        deviceIds,
        command: { action: action.action },
      }, {
        onSuccess: () => {
          setSelectedDeviceIds([]);
        },
      });
      return;
    }

    if (action.kind === 'update' && action.updates) {
      bulkUpdateDevices.mutate({
        deviceIds,
        updates: action.updates,
      }, {
        onSuccess: () => {
          setSelectedDeviceIds([]);
        },
      });
    }
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

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Geräte"
          description="Verwalte Displays, Gruppen, Wartungszustände und Bulk-Aktionen zentral an einem Ort."
          icon={Monitor}
          actions={(
            <Button variant="secondary" icon={RefreshCw} onClick={() => refetch()}>
              Aktualisieren
            </Button>
          )}
          badges={[
            { label: `${pairedDevices.length} gekoppelt`, tone: 'info' },
            { label: `${deviceStats.online} online`, tone: deviceStats.online > 0 ? 'success' : 'neutral' },
            { label: `${deviceStats.offline} offline`, tone: deviceStats.offline > 0 ? 'warning' : 'neutral' },
            { label: `${deviceStats.maintenance} Wartung`, tone: deviceStats.maintenance > 0 ? 'warning' : 'neutral' },
            { label: `${pendingPairings} pending`, tone: pendingPairings > 0 ? 'warning' : 'neutral' },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard
            title="Gesamt"
            value={pairedDevices.length}
            icon={Monitor}
            color="primary"
            details={[
              { label: 'Filter', value: activeFilterLabel, tone: 'neutral' },
            ]}
          />
          <StatCard title="Online" value={deviceStats.online} icon={Wifi} color="success" />
          <StatCard title="Offline" value={deviceStats.offline} icon={WifiOff} color={deviceStats.offline > 0 ? 'warning' : 'neutral'} />
          <StatCard title="Override-Modus" value={deviceStats.override} icon={ToggleRight} color="info" />
          <StatCard title="Wartung" value={deviceStats.maintenance} icon={Wrench} color={deviceStats.maintenance > 0 ? 'warning' : 'neutral'} />
        </div>

        <PendingPairings />

        <SectionCard
          title="Flottensteuerung"
          description="Filtere Geräte nach Gruppen und führe Aktionen gesammelt aus."
          icon={Wrench}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {groupFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveGroupFilter(filter.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${getFilterButtonClass(activeGroupFilter === filter.key)}`}
                >
                  <span>{filter.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    activeGroupFilter === filter.key
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-spa-text-secondary'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary/30 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-semibold text-spa-text-primary">
                    {selectedDeviceIds.length} Gerät{selectedDeviceIds.length === 1 ? '' : 'e'} ausgewählt
                  </p>
                  <p className="text-sm text-spa-text-secondary">
                    {visibleDevices.length} sichtbar in „{activeFilterLabel}“, davon {selectedVisibleCount} in der aktuellen Auswahl.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={toggleVisibleSelection} disabled={visibleDevices.length === 0}>
                    {allVisibleSelected ? 'Sichtbare abwählen' : 'Sichtbare auswählen'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDeviceIds([])}
                    disabled={selectedDeviceIds.length === 0}
                  >
                    Auswahl löschen
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                <div className="rounded-xl border border-spa-bg-secondary bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spa-text-secondary">
                    Kommandos
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RefreshCw}
                      onClick={() => openBulkCommand(
                        'reload',
                        'Geräte neu laden?',
                        `Die ausgewählten ${selectedDeviceIds.length} Geräte laden ihre Anzeigeinhalte neu.`,
                        'Neu laden',
                      )}
                      disabled={selectedDeviceIds.length === 0}
                    >
                      Reload
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Power}
                      onClick={() => openBulkCommand(
                        'restart',
                        'Geräte neu starten?',
                        `Die ausgewählten ${selectedDeviceIds.length} Geräte erhalten einen Neustart-Befehl.`,
                        'Neustart senden',
                      )}
                      disabled={selectedDeviceIds.length === 0}
                    >
                      Restart
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RefreshCw}
                      onClick={() => openBulkCommand(
                        'clear-cache',
                        'Cache für Geräte leeren?',
                        `Die ausgewählten ${selectedDeviceIds.length} Geräte leeren ihren lokalen Cache und laden danach neu.`,
                        'Cache leeren',
                      )}
                      disabled={selectedDeviceIds.length === 0}
                    >
                      Cache leeren
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-spa-bg-secondary bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spa-text-secondary">
                    Modus
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={ToggleRight}
                      onClick={() => openBulkUpdate(
                        { mode: 'auto' },
                        'Automatikmodus setzen?',
                        `Die ausgewählten ${selectedDeviceIds.length} Geräte wechseln gesammelt in den Automatikmodus.`,
                        'Automatik setzen',
                      )}
                      disabled={selectedDeviceIds.length === 0}
                    >
                      Automatik
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={ToggleRight}
                      onClick={() => openBulkUpdate(
                        { mode: 'override' },
                        'Override-Modus setzen?',
                        `Die ausgewählten ${selectedDeviceIds.length} Geräte wechseln gesammelt in den Override-Modus.`,
                        'Override setzen',
                      )}
                      disabled={selectedDeviceIds.length === 0}
                    >
                      Override
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-spa-bg-secondary bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spa-text-secondary">
                    Wartung
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="warning"
                      size="sm"
                      icon={AlertCircle}
                      onClick={() => openBulkUpdate(
                        { maintenanceMode: true },
                        'Wartungsmodus aktivieren?',
                        `Die ausgewählten ${selectedDeviceIds.length} Geräte werden gesammelt für Wartung und Rollouts markiert.`,
                        'Wartung aktivieren',
                        'warning',
                      )}
                      disabled={selectedDeviceIds.length === 0}
                    >
                      Wartung an
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Wrench}
                      onClick={() => openBulkUpdate(
                        { maintenanceMode: false },
                        'Wartungsmodus beenden?',
                        `Die ausgewählten ${selectedDeviceIds.length} Geräte verlassen gesammelt den Wartungsmodus.`,
                        'Wartung beenden',
                      )}
                      disabled={selectedDeviceIds.length === 0}
                    >
                      Wartung aus
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Gekoppelte Displays"
          description={activeGroupFilter === 'all'
            ? 'Alle verbundenen Geräte im Überblick.'
            : `Gefiltert nach ${activeFilterLabel}.`}
          icon={Monitor}
        >
          {pairedDevices.length === 0 ? (
            <div className="py-8 text-center">
              <Monitor className="w-16 h-16 text-spa-text-secondary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-spa-text-primary mb-2">
                Keine gekoppelten Geräte
              </h3>
              <p className="text-spa-text-secondary">
                Öffne die Display-URL auf einem Gerät, um eine Kopplungsanfrage zu starten.
              </p>
            </div>
          ) : (
            <DeviceList
              devices={visibleDevices}
              selectedDeviceIds={selectedDeviceIds}
              onToggleSelection={toggleSingleSelection}
              onEdit={setEditingDevice}
              onDelete={setDeletingDevice}
              onReload={handleReload}
              onRestart={handleRestart}
              onClearCache={handleClearCache}
              onToggleMaintenance={handleToggleMaintenance}
            />
          )}
        </SectionCard>

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

        <ConfirmDialog
          isOpen={Boolean(pendingBulkAction)}
          title={pendingBulkAction?.title || 'Bulk-Aktion ausführen?'}
          message={pendingBulkAction?.message || ''}
          confirmLabel={pendingBulkAction?.confirmLabel || 'Bestätigen'}
          variant={pendingBulkAction?.variant === 'warning' ? 'warning' : 'default'}
          onConfirm={handleConfirmBulkAction}
          onCancel={() => setPendingBulkAction(null)}
        />
      </div>
    </Layout>
  );
}
