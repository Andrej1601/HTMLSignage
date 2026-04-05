import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '@/services/api';
import { toast } from '@/stores/toastStore';
import type { DeviceOverridesPayload } from '@/services/api';
import type {
  BulkDeviceControlRequest,
  BulkDeviceUpdateRequest,
  CreateDeviceRequest,
  DeviceControlCommand,
  UpdateDeviceRequest,
} from '@/types/device.types';

function invalidateDevices(queryClient: ReturnType<typeof useQueryClient>, deviceId?: string): void {
  queryClient.invalidateQueries({ queryKey: ['devices'] });
  if (deviceId) {
    queryClient.invalidateQueries({ queryKey: ['devices', deviceId] });
  }
}

// Get all devices
export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: devicesApi.getDevices,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Get single device
export function useDevice(id: string) {
  return useQuery({
    queryKey: ['devices', id],
    queryFn: () => devicesApi.getDevice(id),
    enabled: !!id,
  });
}

// Create device mutation
export function useCreateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (device: CreateDeviceRequest) => devicesApi.createDevice(device),
    onSuccess: () => {
      invalidateDevices(queryClient);
      toast.success('Gerät erstellt.');
    },
    onError: () => {
      toast.error('Gerät konnte nicht erstellt werden.');
    },
  });
}

// Update device mutation
export function useUpdateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateDeviceRequest }) =>
      devicesApi.updateDevice(id, updates),
    onSuccess: (_, variables) => {
      invalidateDevices(queryClient, variables.id);
      toast.success('Gerät aktualisiert.');
    },
    onError: () => {
      toast.error('Gerät konnte nicht aktualisiert werden.');
    },
  });
}

// Delete device mutation
export function useDeleteDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => devicesApi.deleteDevice(id),
    onSuccess: () => {
      invalidateDevices(queryClient);
      toast.success('Gerät gelöscht.');
    },
    onError: () => {
      toast.error('Gerät konnte nicht gelöscht werden.');
    },
  });
}

// Send control command mutation
export function useSendCommand() {
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: DeviceControlCommand }) =>
      devicesApi.sendCommand(id, command),
    onSuccess: () => {
      toast.success('Befehl gesendet.');
    },
    onError: () => {
      toast.error('Befehl konnte nicht gesendet werden.');
    },
  });
}

// Bulk update device properties
export function useBulkUpdateDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BulkDeviceUpdateRequest) => devicesApi.bulkUpdateDevices(payload),
    onSuccess: (result) => {
      invalidateDevices(queryClient);
      toast.success(`${result.affectedCount} Gerät${result.affectedCount === 1 ? '' : 'e'} aktualisiert.`);
    },
    onError: () => {
      toast.error('Geräte konnten nicht gesammelt aktualisiert werden.');
    },
  });
}

// Bulk send control commands
export function useBulkSendCommand() {
  return useMutation({
    mutationFn: (payload: BulkDeviceControlRequest) => devicesApi.bulkSendCommand(payload),
    onSuccess: (result) => {
      toast.success(`Befehl an ${result.affectedCount} Gerät${result.affectedCount === 1 ? '' : 'e'} gesendet.`);
    },
    onError: () => {
      toast.error('Befehle konnten nicht gesammelt gesendet werden.');
    },
  });
}

// Set overrides mutation
export function useSetOverrides() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, overrides }: { id: string; overrides: DeviceOverridesPayload }) =>
      devicesApi.setOverrides(id, overrides),
    onSuccess: (_, variables) => {
      invalidateDevices(queryClient, variables.id);
      toast.success('Override gespeichert.');
    },
    onError: () => {
      toast.error('Override konnte nicht gespeichert werden.');
    },
  });
}

// Clear overrides mutation
export function useClearOverrides() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => devicesApi.clearOverrides(id),
    onSuccess: (_, id) => {
      invalidateDevices(queryClient, id);
      toast.success('Override entfernt.');
    },
    onError: () => {
      toast.error('Override konnte nicht entfernt werden.');
    },
  });
}
