import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';

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
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={time ? 'Zeit bearbeiten' : 'Neue Zeit hinzufügen'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button icon={Save} onClick={handleSave}>
            Speichern
          </Button>
        </>
      }
    >
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
            className="w-24 px-4 py-3 text-center text-2xl font-bold border-2 border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary"
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
            className="w-24 px-4 py-3 text-center text-2xl font-bold border-2 border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary"
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
              className="px-3 py-2 text-sm bg-spa-bg-primary hover:bg-spa-primary hover:text-white rounded-lg transition-colors"
            >
              {quickTime}
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
