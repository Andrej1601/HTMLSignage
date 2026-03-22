import { useEffect, useMemo, useState } from 'react';
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

type DeviceGroupFilter = 'all' | '__ungrouped__' | string;

export interface PendingBulkAction {
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

export function getFilterButtonClass(active: boolean): string {
  return active
    ? 'bg-spa-primary text-white shadow-sm'
    : 'bg-spa-bg-primary text-spa-text-secondary hover:bg-spa-bg-secondary';
}

export function useDevicesPageState() {
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const existingGroupNames = useMemo(() => {
    const groups = new Set<string>();
    for (const device of pairedDevices) {
      if (device.groupName) groups.add(device.groupName);
    }
    return Array.from(groups).sort((a, b) => a.localeCompare(b, 'de'));
  }, [pairedDevices]);

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
    sendCommand.mutate({ id: device.id, command: { action: 'reload' } });
  };

  const handleRestart = (device: Device) => {
    sendCommand.mutate({ id: device.id, command: { action: 'restart' } });
  };

  const handleClearCache = (device: Device) => {
    sendCommand.mutate({ id: device.id, command: { action: 'clear-cache' } });
  };

  const handleToggleMaintenance = (device: Device) => {
    updateDevice.mutate({
      id: device.id,
      updates: { maintenanceMode: !device.maintenanceMode },
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
    let filtered = activeGroupFilter === 'all'
      ? pairedDevices
      : pairedDevices.filter((device) => normalizeGroupKey(device.groupName) === activeGroupFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((device) =>
        device.name.toLowerCase().includes(q)
        || device.id.toLowerCase().includes(q)
        || getDeviceGroupLabel(device.groupName).toLowerCase().includes(q),
      );
    }

    return filtered.slice().sort((left, right) => {
      const groupCompare = getDeviceGroupLabel(left.groupName).localeCompare(getDeviceGroupLabel(right.groupName), 'de');
      if (groupCompare !== 0) return groupCompare;
      if (Boolean(left.maintenanceMode) !== Boolean(right.maintenanceMode)) {
        return Number(Boolean(right.maintenanceMode)) - Number(Boolean(left.maintenanceMode));
      }
      return left.name.localeCompare(right.name, 'de');
    });
  }, [activeGroupFilter, pairedDevices, searchQuery]);

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
    setPendingBulkAction({ kind: 'command', action, title, message, confirmLabel });
  };

  const openBulkUpdate = (
    updates: Pick<UpdateDeviceRequest, 'mode' | 'maintenanceMode'>,
    title: string,
    message: string,
    confirmLabel: string,
    variant: PendingBulkAction['variant'] = 'default',
  ) => {
    if (selectedDeviceIds.length === 0) return;
    setPendingBulkAction({ kind: 'update', updates, title, message, confirmLabel, variant });
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
        onSuccess: () => setSelectedDeviceIds([]),
      });
      return;
    }

    if (action.kind === 'update' && action.updates) {
      bulkUpdateDevices.mutate({
        deviceIds,
        updates: action.updates,
      }, {
        onSuccess: () => setSelectedDeviceIds([]),
      });
    }
  };

  return {
    // Query state
    isLoading,
    error,
    refetch,

    // Data
    pairedDevices,
    deviceStats,
    pendingPairings,
    existingGroupNames,
    visibleDevices,
    groupFilters,

    // Selection
    selectedDeviceIds,
    selectedVisibleCount,
    allVisibleSelected,
    toggleVisibleSelection,
    toggleSingleSelection,
    clearSelection: () => setSelectedDeviceIds([]),

    // Filters
    searchQuery,
    setSearchQuery,
    activeGroupFilter,
    setActiveGroupFilter,
    activeFilterLabel,

    // Device actions
    editingDevice,
    setEditingDevice,
    deletingDevice,
    setDeletingDevice,
    handleUpdateDevice,
    handleDeleteDevice,
    handleReload,
    handleRestart,
    handleClearCache,
    handleToggleMaintenance,
    updateDeviceIsPending: updateDevice.isPending,
    deleteDeviceIsPending: deleteDevice.isPending,

    // Bulk actions
    pendingBulkAction,
    setPendingBulkAction,
    openBulkCommand,
    openBulkUpdate,
    handleConfirmBulkAction,
  };
}
