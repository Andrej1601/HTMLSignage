import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface TimeEditorProps {
  time: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (time: string) => void;
}

export function TimeEditor({ time, isOpen, onClose, onSave }: TimeEditorProps) {
  const [hours, setHours] = useState('12');
  const [minutes, setMinutes] = useState('00');

  useEffect(() => {
    if (time) {
      const [h, m] = time.split(':');
      setHours(h);
      setMinutes(m);
    } else {
      setHours('12');
      setMinutes('00');
    }
  }, [time, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const h = parseInt(hours);
    const m = parseInt(minutes);

    if (h < 0 || h > 23 || m < 0 || m > 59) {
      alert('Ungültige Zeit. Stunden: 0-23, Minuten: 0-59');
      return;
    }

    const formattedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    onSave(formattedTime);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-spa-bg-secondary">
          <h3 className="text-xl font-semibold text-spa-text-primary">
            {time ? 'Zeit bearbeiten' : 'Neue Zeit hinzufügen'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-spa-text-secondary hover:bg-spa-bg-primary rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6">
          <div className="flex gap-4 items-center justify-center">
            {/* Hours */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2 text-center">
                Stunden
              </label>
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                min="0"
                max="23"
                className="w-24 px-4 py-3 text-center text-2xl font-bold border-2 border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                autoFocus
              />
            </div>

            <div className="text-3xl font-bold text-spa-text-primary mt-6">:</div>

            {/* Minutes */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2 text-center">
                Minuten
              </label>
              <input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                min="0"
                max="59"
                className="w-24 px-4 py-3 text-center text-2xl font-bold border-2 border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
              />
            </div>
          </div>

          {/* Quick select buttons */}
          <div className="mt-6">
            <p className="text-sm font-medium text-spa-text-secondary mb-2">Schnellauswahl:</p>
            <div className="grid grid-cols-4 gap-2">
              {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'].map((quickTime) => (
                <button
                  key={quickTime}
                  onClick={() => {
                    const [h, m] = quickTime.split(':');
                    setHours(h);
                    setMinutes(m);
                  }}
                  className="px-3 py-2 text-sm bg-spa-bg-primary hover:bg-spa-primary hover:text-white rounded-md transition-colors"
                >
                  {quickTime}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-6 border-t border-spa-bg-secondary">
          <button
            onClick={onClose}
            className="px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors"
          >
            <Save className="w-4 h-4" />
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
