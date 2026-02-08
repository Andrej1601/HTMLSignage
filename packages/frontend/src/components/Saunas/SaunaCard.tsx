import type { Sauna } from '@/types/sauna.types';
import type { Media } from '@/types/media.types';
import { SAUNA_STATUS_LABELS, SAUNA_STATUS_COLORS } from '@/types/sauna.types';
import { MoreVertical, Edit, Trash2, GripVertical, Thermometer, Droplets, Users } from 'lucide-react';
import { useState } from 'react';
import { useMedia } from '@/hooks/useMedia';
import clsx from 'clsx';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

interface SaunaCardProps {
  sauna: Sauna;
  onEdit: () => void;
  onDelete: () => void;
  isDragging?: boolean;
}

export function SaunaCard({ sauna, onEdit, onDelete, isDragging }: SaunaCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { data: media } = useMedia();

  const statusColor = SAUNA_STATUS_COLORS[sauna.status];

  // Find image filename if imageId is set
  const saunaImage = sauna.imageId ? media?.find((m: Media) => m.id === sauna.imageId) : null;
  const imageUrl = saunaImage ? `${API_URL}/uploads/${saunaImage.filename}` : null;

  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow border-2 transition-all',
        isDragging ? 'opacity-50 border-spa-primary' : 'border-transparent hover:border-spa-bg-secondary'
      )}
    >
      {/* Image */}
      {imageUrl ? (
        <div className="relative h-48 rounded-t-lg overflow-hidden">
          <img
            src={imageUrl}
            alt={sauna.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2">
            <div
              className="px-3 py-1 rounded-full text-white text-sm font-medium"
              style={{ backgroundColor: statusColor }}
            >
              {SAUNA_STATUS_LABELS[sauna.status]}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="h-48 rounded-t-lg flex items-center justify-center"
          style={{ backgroundColor: sauna.color || '#10b981', opacity: 0.1 }}
        >
          <div
            className="px-3 py-1 rounded-full text-white text-sm font-medium"
            style={{ backgroundColor: statusColor }}
          >
            {SAUNA_STATUS_LABELS[sauna.status]}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <GripVertical className="w-5 h-5 text-spa-text-secondary cursor-move" />
            <h3 className="font-semibold text-lg text-spa-text-primary">{sauna.name}</h3>
          </div>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-spa-bg-primary rounded transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-spa-text-secondary" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-white border border-spa-bg-secondary rounded-lg shadow-lg z-20 min-w-[160px]">
                  <button
                    onClick={() => {
                      onEdit();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-spa-bg-primary flex items-center gap-2 text-spa-text-primary"
                  >
                    <Edit className="w-4 h-4" />
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => {
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    Löschen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Info */}
        {sauna.info && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {sauna.info.temperature && (
              <div className="flex items-center gap-1 text-sm text-spa-text-secondary">
                <Thermometer className="w-4 h-4" />
                <span>{sauna.info.temperature}°C</span>
              </div>
            )}
            {sauna.info.humidity && (
              <div className="flex items-center gap-1 text-sm text-spa-text-secondary">
                <Droplets className="w-4 h-4" />
                <span>{sauna.info.humidity}%</span>
              </div>
            )}
            {sauna.info.capacity && (
              <div className="flex items-center gap-1 text-sm text-spa-text-secondary">
                <Users className="w-4 h-4" />
                <span>{sauna.info.capacity}</span>
              </div>
            )}
          </div>
        )}

        {/* Features */}
        {sauna.info?.features && sauna.info.features.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {sauna.info.features.map((feature, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-spa-bg-primary text-spa-text-secondary text-xs rounded-full"
              >
                {feature}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {sauna.description && (
          <p className="text-sm text-spa-text-secondary line-clamp-2">{sauna.description}</p>
        )}

        {/* Color indicator */}
        <div className="mt-3 pt-3 border-t border-spa-bg-secondary flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: sauna.color }}
          />
          <span className="text-xs text-spa-text-secondary">Anzeigefarbe</span>
        </div>
      </div>
    </div>
  );
}
