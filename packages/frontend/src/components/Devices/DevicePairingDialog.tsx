import { useState } from 'react';
import { X, Monitor, AlertCircle } from 'lucide-react';
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

  if (!isOpen) return null;

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
              Neues Display hinzufügen
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isPairing}
            className="p-2 hover:bg-spa-bg-primary rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-spa-text-secondary" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Info Box */}
          <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">So funktioniert das Pairing:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Gib dem Display einen eindeutigen Namen</li>
                <li>Klicke auf "Display koppeln"</li>
                <li>Notiere die angezeigte Geräte-ID</li>
                <li>Trage die ID auf dem Display ein</li>
              </ol>
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
              disabled={isPairing}
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-lg focus:ring-2 focus:ring-spa-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
            />
            {error && (
              <p className="text-red-600 text-sm mt-1">{error}</p>
            )}
            <p className="text-spa-text-secondary text-xs mt-1">
              Wähle einen Namen, der das Display eindeutig identifiziert
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPairing}
              className="flex-1 px-4 py-2 bg-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-secondary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isPairing}
              className="flex-1 px-4 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPairing ? 'Wird gekoppelt...' : 'Display koppeln'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
