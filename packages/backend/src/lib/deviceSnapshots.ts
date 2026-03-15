import fs from 'fs/promises';
import path from 'path';
import { UPLOAD_DIR } from './upload.js';

const DEVICE_SNAPSHOT_DIR = path.join(UPLOAD_DIR, 'device-snapshots');

export interface DeviceSnapshotMeta {
  snapshotUrl: string | null;
  snapshotCapturedAt: string | null;
}

function getSnapshotFileName(deviceId: string): string {
  return `${deviceId}.jpg`;
}

function getSnapshotFilePath(deviceId: string): string {
  return path.join(DEVICE_SNAPSHOT_DIR, getSnapshotFileName(deviceId));
}

export async function saveDeviceSnapshot(deviceId: string, buffer: Buffer): Promise<DeviceSnapshotMeta> {
  await fs.mkdir(DEVICE_SNAPSHOT_DIR, { recursive: true });
  const filePath = getSnapshotFilePath(deviceId);
  await fs.writeFile(filePath, buffer);
  return getDeviceSnapshotMeta(deviceId);
}

export async function deleteDeviceSnapshot(deviceId: string): Promise<void> {
  try {
    await fs.unlink(getSnapshotFilePath(deviceId));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'ENOENT') throw error;
  }
}

export async function getDeviceSnapshotMeta(deviceId: string): Promise<DeviceSnapshotMeta> {
  try {
    const filePath = getSnapshotFilePath(deviceId);
    const stat = await fs.stat(filePath);
    return {
      snapshotUrl: `/uploads/device-snapshots/${getSnapshotFileName(deviceId)}?v=${Math.floor(stat.mtimeMs)}`,
      snapshotCapturedAt: stat.mtime.toISOString(),
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'ENOENT') {
      console.error('[devices] Error reading snapshot meta:', error);
    }
    return {
      snapshotUrl: null,
      snapshotCapturedAt: null,
    };
  }
}

export async function attachDeviceSnapshotMeta<T extends { id: string }>(device: T): Promise<T & DeviceSnapshotMeta> {
  const meta = await getDeviceSnapshotMeta(device.id);
  return {
    ...device,
    ...meta,
  };
}

export async function attachDeviceSnapshotMetaList<T extends { id: string }>(devices: T[]): Promise<Array<T & DeviceSnapshotMeta>> {
  return Promise.all(devices.map((device) => attachDeviceSnapshotMeta(device)));
}
