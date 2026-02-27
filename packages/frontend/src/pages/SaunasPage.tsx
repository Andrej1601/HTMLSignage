import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { SortableSaunaCard } from '@/components/Saunas/SaunaCard';
import { SaunaEditor } from '@/components/Saunas/SaunaEditor';
import type { Sauna } from '@/types/sauna.types';
import { createEmptySauna, getVisibleSaunas } from '@/types/sauna.types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/Button';
import { useSettings } from '@/hooks/useSettings';
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

// Simple UUID generator
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function SaunasPage() {
  const { settings, isLoading, error, save, isSaving, refetch } = useSettings();

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
  useEffect(() => {
    if (!isInitialized && settings) {
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
      setIsInitialized(true);
    }
  }, [settings, isInitialized]);

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

  if (isLoading) {
    return (
      <Layout>
        <LoadingSpinner label="Lade Saunas..." />
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
      <div>
        <PageHeader
          title="Saunas"
          description="Pflege Sauna-Stammdaten, Sichtbarkeit und Status für den Aufgussplan."
          actions={(
            <>
              <Button variant="ghost" icon={RefreshCw} onClick={handleReload} disabled={isLoading}>
                Neu laden
              </Button>
              <Button icon={Save} onClick={handleSaveAll} disabled={!isDirty} loading={isSaving} loadingText="Speichert...">
                Speichern
              </Button>
              <Button variant="secondary" icon={Plus} onClick={handleAddSauna}>
                Neue Sauna
              </Button>
            </>
          )}
          badges={[
            { label: `${localSaunas.length} gesamt`, tone: 'info' },
            { label: `${visibleSaunas.length} sichtbar`, tone: 'success' },
            { label: isDirty ? 'Ungespeicherte Änderungen' : 'Alles gespeichert', tone: isDirty ? 'warning' : 'success' },
          ]}
        />

        {/* Info Box */}
        <div className="bg-spa-secondary/10 border border-spa-secondary/30 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-spa-text-primary mb-2">Sauna-Verwaltung</h3>
          <ul className="text-sm text-spa-text-secondary space-y-1">
            <li>• <strong>Aufgüsse:</strong> Sauna erscheint normal im Aufgussplan</li>
            <li>• <strong>Keine Aufgüsse:</strong> Sauna wird als "Keine Aufgüsse" markiert</li>
            <li>• <strong>Außer Betrieb:</strong> Sauna wird als "Außer Betrieb" gekennzeichnet</li>
            <li>• <strong>Ausgeblendet:</strong> Sauna wird komplett ausgeblendet</li>
          </ul>
        </div>

        {/* Saunas Grid */}
        {localSaunas.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-spa-text-secondary mb-4">Noch keine Saunas vorhanden</p>
            <Button icon={Plus} onClick={handleAddSauna}>
              Erste Sauna hinzufügen
            </Button>
          </div>
        ) : (
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
        )}

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
