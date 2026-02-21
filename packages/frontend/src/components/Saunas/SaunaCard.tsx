import type { Sauna } from '@/types/sauna.types';
import { SAUNA_STATUS_LABELS, SAUNA_STATUS_COLORS } from '@/types/sauna.types';
import { Edit, Trash2, GripVertical, Thermometer, Droplets, Users } from 'lucide-react';
import { useMedia } from '@/hooks/useMedia';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import clsx from 'clsx';
import { DropdownMenu } from '@/components/ui/DropdownMenu';

interface SaunaCardProps {
  sauna: Sauna;
  onEdit: () => void;
  onDelete: () => void;
  isDragging?: boolean;
}

export function SaunaCard({ sauna, onEdit, onDelete, isDragging }: SaunaCardProps) {
  const { data: media } = useMedia();

  const statusColor = SAUNA_STATUS_COLORS[sauna.status];

  // Find image filename if imageId is set
  const imageUrl = getMediaUploadUrl(media, sauna.imageId);

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
            loading="lazy"
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
          <DropdownMenu
            ariaLabel="Sauna-Aktionen"
            width="w-40"
            sections={[
              [{ label: 'Bearbeiten', icon: Edit, onClick: onEdit }],
              [{ label: 'Löschen', icon: Trash2, onClick: onDelete, variant: 'danger' }],
            ]}
          />
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
