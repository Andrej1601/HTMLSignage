import { useState, useEffect } from 'react';
import type { Cell } from '@/types/schedule.types';
import { X, Save, Trash2 } from 'lucide-react';
import { isValidTime } from '@/types/schedule.types';

interface CellEditorProps {
  cell: Cell | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (cell: Cell) => void;
  onDelete?: () => void;
}

export function CellEditor({ cell, isOpen, onClose, onSave, onDelete }: CellEditorProps) {
  const [formData, setFormData] = useState<Cell>({
    time: '12:00',
    title: '',
    subtitle: '',
    badges: [],
    duration: 15,
    notes: '',
  });

  const [badgeInput, setBadgeInput] = useState('');

  useEffect(() => {
    if (cell) {
      setFormData(cell);
    }
  }, [cell]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidTime(formData.time)) {
      alert('Ungültige Zeit. Format: HH:MM');
      return;
    }

    if (!formData.title.trim()) {
      alert('Titel ist erforderlich');
      return;
    }

    onSave(formData);
    onClose();
  };

  const addBadge = () => {
    if (badgeInput.trim()) {
      setFormData({
        ...formData,
        badges: [...(formData.badges || []), badgeInput.trim()],
      });
      setBadgeInput('');
    }
  };

  const removeBadge = (index: number) => {
    setFormData({
      ...formData,
      badges: formData.badges?.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-spa-text-primary">
            {cell ? 'Aufguss bearbeiten' : 'Neuer Aufguss'}
          </h2>
          <button
            onClick={onClose}
            className="text-spa-text-secondary hover:text-spa-text-primary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Uhrzeit *
            </label>
            <input
              type="text"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              placeholder="HH:MM"
              className="w-full px-4 py-2 border border-spa-secondary/30 rounded-md focus:ring-2 focus:ring-spa-primary focus:border-transparent"
              required
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Titel *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="z.B. Fruchtiger Aufguss"
              className="w-full px-4 py-2 border border-spa-secondary/30 rounded-md focus:ring-2 focus:ring-spa-primary focus:border-transparent"
              required
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Untertitel
            </label>
            <input
              type="text"
              value={formData.subtitle || ''}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              placeholder="z.B. mit Orangenduft"
              className="w-full px-4 py-2 border border-spa-secondary/30 rounded-md focus:ring-2 focus:ring-spa-primary focus:border-transparent"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Dauer (Minuten)
            </label>
            <input
              type="number"
              value={formData.duration || 15}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              min="1"
              max="180"
              className="w-full px-4 py-2 border border-spa-secondary/30 rounded-md focus:ring-2 focus:ring-spa-primary focus:border-transparent"
            />
          </div>

          {/* Badges */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Badges
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={badgeInput}
                onChange={(e) => setBadgeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBadge())}
                placeholder="Badge hinzufügen"
                className="flex-1 px-4 py-2 border border-spa-secondary/30 rounded-md focus:ring-2 focus:ring-spa-primary focus:border-transparent"
              />
              <button
                type="button"
                onClick={addBadge}
                className="px-4 py-2 bg-spa-secondary text-white rounded-md hover:bg-spa-secondary-dark transition-colors"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.badges?.map((badge, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-spa-secondary/20 text-spa-secondary-dark rounded-full text-sm"
                >
                  {badge}
                  <button
                    type="button"
                    onClick={() => removeBadge(index)}
                    className="hover:text-spa-text-primary"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Notizen
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Interne Notizen..."
              className="w-full px-4 py-2 border border-spa-secondary/30 rounded-md focus:ring-2 focus:ring-spa-primary focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Löschen
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors"
              >
                <Save className="w-4 h-4" />
                Speichern
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
