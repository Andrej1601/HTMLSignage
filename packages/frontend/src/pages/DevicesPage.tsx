import { useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Monitor,
  Power,
  RefreshCw,
  Search,
  ToggleRight,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { SkeletonCard } from '@/components/Skeleton';
import { PageHeader } from '@/components/PageHeader';
import { DeviceList } from '@/components/Devices/DeviceList';
import { EmptyState } from '@/components/EmptyState';
import { DeviceEditDialog } from '@/components/Devices/DeviceEditDialog';
import { PendingPairings } from '@/components/Devices/PendingPairings';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/Button';
import { toast } from '@/stores/toastStore';
import { ErrorAlert } from '@/components/ErrorAlert';
import { useDevicesPageState, getFilterButtonClass, type DeviceStatusFilter } from '@/hooks/useDevicesPageState';
import { useSlideshows } from '@/hooks/useSlideshows';

const STATUS_TABS: { key: DeviceStatusFilter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'maintenance', label: 'Wartung' },
];

export function DevicesPage() {
  const state = useDevicesPageState();
  const { data: slideshows = [] } = useSlideshows();
  // Auto-Open der Flottensteuerung sobald min. 1 Gerät selektiert ist —
  // sonst hängen Bulk-Aktionen unsichtbar im Accordion und der Saunameister
  // sucht nach Optionen, die direkt darunter liegen. Manuelles Schließen
  // bleibt möglich; eine erneute Selektion lässt den Accordion wieder
  // aufgehen (bewusst, weil das eindeutig signalisiert „hier sind
  // deine Bulk-Optionen").
  const [fleetOpen, setFleetOpen] = useState(false);
  const hasSelection = state.selectedDeviceIds.length > 0;
  const [prevHasSelection, setPrevHasSelection] = useState(hasSelection);
  if (hasSelection !== prevHasSelection) {
    setPrevHasSelection(hasSelection);
    if (hasSelection && !fleetOpen) setFleetOpen(true);
  }

  if (state.isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-2xl bg-spa-bg-secondary" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={`skeleton-card-${i}`} />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (state.error) {
    return (
      <Layout>
        <PageHeader title="Geräte" description="Verwalte Displays, Pairings und Ausspielmodi." icon={Monitor} />
        <ErrorAlert error={state.error} onRetry={() => state.refetch()} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Geräte"
          description="Verwalte Displays, Pairings und Ausspielmodi."
          icon={Monitor}
          actions={(
            <Button variant="secondary" icon={RefreshCw} onClick={() => state.refetch()}>
              Aktualisieren
            </Button>
          )}
          badges={[
            { label: `${state.pairedDevices.length} gekoppelt`, tone: 'info' },
            { label: `${state.deviceStats.online} online`, tone: state.deviceStats.online > 0 ? 'success' : 'neutral' },
            { label: `${state.deviceStats.offline} offline`, tone: state.deviceStats.offline > 0 ? 'warning' : 'neutral' },
            { label: `${state.deviceStats.maintenance} Wartung`, tone: state.deviceStats.maintenance > 0 ? 'warning' : 'neutral' },
          ]}
        />

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard title="Gesamt" value={state.pairedDevices.length} icon={Monitor} color="primary" />
          <StatCard title="Online" value={state.deviceStats.online} icon={Wifi} color="success" />
          <StatCard title="Offline" value={state.deviceStats.offline} icon={WifiOff} color={state.deviceStats.offline > 0 ? 'warning' : 'neutral'} />
          <StatCard title="Wartung" value={state.deviceStats.maintenance} icon={Wrench} color={state.deviceStats.maintenance > 0 ? 'warning' : 'neutral'} />
          <StatCard title="Pending" value={state.pendingPairings} icon={Clock} color={state.pendingPairings > 0 ? 'warning' : 'neutral'} />
        </div>

        {/* Status Filter Tabs + Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex gap-1 rounded-lg border border-spa-bg-secondary bg-spa-surface p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => state.setStatusFilter(tab.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  state.statusFilter === tab.key
                    ? 'bg-spa-primary text-white shadow-xs'
                    : 'text-spa-text-secondary hover:bg-spa-bg-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-spa-text-secondary" aria-hidden="true" />
            <input
              type="text"
              value={state.searchQuery}
              onChange={(e) => state.setSearchQuery(e.target.value)}
              placeholder="Gerät suchen..."
              aria-label="Geräte durchsuchen"
              className="w-full rounded-lg border border-spa-bg-secondary bg-spa-surface py-2 pl-9 pr-3 text-sm text-spa-text-primary placeholder:text-spa-text-secondary/60 outline-hidden focus:border-spa-primary focus:ring-2 focus:ring-spa-primary/20"
            />
          </div>
        </div>

        {/* Pending Pairings */}
        <PendingPairings />

        {/* Fleet Control (collapsible) */}
        <div className="rounded-2xl border border-spa-bg-secondary bg-spa-surface">
          <button
            type="button"
            onClick={() => setFleetOpen(!fleetOpen)}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <Wrench className="h-5 w-5 text-spa-primary" />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-spa-text-primary">Flottensteuerung</span>
                {hasSelection ? (
                  <span className="inline-flex items-center rounded-full bg-spa-primary/15 px-2 py-0.5 text-[11px] font-bold text-spa-primary">
                    {state.selectedDeviceIds.length} ausgewählt
                  </span>
                ) : (
                  <span className="text-xs text-spa-text-secondary">Bulk-Aktionen für ausgewählte Geräte</span>
                )}
              </div>
            </div>
            {fleetOpen ? <ChevronUp className="h-4 w-4 text-spa-text-secondary" /> : <ChevronDown className="h-4 w-4 text-spa-text-secondary" />}
          </button>

          {fleetOpen && (
            <div className="border-t border-spa-bg-secondary px-6 pb-6 pt-4 space-y-4">
              {/* Group Filter */}
              <div className="flex flex-wrap gap-2">
                {state.groupFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => state.setActiveGroupFilter(filter.key)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${getFilterButtonClass(state.activeGroupFilter === filter.key)}`}
                  >
                    <span>{filter.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      state.activeGroupFilter === filter.key
                        ? 'bg-spa-surface/20 text-white'
                        : 'bg-spa-surface text-spa-text-secondary'
                    }`}>
                      {filter.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Selection + Actions */}
              <div className="rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary/30 p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-spa-text-primary">
                      {state.selectedDeviceIds.length} Gerät{state.selectedDeviceIds.length === 1 ? '' : 'e'} ausgewählt
                    </p>
                    <p className="text-sm text-spa-text-secondary">
                      {state.visibleDevices.length} sichtbar, davon {state.selectedVisibleCount} ausgewählt.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={state.toggleVisibleSelection} disabled={state.visibleDevices.length === 0}>
                      {state.allVisibleSelected ? 'Sichtbare abwählen' : 'Sichtbare auswählen'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={state.clearSelection} disabled={state.selectedDeviceIds.length === 0}>
                      Auswahl löschen
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-3">
                  <div className="rounded-xl border border-spa-bg-secondary bg-spa-surface p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spa-text-secondary">Kommandos</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => state.openBulkCommand('reload', 'Geräte neu laden?', `Die ausgewählten ${state.selectedDeviceIds.length} Geräte laden ihre Anzeigeinhalte neu.`, 'Neu laden')} disabled={state.selectedDeviceIds.length === 0}>Neu laden</Button>
                      <Button variant="secondary" size="sm" icon={Power} onClick={() => state.openBulkCommand('restart', 'Geräte neu starten?', `Die ausgewählten ${state.selectedDeviceIds.length} Geräte erhalten einen Neustart-Befehl.`, 'Neustart senden')} disabled={state.selectedDeviceIds.length === 0}>Neustart</Button>
                      <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => state.openBulkCommand('clear-cache', 'Cache für Geräte leeren?', `Die ausgewählten ${state.selectedDeviceIds.length} Geräte leeren ihren lokalen Cache und laden danach neu.`, 'Cache leeren')} disabled={state.selectedDeviceIds.length === 0}>Cache leeren</Button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-spa-bg-secondary bg-spa-surface p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spa-text-secondary">Slideshow</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" icon={ToggleRight} onClick={() => state.openBulkUpdate({ slideshowId: null }, 'Standard-Slideshow zuweisen?', `Die ausgewählten ${state.selectedDeviceIds.length} Geräte nutzen die Standard-Slideshow.`, 'Standard setzen')} disabled={state.selectedDeviceIds.length === 0}>Standard</Button>
                      {slideshows.filter((s) => !s.isDefault).map((s) => (
                        <Button key={s.id} variant="secondary" size="sm" icon={ToggleRight} onClick={() => state.openBulkUpdate({ slideshowId: s.id }, `"${s.name}" zuweisen?`, `Die ausgewählten ${state.selectedDeviceIds.length} Geräte nutzen „${s.name}".`, 'Zuweisen')} disabled={state.selectedDeviceIds.length === 0}>{s.name}</Button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-spa-bg-secondary bg-spa-surface p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spa-text-secondary">Wartung</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="warning" size="sm" icon={AlertCircle} onClick={() => state.openBulkUpdate({ maintenanceMode: true }, 'Wartungsmodus aktivieren?', `Die ausgewählten ${state.selectedDeviceIds.length} Geräte werden für Wartung markiert.`, 'Wartung aktivieren', 'warning')} disabled={state.selectedDeviceIds.length === 0}>Wartung an</Button>
                      <Button variant="secondary" size="sm" icon={Wrench} onClick={() => state.openBulkUpdate({ maintenanceMode: false }, 'Wartungsmodus beenden?', `Die ausgewählten ${state.selectedDeviceIds.length} Geräte verlassen den Wartungsmodus.`, 'Wartung beenden')} disabled={state.selectedDeviceIds.length === 0}>Wartung aus</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Device Grid */}
        {state.pairedDevices.length === 0 ? (
          <EmptyState
            icon={Monitor}
            title="Keine gekoppelten Geräte"
            description="Öffne die Display-URL auf einem Gerät — der Pairing-Code erscheint dann oben in dieser Liste."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => window.open('/display', '_blank', 'noopener')}
                >
                  Display-URL öffnen
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const url = `${window.location.origin}/display`;
                    void navigator.clipboard?.writeText(url);
                    toast.success(`Display-URL kopiert: ${url}`);
                  }}
                >
                  URL kopieren
                </Button>
              </div>
            }
          />
        ) : (
          <DeviceList
            devices={state.visibleDevices}
            selectedDeviceIds={state.selectedDeviceIds}
            onToggleSelection={state.toggleSingleSelection}
            onEdit={state.setEditingDevice}
            onDelete={state.setDeletingDevice}
            onReload={state.handleReload}
            onRestart={state.handleRestart}
            onClearCache={state.handleClearCache}
            onToggleMaintenance={state.handleToggleMaintenance}
          />
        )}

        {/* Dialogs */}
        <DeviceEditDialog
          device={state.editingDevice}
          isOpen={Boolean(state.editingDevice)}
          onClose={() => state.setEditingDevice(null)}
          onSave={state.handleUpdateDevice}
          isSaving={state.updateDeviceIsPending}
          existingGroups={state.existingGroupNames}
          slideshows={slideshows}
        />

        <ConfirmDialog
          isOpen={Boolean(state.deletingDevice)}
          title="Display löschen?"
          message={`Möchtest du das Display "${state.deletingDevice?.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
          confirmLabel={state.deleteDeviceIsPending ? 'Wird gelöscht...' : 'Löschen'}
          variant="danger"
          onConfirm={state.handleDeleteDevice}
          onCancel={() => state.setDeletingDevice(null)}
        />

        <ConfirmDialog
          isOpen={Boolean(state.pendingBulkAction)}
          title={state.pendingBulkAction?.title || 'Bulk-Aktion ausführen?'}
          message={
            (state.pendingBulkAction?.message || '') +
            (state.selectedDeviceIds.length > 0
              ? `\n\nBetroffene Geräte (${state.selectedDeviceIds.length}): ${
                  state.pairedDevices
                    .filter((d) => state.selectedDeviceIds.includes(d.id))
                    .map((d) => d.name)
                    .join(', ')
                }`
              : '')
          }
          confirmLabel={state.pendingBulkAction?.confirmLabel || 'Bestätigen'}
          variant={state.pendingBulkAction?.variant === 'warning' ? 'warning' : 'default'}
          onConfirm={state.handleConfirmBulkAction}
          onCancel={() => state.setPendingBulkAction(null)}
        />
      </div>
    </Layout>
  );
}
