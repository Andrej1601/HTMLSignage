import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { SkeletonCard } from '@/components/Skeleton';
import { PageHeader } from '@/components/PageHeader';
import { SortableSaunaCard } from '@/components/Saunas/SaunaCard';
import { SaunaEditor } from '@/components/Saunas/SaunaEditor';
import type { Sauna } from '@/types/sauna.types';
import { createEmptySauna, getVisibleSaunas } from '@/types/sauna.types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Save, RefreshCw, Flame, Info } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { SectionCard } from '@/components/SectionCard';
import { useSettings } from '@/hooks/useSettings';
import { usePermission } from '@/hooks/usePermission';
import { SAUNA_STATUS_LABELS, SAUNA_STATUS_COLORS } from '@/types/sauna.types';
import api from '@/services/api';
import { toast } from '@/stores/toastStore';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { generateId } from '@/utils/id';

export function SaunasPage() {
  const { settings, isLoading, error, save, isSaving, refetch } = useSettings();
  const canManage = usePermission('saunas:manage');

  const [localSaunas, setLocalSaunas] = useState<Sauna[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [editingSauna, setEditingSauna] = useState<Sauna | null>(null);
  const [deletingSaunaId, setDeletingSaunaId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedSaunas = useMemo(
    () => [...localSaunas].sort((a, b) => a.order - b.order),
    [localSaunas],
  );

  const sortedIds = useMemo(
    () => sortedSaunas.map((s) => s.id),
    [sortedSaunas],
  );

  // Initialize local saunas from settings only once
  if (!isInitialized && settings) {
    setIsInitialized(true);
    if (settings.saunas && settings.saunas.length > 0) {
      setLocalSaunas(settings.saunas);
    } else {
      // Initialize with default saunas if none exist
      // IMPORTANT: Only set local state, don't auto-save to prevent overwriting accidentally lost data
      // User must explicitly click Save to persist defaults
      const defaultSaunas: Sauna[] = [
        {
          id: generateId(),
          name: 'Finnische Sauna',
          status: 'active',
          order: 0,
          color: '#10b981',
          info: { temperature: 90, humidity: 10, capacity: 12 },
        },
        {
          id: generateId(),
          name: 'Bio Sauna',
          status: 'active',
          order: 1,
          color: '#3b82f6',
          info: { temperature: 60, humidity: 40, capacity: 8 },
        },
      ];
      setLocalSaunas(defaultSaunas);
      setIsDirty(true); // Mark as dirty so user can save
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedSaunas.findIndex((s) => s.id === active.id);
    const newIndex = sortedSaunas.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder array
    const reordered = [...sortedSaunas];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Update order values
    const updated = reordered.map((s, i) => ({ ...s, order: i }));
    setLocalSaunas(updated);
    setIsDirty(true);
  };

  const handleAddSauna = () => {
    setIsAddingNew(true);
  };

  const handleSaveNew = (saunaData: Omit<Sauna, 'id'>) => {
    const newSauna: Sauna = {
      ...saunaData,
      id: generateId(),
      order: localSaunas.length,
    };
    setLocalSaunas([...localSaunas, newSauna]);
    setIsDirty(true);
    setIsAddingNew(false);
  };

  const handleSaveEdit = (saunaData: Sauna) => {
    setLocalSaunas(localSaunas.map((s) => (s.id === saunaData.id ? saunaData : s)));
    setIsDirty(true);
    setEditingSauna(null);
  };

  const handleDelete = (id: string) => {
    setDeletingSaunaId(id);
  };

  const confirmDelete = () => {
    if (!deletingSaunaId) return;
    setLocalSaunas(localSaunas.filter((s) => s.id !== deletingSaunaId));
    setIsDirty(true);
    setEditingSauna(null);
    setDeletingSaunaId(null);
  };

  const handleSaveAll = () => {
    if (!settings) return;

    const updatedSettings = {
      ...settings,
      saunas: localSaunas,
      version: (settings.version || 1) + 1,
    };

    save(updatedSettings, {
      onSuccess: () => {
        setIsDirty(false);
        // Don't refetch - we already have the latest state
      },
    });
  };

  const handleReload = () => {
    setIsInitialized(false);
    setIsDirty(false);
    refetch();
  };

  // Saunameister: change status via dedicated endpoint (no settings:manage needed)
  const handleStatusChange = async (saunaId: string, status: Sauna['status']) => {
    const previousSaunas = localSaunas;
    setLocalSaunas((prev) => prev.map((s) => s.id === saunaId ? { ...s, status } : s));
    try {
      await api.patch(`/saunas/${saunaId}/status`, { status });
    } catch (err) {
      setLocalSaunas(previousSaunas);
      const message = err instanceof Error ? err.message : 'Status konnte nicht geändert werden';
      toast.error(`Fehler: ${message}`);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-2xl bg-spa-bg-secondary" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={`skeleton-card-${i}`} />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <ErrorAlert error={error} onRetry={() => refetch()} />
      </Layout>
    );
  }

  const visibleSaunas = getVisibleSaunas(localSaunas);

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Saunas"
          description="Pflege Sauna-Stammdaten, Sichtbarkeit und Status für den Aufgussplan."
          actions={(
            <>
              <Button variant="ghost" icon={RefreshCw} onClick={handleReload} disabled={isLoading}>
                Neu laden
              </Button>
              {canManage && (
                <>
                  <Button icon={Save} onClick={handleSaveAll} disabled={!isDirty} loading={isSaving} loadingText="Speichert...">
                    Speichern
                  </Button>
                  <Button variant="secondary" icon={Plus} onClick={handleAddSauna}>
                    Neue Sauna
                  </Button>
                </>
              )}
            </>
          )}
          badges={[
            { label: `${localSaunas.length} gesamt`, tone: 'info' },
            { label: `${visibleSaunas.length} sichtbar`, tone: 'success' },
            { label: isDirty ? 'Ungespeicherte Änderungen' : 'Alles gespeichert', tone: isDirty ? 'warning' : 'success' },
          ]}
        />

        {/* Info Box */}
        <SectionCard title="Hinweise" icon={Info}>
          <ul className="text-sm text-spa-text-secondary space-y-1">
            <li>• <strong>Aufgüsse:</strong> Sauna erscheint normal im Aufgussplan</li>
            <li>• <strong>Keine Aufgüsse:</strong> Sauna wird als "Keine Aufgüsse" markiert</li>
            <li>• <strong>Außer Betrieb:</strong> Sauna wird als "Außer Betrieb" gekennzeichnet</li>
            <li>• <strong>Ausgeblendet:</strong> Sauna wird komplett ausgeblendet</li>
          </ul>
        </SectionCard>

        {/* Saunas Grid */}
        <SectionCard
          title="Saunas"
          description={canManage ? 'Per Drag & Drop die Reihenfolge ändern.' : 'Status der Saunas ändern.'}
          icon={Flame}
        >
          {localSaunas.length === 0 ? (
            <EmptyState
              icon={Flame}
              title="Noch keine Saunas"
              description="Lege deine erste Sauna an, um sie im Aufgussplan zu verwenden."
              action={canManage ? (
                <Button icon={Plus} onClick={handleAddSauna}>
                  Erste Sauna hinzufügen
                </Button>
              ) : undefined}
            />
          ) : canManage ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedIds} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedSaunas.map((sauna) => (
                    <SortableSaunaCard
                      key={sauna.id}
                      sauna={sauna}
                      onEdit={() => setEditingSauna(sauna)}
                      onDelete={() => handleDelete(sauna.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            /* Saunameister view: status-only cards */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedSaunas.map((sauna) => (
                <div
                  key={sauna.id}
                  className="rounded-lg border border-spa-bg-secondary bg-spa-surface p-4 flex items-center gap-4"
                  style={{ borderLeftWidth: 4, borderLeftColor: sauna.color || '#10b981' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-spa-text-primary">{sauna.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: SAUNA_STATUS_COLORS[sauna.status] }}
                      />
                      <span className="text-xs text-spa-text-secondary">{SAUNA_STATUS_LABELS[sauna.status]}</span>
                    </div>
                  </div>
                  <select
                    value={sauna.status}
                    onChange={(e) => handleStatusChange(sauna.id, e.target.value as Sauna['status'])}
                    className="rounded-lg border border-spa-bg-secondary px-3 py-1.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-spa-primary"
                  >
                    <option value="active">Aufgüsse</option>
                    <option value="no-aufguss">Keine Aufgüsse</option>
                    <option value="out-of-order">Außer Betrieb</option>
                    <option value="hidden">Ausgeblendet</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Editor Dialog */}
        {(editingSauna || isAddingNew) && (
          <SaunaEditor
            sauna={editingSauna || createEmptySauna()}
            isOpen={true}
            onClose={() => {
              setEditingSauna(null);
              setIsAddingNew(false);
            }}
            onSave={(sauna) => editingSauna ? handleSaveEdit(sauna as Sauna) : handleSaveNew(sauna as Omit<Sauna, 'id'>)}
            onDelete={editingSauna ? () => handleDelete(editingSauna.id) : undefined}
          />
        )}

        <ConfirmDialog
          isOpen={Boolean(deletingSaunaId)}
          title="Sauna löschen?"
          message={`Möchtest du die Sauna "${localSaunas.find((s) => s.id === deletingSaunaId)?.name || ''}" wirklich löschen?`}
          confirmLabel="Löschen"
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeletingSaunaId(null)}
        />
      </div>
    </Layout>
  );
}
