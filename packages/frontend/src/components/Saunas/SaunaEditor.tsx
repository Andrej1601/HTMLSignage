import { useState, useEffect } from 'react';
import type { Sauna, SaunaStatus } from '@/types/sauna.types';
import { SAUNA_STATUS_LABELS, SAUNA_STATUS_COLORS } from '@/types/sauna.types';
import type { Media } from '@/types/media.types';
import { useMedia } from '@/hooks/useMedia';
import { buildUploadUrl } from '@/utils/mediaUrl';
import { Save, Trash2, Image as ImageIcon, Thermometer, Droplets, Users, X } from 'lucide-react';
import clsx from 'clsx';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';
import { InputField, TextareaField } from '@/components/FormField';

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
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={sauna && 'id' in sauna ? 'Sauna bearbeiten' : 'Neue Sauna'}
      size="xl"
      footerLeft={
        onDelete ? (
          <Button variant="danger" icon={Trash2} onClick={onDelete}>
            Löschen
          </Button>
        ) : undefined
      }
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
      <div className="space-y-6">
        <InputField
          label="Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="z.B. Finnische Sauna"
          autoFocus
        />

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-spa-text-primary mb-1">
            Status
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SAUNA_STATUS_LABELS) as SaunaStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setFormData({ ...formData, status })}
                className={clsx(
                  'px-4 py-3 rounded-lg border-2 transition-colors text-left',
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
          <label className="block text-sm font-medium text-spa-text-primary mb-1">
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
              className="flex-1 px-4 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary"
              placeholder="#10b981"
            />
          </div>
        </div>

        {/* Image */}
        <div>
          <label className="block text-sm font-medium text-spa-text-primary mb-1">
            Bild
          </label>
          <div className="space-y-2">
            {selectedImage ? (
              <div className="relative">
                <img
                  src={buildUploadUrl(selectedImage.filename)}
                  alt={selectedImage.originalName}
                  className="w-full h-48 object-cover rounded-lg"
                  loading="lazy"
                />
                <Button
                  variant="danger"
                  size="sm"
                  icon={X}
                  onClick={() => setFormData({ ...formData, imageId: undefined })}
                  className="absolute top-2 right-2"
                  aria-label="Bild entfernen"
                />
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
                    src={buildUploadUrl(img.filename)}
                    alt={img.originalName}
                    className="w-full h-24 object-cover rounded cursor-pointer hover:ring-2 hover:ring-spa-primary transition-all"
                    loading="lazy"
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
              <label className="block text-sm font-medium text-spa-text-primary mb-1 flex items-center gap-2">
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
                className="w-full px-4 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary"
                placeholder="90"
              />
            </div>

            {/* Humidity */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-1 flex items-center gap-2">
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
                className="w-full px-4 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary"
                placeholder="10"
              />
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-1 flex items-center gap-2">
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
                className="w-full px-4 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary"
                placeholder="12"
              />
            </div>
          </div>

          {/* Features */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-spa-text-primary mb-1">
              Merkmale
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}
                className="flex-1 px-4 py-2 border border-spa-bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-spa-primary"
                placeholder="z.B. Bio, Finnisch, Sanarium..."
              />
              <Button variant="secondary" onClick={handleAddFeature}>
                Hinzufügen
              </Button>
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

        <TextareaField
          label="Information"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Hinweis für die Anzeige (eine Zeile = ein Info-Badge)..."
          rows={3}
        />
      </div>
    </Dialog>
  );
}
