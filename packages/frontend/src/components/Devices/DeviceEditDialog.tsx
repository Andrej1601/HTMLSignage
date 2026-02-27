import { useState, useEffect } from 'react';
import { Monitor } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';
import { InputField } from '@/components/FormField';
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

  if (!device) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Display bearbeiten"
      titleIcon={
        <div className="p-2 bg-spa-bg-primary rounded-lg">
          <Monitor className="w-6 h-6 text-spa-primary" />
        </div>
      }
      closeDisabled={isSaving}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            form="edit-device-form"
            loading={isSaving}
            loadingText="Speichert..."
          >
            Speichern
          </Button>
        </>
      }
    >
      <form id="edit-device-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Device ID (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-spa-text-secondary mb-1">
            Geräte-ID
          </label>
          <div className="px-4 py-2 bg-spa-bg-primary rounded-lg font-mono text-xs text-spa-text-primary">
            {device.id}
          </div>
        </div>

        <InputField
          label="Display-Name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          placeholder="z.B. Sauna 1 - Haupteingang"
          disabled={isSaving}
          error={error}
          autoFocus
        />

        {/* Mode Selection */}
        <div>
          <label className="block text-sm font-medium text-spa-text-primary mb-1">
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
      </form>
    </Dialog>
  );
}
