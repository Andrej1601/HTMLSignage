import { useState, useEffect, useRef } from 'react';
import { Monitor } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';
import { InputField, ToggleField } from '@/components/FormField';
import { ComboboxField } from '@/components/ComboboxField';
import type { Device, UpdateDeviceRequest } from '@/types/device.types';
import type { SlideshowDefinition } from '@/types/slideshow.types';

interface DeviceEditDialogProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: UpdateDeviceRequest) => void;
  isSaving: boolean;
  /** Existing group names for autocomplete suggestions */
  existingGroups?: string[];
  /** Available slideshows for assignment */
  slideshows?: SlideshowDefinition[];
}

export function DeviceEditDialog({
  device,
  isOpen,
  onClose,
  onSave,
  isSaving,
  existingGroups = [],
  slideshows = [],
}: DeviceEditDialogProps) {
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [slideshowId, setSlideshowId] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [error, setError] = useState('');
  const initializedDeviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !device) return;
    if (initializedDeviceIdRef.current === device.id) return;

    initializedDeviceIdRef.current = device.id;
    setName(device.name);
    setGroupName(device.groupName || '');
    setSlideshowId(device.slideshowId || null);
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
      slideshowId: slideshowId || null,
      maintenanceMode,
    });
  };

  const handleClose = () => {
    if (!isSaving) {
      initializedDeviceIdRef.current = null;
      setName('');
      setGroupName('');
      setSlideshowId(null);
      setMaintenanceMode(false);
      setError('');
      onClose();
    }
  };

  if (!device) return null;

  const defaultSlideshow = slideshows.find((s) => s.isDefault);

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

        {/* Slideshow Assignment */}
        <div>
          <label className="block text-sm font-medium text-spa-text-primary mb-1">
            Slideshow
          </label>
          <select
            value={slideshowId || ''}
            onChange={(e) => setSlideshowId(e.target.value || null)}
            disabled={isSaving}
            className="w-full rounded-xl border border-spa-bg-secondary bg-white px-3 py-2.5 text-sm text-spa-text-primary focus:border-spa-primary focus:outline-none focus:ring-2 focus:ring-spa-primary/20 disabled:opacity-60"
          >
            <option value="">
              Standard{defaultSlideshow ? ` (${defaultSlideshow.name})` : ''}
            </option>
            {slideshows
              .filter((s) => !s.isDefault)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-spa-text-secondary">
            Ohne Zuweisung wird die Standard-Slideshow verwendet.
          </p>
        </div>

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
