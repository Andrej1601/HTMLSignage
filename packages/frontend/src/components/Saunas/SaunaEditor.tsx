import { useState, useEffect } from 'react';
import type { Sauna, SaunaStatus } from '@/types/sauna.types';
import { SAUNA_STATUS_LABELS, SAUNA_STATUS_COLORS } from '@/types/sauna.types';
import type { Media } from '@/types/media.types';
import { useMedia } from '@/hooks/useMedia';
import { X, Save, Trash2, Image as ImageIcon, Thermometer, Droplets, Users } from 'lucide-react';
import clsx from 'clsx';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

interface SaunaEditorProps {
  sauna: Omit<Sauna, 'id'> | Sauna | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (sauna: Omit<Sauna, 'id'> | Sauna) => void;
  onDelete?: () => void;
}

export function SaunaEditor({ sauna, isOpen, onClose, onSave, onDelete }: SaunaEditorProps) {
  const { data: media } = useMedia();
  const images = media?.filter((m: Media) => m.type === 'image') || [];

  const [formData, setFormData] = useState<Omit<Sauna, 'id'>>({
    name: '',
    status: 'active',
    order: 0,
    color: '#10b981',
    info: {
      temperature: 90,
      humidity: 10,
    },
  });

  const [featureInput, setFeatureInput] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(false);

  useEffect(() => {
    if (sauna) {
      setFormData({
        name: sauna.name,
        status: sauna.status,
        order: sauna.order,
        imageId: sauna.imageId,
        color: sauna.color || '#10b981',
        info: sauna.info || { temperature: 90, humidity: 10 },
        description: sauna.description,
      });
    } else {
      setFormData({
        name: '',
        status: 'active',
        order: 0,
        color: '#10b981',
        info: {
          temperature: 90,
          humidity: 10,
        },
      });
    }
    setFeatureInput('');
  }, [sauna, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Name ist erforderlich');
      return;
    }

    if (sauna && 'id' in sauna) {
      onSave({ ...sauna, ...formData });
    } else {
      onSave(formData);
    }
  };

  const handleAddFeature = () => {
    if (featureInput.trim()) {
      setFormData({
        ...formData,
        info: {
          ...formData.info,
          features: [...(formData.info?.features || []), featureInput.trim()],
        },
      });
      setFeatureInput('');
    }
  };

  const handleRemoveFeature = (index: number) => {
    setFormData({
      ...formData,
      info: {
        ...formData.info,
        features: formData.info?.features?.filter((_, i) => i !== index),
      },
    });
  };

  const selectedImage = images.find((img: Media) => img.id === formData.imageId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-spa-bg-secondary sticky top-0 bg-white z-10">
          <h3 className="text-xl font-semibold text-spa-text-primary">
            {sauna && 'id' in sauna ? 'Sauna bearbeiten' : 'Neue Sauna'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-spa-text-secondary hover:bg-spa-bg-primary rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
              placeholder="z.B. Finnische Sauna"
              autoFocus
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SAUNA_STATUS_LABELS) as SaunaStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setFormData({ ...formData, status })}
                  className={clsx(
                    'px-4 py-3 rounded-md border-2 transition-colors text-left',
                    formData.status === status
                      ? 'border-spa-primary bg-spa-primary text-white'
                      : 'border-spa-bg-secondary hover:border-spa-primary/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: SAUNA_STATUS_COLORS[status] }}
                    />
                    <span className="font-medium">{SAUNA_STATUS_LABELS[status]}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Farbe
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-10 w-20 rounded border border-spa-bg-secondary cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="flex-1 px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                placeholder="#10b981"
              />
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Bild
            </label>
            <div className="space-y-2">
              {selectedImage ? (
                <div className="relative">
                  <img
                    src={`${API_URL}/uploads/${selectedImage.filename}`}
                    alt={selectedImage.originalName}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setFormData({ ...formData, imageId: undefined })}
                    className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowImagePicker(!showImagePicker)}
                  className="w-full px-4 py-8 border-2 border-dashed border-spa-bg-secondary rounded-lg hover:border-spa-primary transition-colors flex flex-col items-center gap-2"
                >
                  <ImageIcon className="w-8 h-8 text-spa-text-secondary" />
                  <span className="text-spa-text-secondary">Bild auswählen</span>
                </button>
              )}

              {showImagePicker && !selectedImage && (
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border border-spa-bg-secondary rounded-lg">
                  {images.map((img: Media) => (
                    <img
                      key={img.id}
                      src={`${API_URL}/uploads/${img.filename}`}
                      alt={img.originalName}
                      className="w-full h-24 object-cover rounded cursor-pointer hover:ring-2 hover:ring-spa-primary transition-all"
                      onClick={() => {
                        setFormData({ ...formData, imageId: img.id });
                        setShowImagePicker(false);
                      }}
                    />
                  ))}
                  {images.length === 0 && (
                    <div className="col-span-3 text-center text-spa-text-secondary py-4">
                      Keine Bilder verfügbar
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Info Section */}
          <div className="border-t border-spa-bg-secondary pt-6">
            <h4 className="text-lg font-semibold text-spa-text-primary mb-4">Sauna-Informationen</h4>

            <div className="grid grid-cols-3 gap-4">
              {/* Temperature */}
              <div>
                <label className="block text-sm font-medium text-spa-text-primary mb-2 flex items-center gap-2">
                  <Thermometer className="w-4 h-4" />
                  Temperatur (°C)
                </label>
                <input
                  type="number"
                  value={formData.info?.temperature || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      info: { ...formData.info, temperature: parseInt(e.target.value) || undefined },
                    })
                  }
                  className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                  placeholder="90"
                />
              </div>

              {/* Humidity */}
              <div>
                <label className="block text-sm font-medium text-spa-text-primary mb-2 flex items-center gap-2">
                  <Droplets className="w-4 h-4" />
                  Luftfeuchtigkeit (%)
                </label>
                <input
                  type="number"
                  value={formData.info?.humidity || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      info: { ...formData.info, humidity: parseInt(e.target.value) || undefined },
                    })
                  }
                  className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                  placeholder="10"
                />
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-sm font-medium text-spa-text-primary mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Kapazität
                </label>
                <input
                  type="number"
                  value={formData.info?.capacity || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      info: { ...formData.info, capacity: parseInt(e.target.value) || undefined },
                    })
                  }
                  className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                  placeholder="12"
                />
              </div>
            </div>

            {/* Features */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Merkmale
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFeature()}
                  className="flex-1 px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                  placeholder="z.B. Bio, Finnisch, Sanarium..."
                />
                <button
                  onClick={handleAddFeature}
                  className="px-4 py-2 bg-spa-secondary text-white rounded-md hover:bg-spa-secondary-dark transition-colors"
                >
                  Hinzufügen
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.info?.features?.map((feature, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-spa-primary/10 text-spa-primary rounded-full text-sm"
                  >
                    {feature}
                    <button
                      onClick={() => handleRemoveFeature(index)}
                      className="p-0.5 hover:bg-spa-primary/20 rounded-full transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Beschreibung
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
              placeholder="Zusätzliche Informationen zur Sauna..."
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-spa-bg-secondary sticky bottom-0 bg-white">
          <div>
            {onDelete && (
              <button
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
    </div>
  );
}
