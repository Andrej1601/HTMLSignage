import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { SaunaCard } from '@/components/Saunas/SaunaCard';
import { SaunaEditor } from '@/components/Saunas/SaunaEditor';
import type { Sauna } from '@/types/sauna.types';
import { createEmptySauna, getVisibleSaunas } from '@/types/sauna.types';
import { Plus, Save, AlertCircle, RefreshCw } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

// Simple UUID generator
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function SaunasPage() {
  const { settings, isLoading, error, save, isSaving, refetch } = useSettings();

  const [localSaunas, setLocalSaunas] = useState<Sauna[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [editingSauna, setEditingSauna] = useState<Sauna | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

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
    if (confirm('Möchtest du diese Sauna wirklich löschen?')) {
      setLocalSaunas(localSaunas.filter((s) => s.id !== id));
      setIsDirty(true);
      setEditingSauna(null);
    }
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
        <div className="flex items-center justify-center h-64">
          <div className="text-spa-text-secondary">Lädt Saunas...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Fehler beim Laden</h3>
            <p className="text-red-700 text-sm mt-1">
              {error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const visibleSaunas = getVisibleSaunas(localSaunas);

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-spa-text-primary">Saunas</h2>
            <p className="text-spa-text-secondary mt-1">
              {localSaunas.length} Sauna{localSaunas.length !== 1 ? 's' : ''} ({visibleSaunas.length} sichtbar)
              {isDirty && (
                <span className="ml-2 text-orange-600 font-medium">• Ungespeicherte Änderungen</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReload}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Neu laden
            </button>

            <button
              onClick={handleSaveAll}
              disabled={!isDirty || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Speichert...' : 'Speichern'}
            </button>

            <button
              onClick={handleAddSauna}
              className="flex items-center gap-2 px-4 py-2 bg-spa-secondary text-white rounded-md hover:bg-spa-secondary-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Neue Sauna
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Sauna-Verwaltung</h3>
          <ul className="text-sm text-blue-800 space-y-1">
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
            <button
              onClick={handleAddSauna}
              className="px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors"
            >
              Erste Sauna hinzufügen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {localSaunas
              .sort((a, b) => a.order - b.order)
              .map((sauna) => (
                <SaunaCard
                  key={sauna.id}
                  sauna={sauna}
                  onEdit={() => setEditingSauna(sauna)}
                  onDelete={() => handleDelete(sauna.id)}
                />
              ))}
          </div>
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
      </div>
    </Layout>
  );
}
