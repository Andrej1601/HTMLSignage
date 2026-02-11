import { useState } from 'react';
import type { Event } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
import { useMedia } from '@/hooks/useMedia';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import { Plus, Edit2, Trash2, X, Save, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';

interface EventManagerProps {
  events: Event[];
  onChange: (events: Event[]) => void;
}

export function EventManager({ events, onChange }: EventManagerProps) {
  const { data: media } = useMedia();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Event, 'id'>>({
    name: '',
    description: '',
    imageId: undefined,
    startDate: '',
    startTime: '10:00',
    endDate: '',
    endTime: '23:59',
    assignedPreset: 'Evt1',
    isActive: true,
  });

  const handleStartAdd = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      name: '',
      description: '',
      imageId: undefined,
      startDate: today,
      startTime: '10:00',
      endDate: '',
      endTime: '23:59',
      assignedPreset: 'Evt1',
      isActive: true,
    });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (event: Event) => {
    setFormData({
      name: event.name,
      description: event.description,
      imageId: event.imageId,
      startDate: event.startDate,
      startTime: event.startTime,
      endDate: event.endDate,
      endTime: event.endTime,
      assignedPreset: event.assignedPreset,
      isActive: event.isActive,
    });
    setEditingId(event.id);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.startDate || !formData.startTime) return;

    if (isAdding) {
      // Add new event
      const newEvent: Event = {
        id: Date.now().toString(),
        ...formData,
        name: formData.name.trim(),
        description: formData.description?.trim(),
      };
      onChange([...events, newEvent]);
    } else if (editingId) {
      // Update existing event
      onChange(
        events.map((e) =>
          e.id === editingId
            ? {
                ...e,
                ...formData,
                name: formData.name.trim(),
                description: formData.description?.trim(),
              }
            : e
        )
      );
    }

    handleCancel();
  };

  const handleDelete = (id: string) => {
    if (confirm('Möchten Sie dieses Event wirklich löschen?')) {
      onChange(events.filter((e) => e.id !== id));
    }
  };

  const handleToggleActive = (id: string) => {
    onChange(
      events.map((e) =>
        e.id === id ? { ...e, isActive: !e.isActive } : e
      )
    );
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
  };

  // Get image for display
  const getImageUrl = (imageId?: string) => {
    return getMediaUploadUrl(media, imageId);
  };

  // Check if event is currently active
  const isEventCurrentlyActive = (event: Event): boolean => {
    if (!event.isActive) return false;
    const now = new Date();
    const startDateTime = new Date(`${event.startDate}T${event.startTime}`);
    const endDate = event.endDate || event.startDate;
    const endTime = event.endTime || '23:59';
    const endDateTime = new Date(`${endDate}T${endTime}`);
    return now >= startDateTime && now <= endDateTime;
  };

  const imageList = media?.filter((m: Media) => m.type === 'image') || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-spa-text-primary">Event-Verwaltung</h3>
          <p className="text-sm text-spa-text-secondary">
            Erstellen Sie Events mit zugewiesenen Aufgussplänen (Event 1 oder Event 2)
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neues Event
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="mb-6 p-6 bg-spa-bg-primary border border-spa-bg-secondary rounded-lg">
          <h4 className="text-sm font-semibold text-spa-text-primary mb-4">
            {isAdding ? 'Neues Event erstellen' : 'Event bearbeiten'}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Event-Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                placeholder="z.B. Weihnachtsfeier, Sommerfest, Jubiläum..."
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Beschreibung
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                placeholder="Beschreibung des Events..."
                rows={3}
              />
            </div>

            {/* Image */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Event-Bild
              </label>
              {imageList.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={formData.imageId || ''}
                    onChange={(e) => setFormData({ ...formData, imageId: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                  >
                    <option value="">Kein Bild</option>
                    {imageList.map((img: Media) => (
                      <option key={img.id} value={img.id}>
                        {img.originalName}
                      </option>
                    ))}
                  </select>
                  {formData.imageId && (
                    <div className="mt-2">
                      <img
                        src={getImageUrl(formData.imageId) || ''}
                        alt="Event preview"
                        className="w-full h-48 object-cover rounded-md"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-spa-text-secondary bg-white p-3 rounded-md border border-spa-bg-secondary">
                  Keine Bilder verfügbar. Laden Sie zuerst Bilder in der Mediathek hoch.
                </div>
              )}
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Startdatum *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-spa-text-secondary pointer-events-none" />
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                />
              </div>
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Startzeit *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-spa-text-secondary pointer-events-none" />
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Enddatum (optional)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-spa-text-secondary pointer-events-none" />
                <input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value || undefined })}
                  className="w-full pl-10 pr-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                />
              </div>
              <p className="text-xs text-spa-text-secondary mt-1">
                Leer lassen für eintägiges Event
              </p>
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Endzeit (optional)
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-spa-text-secondary pointer-events-none" />
                <input
                  type="time"
                  value={formData.endTime || ''}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value || undefined })}
                  className="w-full pl-10 pr-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
                />
              </div>
            </div>

            {/* Assigned Preset */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Zugewiesener Aufgussplan *
              </label>
              <select
                value={formData.assignedPreset}
                onChange={(e) => setFormData({ ...formData, assignedPreset: e.target.value as 'Evt1' | 'Evt2' })}
                className="w-full px-4 py-2 border border-spa-bg-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-spa-primary"
              >
                <option value="Evt1">Event 1</option>
                <option value="Evt2">Event 2</option>
              </select>
              <p className="text-xs text-spa-text-secondary mt-1">
                Dieser Aufgussplan wird während des Events angezeigt
              </p>
            </div>

            {/* Is Active */}
            <div>
              <label className="block text-sm font-medium text-spa-text-primary mb-2">
                Status
              </label>
              <button
                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-md border-2 transition-colors w-full justify-center',
                  formData.isActive
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-gray-50 text-gray-600'
                )}
              >
                {formData.isActive ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Aktiv
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    Inaktiv
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSave}
              disabled={!formData.name.trim() || !formData.startDate || !formData.startTime}
              className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Speichern
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="space-y-3">
        {events
          .sort((a, b) => {
            // Sort by start date/time, most recent first
            const aStart = new Date(`${a.startDate}T${a.startTime}`);
            const bStart = new Date(`${b.startDate}T${b.startTime}`);
            return bStart.getTime() - aStart.getTime();
          })
          .map((event) => {
            const imageUrl = getImageUrl(event.imageId);
            const isCurrentlyActive = isEventCurrentlyActive(event);

            return (
              <div
                key={event.id}
                className={clsx(
                  'bg-white border-2 rounded-lg p-4 transition-all',
                  isCurrentlyActive
                    ? 'border-green-500 shadow-md'
                    : event.isActive
                    ? 'border-spa-bg-secondary hover:shadow-sm'
                    : 'border-gray-200 opacity-60'
                )}
              >
                <div className="flex gap-4">
                  {/* Image */}
                  {imageUrl && (
                    <div className="flex-shrink-0">
                      <img
                        src={imageUrl}
                        alt={event.name}
                        className="w-32 h-32 object-cover rounded-md"
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-spa-text-primary flex items-center gap-2">
                          {event.name}
                          {isCurrentlyActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                              Läuft jetzt
                            </span>
                          )}
                          {!event.isActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                              Inaktiv
                            </span>
                          )}
                        </h4>
                        {event.description && (
                          <p className="text-sm text-spa-text-secondary mt-1">{event.description}</p>
                        )}
                      </div>

                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleToggleActive(event.id)}
                          className={clsx(
                            'p-2 rounded-md transition-colors',
                            event.isActive
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-gray-400 hover:bg-gray-50'
                          )}
                          title={event.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        >
                          {event.isActive ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <XCircle className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleStartEdit(event)}
                          className="p-2 text-spa-text-secondary hover:bg-spa-bg-primary rounded-md transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-spa-text-secondary">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(event.startDate).toLocaleDateString('de-DE')}
                        {event.endDate && event.endDate !== event.startDate && (
                          <> - {new Date(event.endDate).toLocaleDateString('de-DE')}</>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {event.startTime}
                        {event.endTime && <> - {event.endTime}</>}
                      </div>
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-spa-accent/10 text-spa-accent rounded-full text-xs font-medium">
                        Aufgussplan: {event.assignedPreset}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {events.length === 0 && !isAdding && (
        <div className="text-center py-12 text-spa-text-secondary bg-white rounded-lg border-2 border-dashed border-spa-bg-secondary">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Keine Events vorhanden</p>
          <p className="text-sm mt-1">Klicken Sie auf "Neues Event", um ein Event zu erstellen.</p>
        </div>
      )}
    </div>
  );
}
