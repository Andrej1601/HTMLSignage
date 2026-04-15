import { useMemo } from 'react';
import { Button } from '@/components/Button';
import { SectionCard } from '@/components/SectionCard';
import { useDevices } from '@/hooks/useDevices';
import { useMedia } from '@/hooks/useMedia';
import { PRESET_LABELS } from '@/types/schedule.types';
import { isEventActive, type Event } from '@/types/settings.types';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import { Calendar, Edit2, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { formatEventWindow, sortEventsByStartDesc } from './eventManager.utils';

interface EventListCardProps {
  events: Event[];
  onEdit: (event: Event) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string) => void;
}

export function EventListCard({ events, onEdit, onDelete, onToggleActive }: EventListCardProps) {
  const { data: media } = useMedia();
  const { data: devices } = useDevices();

  const pairedDevices = useMemo(
    () => (devices || []).filter((device) => Boolean(device.pairedAt)),
    [devices],
  );

  const sortedEvents = useMemo(
    () => sortEventsByStartDesc(events),
    [events],
  );

  const getImageUrl = (imageId?: string) => getMediaUploadUrl(media, imageId);

  return (
    <SectionCard
      title="Geplante Events"
      description={`${events.length} Event${events.length === 1 ? '' : 's'} vorbereitet`}
      icon={Calendar}
    >
      {sortedEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-spa-bg-secondary bg-spa-bg-primary px-4 py-12 text-center text-spa-text-secondary">
          <Calendar className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="font-medium">Noch keine Events vorhanden</p>
          <p className="mt-1 text-sm">Mit dem Assistenten können Sie komplette Event-Slots inklusive Zielgeräten und Musik vorbereiten.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedEvents.map((event) => {
            const imageUrl = getImageUrl(event.imageId);
            const isCurrentlyActive = isEventActive(event);
            const targetDeviceNames = pairedDevices
              .filter((device) => event.targetDeviceIds?.includes(device.id))
              .map((device) => device.name);
            const targetLabel = targetDeviceNames.length > 0
              ? targetDeviceNames.join(', ')
              : event.targetDeviceIds?.length
                ? `${event.targetDeviceIds.length} Gerät${event.targetDeviceIds.length === 1 ? '' : 'e'}`
                : 'Alle Geräte';

            return (
              <div
                key={event.id}
                className={clsx(
                  'rounded-2xl border p-4 transition-colors',
                  isCurrentlyActive
                    ? 'border-spa-success bg-spa-success-light/40'
                    : event.isActive
                      ? 'border-spa-bg-secondary bg-spa-surface hover:bg-spa-bg-primary/50'
                      : 'border-spa-bg-secondary bg-spa-bg-primary/60 opacity-75',
                )}
              >
                <div className="flex flex-col gap-4 xl:flex-row">
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={event.name}
                      className="h-40 w-full rounded-2xl object-cover xl:w-64"
                      loading="lazy"
                    />
                  )}

                  <div className="flex-1 space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold text-spa-text-primary">{event.name}</h4>
                          {isCurrentlyActive && (
                            <span className="rounded-full bg-spa-success px-3 py-1 text-xs font-semibold text-white">
                              Läuft jetzt
                            </span>
                          )}
                          {!event.isActive && (
                            <span className="rounded-full bg-spa-bg-secondary px-3 py-1 text-xs font-semibold text-spa-text-secondary">
                              Inaktiv
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="mt-1 text-sm text-spa-text-secondary">{event.description}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleActive(event.id)}
                        >
                          {event.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Edit2}
                          onClick={() => onEdit(event)}
                        >
                          Bearbeiten
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={() => onDelete(event.id)}
                        >
                          Löschen
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl bg-spa-bg-primary px-3 py-2 text-sm text-spa-text-secondary">
                        <div className="font-medium text-spa-text-primary">Zeitfenster</div>
                        <div className="mt-1">{formatEventWindow(event)}</div>
                      </div>
                      <div className="rounded-xl bg-spa-bg-primary px-3 py-2 text-sm text-spa-text-secondary">
                        <div className="font-medium text-spa-text-primary">Plan</div>
                        <div className="mt-1">{PRESET_LABELS[event.assignedPreset] || event.assignedPreset}</div>
                      </div>
                      <div className="rounded-xl bg-spa-bg-primary px-3 py-2 text-sm text-spa-text-secondary">
                        <div className="font-medium text-spa-text-primary">Zielgeräte</div>
                        <div className="mt-1">{targetLabel}</div>
                      </div>
                      <div className="rounded-xl bg-spa-bg-primary px-3 py-2 text-sm text-spa-text-secondary">
                        <div className="font-medium text-spa-text-primary">Overrides</div>
                        <div className="mt-1">
                          {event.settingsOverrides?.designStyle || event.settingsOverrides?.colorPalette || event.settingsOverrides?.audio || event.settingsOverrides?.slideshow
                            ? [
                                event.settingsOverrides?.designStyle ? 'Design' : null,
                                event.settingsOverrides?.colorPalette ? 'Palette' : null,
                                event.settingsOverrides?.slideshow ? 'Slideshow' : null,
                                event.settingsOverrides?.audio ? 'Audio' : null,
                              ].filter(Boolean).join(' · ')
                            : 'Keine'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
