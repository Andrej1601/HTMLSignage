import { describe, it, expect } from 'vitest';
import {
  normalizeSeconds,
  resolveNowSeconds,
  DEVICE_FIELD_CONFIG,
  __TEST__
} from '../webroot/admin/js/core/device_service.js';

const { sanitizeStatus, sanitizeMetrics, sanitizeHistory, sanitizeErrors } = __TEST__;

describe('device service helpers', () => {
  it('normalizes various timestamp units', () => {
    expect(normalizeSeconds(1700000000000)).toBe(1700000000);
    expect(normalizeSeconds('170')).toBe(170);
    expect(normalizeSeconds(null)).toBe(0);
    expect(normalizeSeconds('foo')).toBe(0);
  });

  it('resolves current time when missing', () => {
    const result = resolveNowSeconds();
    expect(result).toBeGreaterThan(0);
  });

  it('sanitizes status details with schema aliases', () => {
    const status = sanitizeStatus({
      version: ' 1.2.3 ',
      player: ' Player 4 ',
      address: '192.168.0.10 ',
      notes: 'Needs maintenance',
      network: { interface: 'wifi', signalQuality: 87.4, rssi: -44.1, ssid: 'Guest' },
      errors: [
        { code: 'E1', message: 'Overheat ', ts: 1700000000 },
        'Loose cable'
      ]
    });
    expect(status.firmware).toBe('1.2.3');
    expect(status.network.quality).toBe(87);
    expect(status.network.rssi).toBe(-44);
    expect(status.errors).toHaveLength(2);
    expect(status.errors[0]).toMatchObject({ code: 'E1', message: 'Overheat', ts: 1700000000 });
  });

  it('sanitizes metrics', () => {
    const metrics = sanitizeMetrics({
      cpu: '34.2',
      memoryUsage: 61,
      temperature: '41'
    });
    expect(metrics).toMatchObject({ cpuLoad: 34.2, memoryUsage: 61, temperature: 41 });
  });

  it('sanitizes heartbeat history', () => {
    const history = sanitizeHistory([
      { ts: 1700000000, status: { firmware: '1.0.0' }, metrics: { cpuLoad: 20 } },
      { ts: 'bad' }
    ], 1700000300);
    expect(history).toHaveLength(1);
    expect(history[0].ago).toBe(300);
    expect(history[0].status.firmware).toBe('1.0.0');
  });

  it('exposes schema metadata for shared sanitizers', () => {
    expect(DEVICE_FIELD_CONFIG.status.map((field) => field.name)).toEqual([
      'firmware',
      'appVersion',
      'ip',
      'notes'
    ]);
    const cpuField = DEVICE_FIELD_CONFIG.metrics.find((field) => field.name === 'cpuLoad');
    expect(cpuField.aliases).toContain('cpu');
    const errors = sanitizeErrors([
      { code: 'X', detail: 'Problem', ts: 12 }
    ]);
    expect(errors[0]).toEqual({ code: 'X', ts: 12 });
  });
});
