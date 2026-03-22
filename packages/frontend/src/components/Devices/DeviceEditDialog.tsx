import { useState, useEffect, useRef } from 'react';
import { Monitor } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';
import { InputField, ToggleField } from '@/components/FormField';
import { ComboboxField } from '@/components/ComboboxField';
import type { Device, UpdateDeviceRequest } from '@/types/device.types';

interface DeviceEditDialogProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: UpdateDeviceRequest) => void;
  isSaving: boolean;
  /** Existing group names for autocomplete suggestions */
  existingGroups?: string[];
}

export function DeviceEditDialog({
  device,
  isOpen,
  onClose,
  onSave,
  isSaving,
  existingGroups = [],
}: DeviceEditDialogProps) {
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [mode, setMode] = useState<'auto' | 'override'>('auto');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [error, setError] = useState('');
  const initializedDeviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !device) return;
    if (initializedDeviceIdRef.current === device.id) return;

    initializedDeviceIdRef.current = device.id;
    setName(device.name);
    setGroupName(device.groupName || '');
    setMode(device.mode);
    setMaintenanceMode(Boolean(device.maintenanceMode));
    setError('');
  }, [device, isOpen]);

  useEffect(() => {
    if (isOpen) return;
    initializedDeviceIdRef.current = null;
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!device) return;

    if (!name.trim()) {
      setError('Bitte gib einen Namen ein');
      return;
    }

    onSave(device.id, {
      name: name.trim(),
      groupName: groupName.trim() || null,
      mode,
      maintenanceMode,
    });
  };

  const handleClose = () => {
    if (!isSaving) {
      initializedDeviceIdRef.current = null;
      setName('');
      setGroupName('');
      setMode('auto');
      setMaintenanceMode(false);
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

        <div>
          <ComboboxField
            label="Gerätegruppe"
            value={groupName}
            onChange={setGroupName}
            options={existingGroups}
            placeholder="z.B. Saunawelt West"
            createLabel="Neue Gruppe"
          />
          <p className="mt-1 text-xs text-spa-text-secondary">
            Hilft beim Filtern, Gruppieren und bei Bulk-Aktionen.
          </p>
        </div>

        {/* Mode Selection */}
        <fieldset>
          <legend className="block text-sm font-medium text-spa-text-primary mb-1">
            Betriebsmodus
          </legend>
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
        </fieldset>

        <div className="rounded-xl border border-spa-bg-secondary bg-spa-bg-primary/40 p-4">
          <ToggleField
            label="Wartungsmodus"
            description="Markiert das Gerät für Service-, Rollout- oder Diagnosearbeiten."
            checked={maintenanceMode}
            onChange={setMaintenanceMode}
            disabled={isSaving}
          />
        </div>
      </form>
    </Dialog>
  );
}
