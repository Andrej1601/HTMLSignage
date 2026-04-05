import { useState } from 'react';
import { Monitor, AlertCircle } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';
import { InputField } from '@/components/FormField';
import type { CreateDeviceRequest } from '@/types/device.types';

interface DevicePairingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPair: (device: CreateDeviceRequest) => void;
  isPairing: boolean;
}

export function DevicePairingDialog({
  isOpen,
  onClose,
  onPair,
  isPairing
}: DevicePairingDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Bitte gib einen Namen ein');
      return;
    }

    onPair({ name: name.trim(), mode: 'auto' });
  };

  const handleClose = () => {
    if (!isPairing) {
      setName('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Neues Display hinzufügen"
      titleIcon={
        <div className="p-2 bg-spa-bg-primary rounded-lg">
          <Monitor className="w-6 h-6 text-spa-primary" />
        </div>
      }
      closeDisabled={isPairing}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isPairing}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            form="pairing-form"
            loading={isPairing}
            loadingText="Wird gekoppelt..."
          >
            Display koppeln
          </Button>
        </>
      }
    >
      <form id="pairing-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Info Box */}
        <div className="bg-spa-info-light rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-spa-info shrink-0 mt-0.5" />
          <div className="text-sm text-spa-info-dark">
            <p className="font-medium mb-1">So funktioniert das Pairing:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Gib dem Display einen eindeutigen Namen</li>
              <li>Klicke auf &quot;Display koppeln&quot;</li>
              <li>Notiere die angezeigte Geräte-ID</li>
              <li>Trage die ID auf dem Display ein</li>
            </ol>
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
          disabled={isPairing}
          error={error}
          hint="Wähle einen Namen, der das Display eindeutig identifiziert"
          autoFocus
        />
      </form>
    </Dialog>
  );
}
