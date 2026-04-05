import { useMemo } from 'react';
import { Calendar, CheckCircle2, Clock3, ImagePlus, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { useMedia } from '@/hooks/useMedia';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import { formatEventWindow } from '../eventManager.utils';
import type { Event } from '@/types/settings.types';
import type { StepProps } from './types';

export function BasicsStep({ formData, setFormData }: StepProps) {
  const { data: media } = useMedia();
  const imageList = useMemo(
    () => (media || []).filter((item) => item.type === 'image'),
    [media],
  );
  const getImageUrl = (imageId?: string) => getMediaUploadUrl(media, imageId);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-spa-text-primary">Event-Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(event) => setFormData({ ...formData, name: event.target.value })}
            className="w-full rounded-lg border border-spa-bg-secondary px-4 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-spa-primary"
            placeholder="z. B. Saunanacht, Frauentag, Sommer-Event"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-spa-text-primary">Beschreibung</label>
          <textarea
            value={formData.description || ''}
            onChange={(event) => setFormData({ ...formData, description: event.target.value })}
            className="min-h-[140px] w-full rounded-lg border border-spa-bg-secondary px-4 py-3 focus:outline-hidden focus:ring-2 focus:ring-spa-primary"
            placeholder="Interner Hinweis oder kurzer Kundentext für dieses Event"
          />
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-spa-text-primary">Status</span>
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
            className={clsx(
              'flex w-full items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors',
              formData.isActive
                ? 'border-spa-success bg-spa-success-light text-spa-success-dark'
                : 'border-spa-bg-secondary bg-spa-bg-primary text-spa-text-secondary',
            )}
          >
            {formData.isActive ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {formData.isActive ? 'Event ist aktivierbar' : 'Event bleibt deaktiviert'}
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-spa-text-primary">
          <ImagePlus className="h-4 w-4" />
          Event-Bild
        </div>
        {imageList.length > 0 ? (
          <>
            <select
              value={formData.imageId || ''}
              onChange={(event) => setFormData({ ...formData, imageId: event.target.value || undefined })}
              className="w-full rounded-lg border border-spa-bg-secondary px-4 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-spa-primary"
            >
              <option value="">Kein Bild</option>
              {imageList.map((image) => (
                <option key={image.id} value={image.id}>
                  {image.originalName}
                </option>
              ))}
            </select>

            <div className="overflow-hidden rounded-2xl border border-spa-bg-secondary bg-white">
              {formData.imageId ? (
                <img
                  src={getImageUrl(formData.imageId) || ''}
                  alt="Event-Vorschau"
                  className="h-64 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-spa-text-secondary">
                  Kein Bild ausgewählt
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-spa-bg-secondary bg-white px-4 py-6 text-sm text-spa-text-secondary">
            Keine Bilder verfügbar. Laden Sie zuerst Medien hoch, wenn das Event eine Bildfläche bekommen soll.
          </div>
        )}
      </div>
    </div>
  );
}

export function TimingStep({ formData, normalizedFormData, setFormData }: StepProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-spa-text-primary">Startdatum *</label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spa-text-secondary" />
          <input
            type="date"
            value={formData.startDate}
            onChange={(event) => setFormData({ ...formData, startDate: event.target.value })}
            className="w-full rounded-lg border border-spa-bg-secondary py-2.5 pl-10 pr-4 focus:outline-hidden focus:ring-2 focus:ring-spa-primary"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-spa-text-primary">Startzeit *</label>
        <div className="relative">
          <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spa-text-secondary" />
          <input
            type="time"
            value={formData.startTime}
            onChange={(event) => setFormData({ ...formData, startTime: event.target.value })}
            className="w-full rounded-lg border border-spa-bg-secondary py-2.5 pl-10 pr-4 focus:outline-hidden focus:ring-2 focus:ring-spa-primary"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-spa-text-primary">Enddatum</label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spa-text-secondary" />
          <input
            type="date"
            value={formData.endDate || ''}
            onChange={(event) => setFormData({ ...formData, endDate: event.target.value || undefined })}
            className="w-full rounded-lg border border-spa-bg-secondary py-2.5 pl-10 pr-4 focus:outline-hidden focus:ring-2 focus:ring-spa-primary"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-spa-text-primary">Endzeit</label>
        <div className="relative">
          <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spa-text-secondary" />
          <input
            type="time"
            value={formData.endTime || ''}
            onChange={(event) => setFormData({ ...formData, endTime: event.target.value || undefined })}
            className="w-full rounded-lg border border-spa-bg-secondary py-2.5 pl-10 pr-4 focus:outline-hidden focus:ring-2 focus:ring-spa-primary"
          />
        </div>
      </div>

      <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-4 text-sm text-spa-text-secondary">
        <div className="font-medium text-spa-text-primary">Geplantes Zeitfenster</div>
        <div className="mt-1">
          {normalizedFormData.startDate && normalizedFormData.startTime
            ? formatEventWindow({
                startDate: normalizedFormData.startDate,
                startTime: normalizedFormData.startTime,
                endDate: normalizedFormData.endDate,
                endTime: normalizedFormData.endTime,
              } as Event)
            : 'Noch nicht vollständig definiert'}
        </div>
      </div>
    </div>
  );
}
