import { useState, useEffect } from 'react';
import { X, Monitor } from 'lucide-react';
import type { Device, UpdateDeviceRequest } from '@/types/device.types';

interface DeviceEditDialogProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: UpdateDeviceRequest) => void;
  isSaving: boolean;
}

export function DeviceEditDialog({
  device,
  isOpen,
  onClose,
  onSave,
  isSaving
}: DeviceEditDialogProps) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'auto' | 'override'>('auto');
  const [error, setError] = useState('');

  useEffect(() => {
    if (device) {
      setName(device.name);
      setMode(device.mode);
      setError('');
    }
  }, [device]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!device) return;

    if (!name.trim()) {
      setError('Bitte gib einen Namen ein');
      return;
    }

    onSave(device.id, {
      name: name.trim(),
      mode
    });
  };

  const handleClose = () => {
    if (!isSaving) {
      setName('');
      setMode('auto');
      setError('');
      onClose();
    }
  };

  if (!isOpen || !device) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-spa-bg-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-spa-bg-primary rounded-lg">
              <Monitor className="w-6 h-6 text-spa-primary" />
            </div>
            <h2 className="text-xl font-bold text-spa-text-primary">
              Display bearbeiten
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="p-2 hover:bg-spa-bg-primary rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-spa-text-secondary" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Device ID (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-spa-text-secondary mb-2">
              Geräte-ID
            </label>
            <div className="px-4 py-2 bg-spa-bg-primary rounded-lg font-mono text-xs text-spa-text-primary">
              {device.id}
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Display-Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="z.B. Sauna 1 - Haupteingang"
              disabled={isSaving}
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-lg focus:ring-2 focus:ring-spa-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
            />
            {error && (
              <p className="text-red-600 text-sm mt-1">{error}</p>
            )}
          </div>

          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Betriebsmodus
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border border-spa-bg-secondary rounded-lg cursor-pointer hover:bg-spa-bg-primary transition-colors">
                <input
                  type="radio"
                  name="mode"
                  value="auto"
                  checked={mode === 'auto'}
                  onChange={(e) => setMode(e.target.value as 'auto')}
                  disabled={isSaving}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-spa-text-primary">Automatisch</p>
                  <p className="text-sm text-spa-text-secondary">
                    Verwendet globale Einstellungen und Schedule
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-spa-bg-secondary rounded-lg cursor-pointer hover:bg-spa-bg-primary transition-colors">
                <input
                  type="radio"
                  name="mode"
                  value="override"
                  checked={mode === 'override'}
                  onChange={(e) => setMode(e.target.value as 'override')}
                  disabled={isSaving}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-spa-text-primary">Überschrieben</p>
                  <p className="text-sm text-spa-text-secondary">
                    Verwendet individuelle Einstellungen für dieses Gerät
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-secondary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
