import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Skeleton, SkeletonTableRow } from '@/components/Skeleton';
import { PageHeader } from '@/components/PageHeader';
import { Plus, Edit2, Trash2, Users as UsersIcon, Shield, Save, Search, X, CheckSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { InputField } from '@/components/FormField';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorAlert } from '@/components/ErrorAlert';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { SectionCard } from '@/components/SectionCard';
import { AVAILABLE_ROLES } from '@/utils/permissions';
import { fetchApi } from '@/services/api';
import { toast } from '@/stores/toastStore';

interface User {
  id: string;
  username: string;
  email: string | null;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

interface CreateUserData {
  username: string;
  email?: string;
  password: string;
  roles: string[];
}

interface UpdateUserData {
  username?: string;
  email?: string | null;
  password?: string;
  roles?: string[];
}

export function UsersPage() {
  const { user: currentUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkRoleDialogOpen, setBulkRoleDialogOpen] = useState(false);
  const [bulkRoleMode, setBulkRoleMode] = useState<'add' | 'remove'>('add');
  const [bulkRoleSelection, setBulkRoleSelection] = useState<string[]>([]);
  const [bulkRoleSaving, setBulkRoleSaving] = useState(false);

  // Fetch users
  const { data: users = [], isLoading, error, refetch } = useQuery<User[]>({
    queryKey: ['users'],
    retry: false,
    queryFn: async () => {
      try {
        return await fetchApi<User[]>('/users');
      } catch (error) {
        if (error instanceof Error && /nicht authentifiziert|invalid token|session expired|user not found|no token provided/i.test(error.message)) {
          await logout();
          throw new Error('unauthorized');
        }
        throw error;
      }
    },
  });

  // Create user mutation
  const createUser = useMutation({
    mutationFn: async (data: CreateUserData) => {
      return fetchApi('/users', {
        method: 'POST',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateDialogOpen(false);
    },
  });

  // Update user mutation
  const updateUser = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserData }) => {
      return fetchApi(`/users/${id}`, {
        method: 'PATCH',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
    },
  });

  // Delete user mutation
  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      return fetchApi(`/users/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeletingUser(null);
    },
  });

  // Inline berechnet — React Compiler übernimmt die Memoisierung;
  // ein manuelles useMemo mit `selectedIds` (Set) als Dep konnte er
  // nicht preservieren.
  const userColumns: Column<User>[] = [
    {
      key: '__select',
      header: '',
      className: 'w-10',
      render: (u) => (
        <input
          type="checkbox"
          checked={selectedIds.has(u.id)}
          onChange={() => toggleSelected(u.id)}
          aria-label={selectedIds.has(u.id) ? `${u.username} abwählen` : `${u.username} auswählen`}
          className="h-4 w-4 rounded border-spa-bg-secondary accent-spa-primary"
        />
      ),
      // In der Mobile-Card-View wirkt die Checkbox zwischen den
      // Stammdaten unbeholfen — wir lassen sie auf Desktop und
      // verwenden in der Mobile-Card stattdessen die Header-Aktionen.
      hideOnMobile: true,
    },
    {
      key: 'username',
      header: 'Benutzer',
      sortFn: (a, b) => a.username.localeCompare(b.username),
      render: (u) => (
        <div className="flex items-center">
          <div className="shrink-0 h-10 w-10 bg-spa-primary rounded-full flex items-center justify-center text-white font-bold">
            {u.username.charAt(0).toUpperCase()}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-spa-text-primary">{u.username}</div>
          </div>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: 'email',
      header: 'E-Mail',
      render: (u) => <span className="text-spa-text-primary">{u.email || '—'}</span>,
    },
    {
      key: 'roles',
      header: 'Rollen',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((role) => {
            const meta = AVAILABLE_ROLES.find((r) => r.value === role);
            return (
              <span
                key={role}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  role === 'admin'
                    ? 'bg-spa-primary/15 text-spa-primary'
                    : role === 'editor'
                    ? 'bg-spa-info-light text-spa-info-dark'
                    : role === 'saunameister'
                    ? 'bg-spa-success-light text-spa-success-dark'
                    : 'bg-spa-bg-secondary text-spa-text-secondary'
                }`}
              >
                {meta?.label || role}
              </span>
            );
          })}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Erstellt',
      sortFn: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (u) => (
        <span className="text-spa-text-secondary">
          {new Date(u.createdAt).toLocaleDateString('de-DE')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Aktionen',
      alignRight: true,
      hideOnMobile: true,
      render: (u) => (
        <>
          <button
            onClick={() => setEditingUser(u)}
            className="text-spa-primary hover:text-spa-primary-dark mr-3"
            aria-label={`${u.username} bearbeiten`}
          >
            <Edit2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => setDeletingUser(u)}
            className="text-spa-error hover:text-spa-error-dark"
            aria-label={`${u.username} löschen`}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </>
      ),
      renderMobile: (u) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" icon={Edit2} onClick={() => setEditingUser(u)}>
            Bearbeiten
          </Button>
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeletingUser(u)}>
            Löschen
          </Button>
        </div>
      ),
    },
  ];

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter((u) =>
      u.username.toLowerCase().includes(q)
      || (u.email && u.email.toLowerCase().includes(q))
      || u.roles.some((r) => r.toLowerCase().includes(q)),
    );
  }, [users, searchQuery]);

  const allVisibleSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u.id));
  const someVisibleSelected =
    filteredUsers.some((u) => selectedIds.has(u.id)) && !allVisibleSelected;

  // Selektion auf sichtbare User beschränken: wer aus dem Filter fällt,
  // verschwindet auch aus der Auswahl. Render-phase Sync (kein
  // setState-in-effect) via Tracked-Vorgängerwert von filteredUsers.
  const [prevFilteredUsers, setPrevFilteredUsers] = useState(filteredUsers);
  if (filteredUsers !== prevFilteredUsers) {
    setPrevFilteredUsers(filteredUsers);
    if (selectedIds.size > 0) {
      const visibleIds = new Set(filteredUsers.map((u) => u.id));
      const filtered = new Set<string>();
      for (const id of selectedIds) if (visibleIds.has(id)) filtered.add(id);
      if (filtered.size !== selectedIds.size) setSelectedIds(filtered);
    }
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());
  const selectAllVisible = () => setSelectedIds(new Set(filteredUsers.map((u) => u.id)));

  const selectedUsers = useMemo(
    () => users.filter((u) => selectedIds.has(u.id)),
    [users, selectedIds],
  );

  // Sicherheitsregel: den eigenen Account darf man nicht via Bulk-Aktion
  // löschen oder demoten, sonst sperrt sich der User selbst aus.
  const includesSelf = currentUser ? selectedIds.has(currentUser.id) : false;

  const openBulkRoleDialog = (mode: 'add' | 'remove') => {
    if (selectedIds.size === 0) return;
    setBulkRoleMode(mode);
    setBulkRoleSelection([]);
    setBulkRoleDialogOpen(true);
  };

  const closeBulkRoleDialog = () => {
    setBulkRoleDialogOpen(false);
    setBulkRoleSelection([]);
  };

  const handleBulkRoleSave = async () => {
    if (selectedIds.size === 0 || bulkRoleSelection.length === 0) {
      toast.warning('Mindestens eine Rolle wählen.');
      return;
    }
    setBulkRoleSaving(true);

    const updates = selectedUsers.map((u) => {
      let nextRoles: string[];
      if (bulkRoleMode === 'add') {
        const merged = new Set(u.roles);
        for (const r of bulkRoleSelection) merged.add(r);
        nextRoles = Array.from(merged);
      } else {
        nextRoles = u.roles.filter((r) => !bulkRoleSelection.includes(r));
        // Sicherheitsnetz: ein User darf nie ohne Rolle dastehen
        if (nextRoles.length === 0) nextRoles = ['viewer'];
      }
      // Eigenen Admin-Status nicht versehentlich entfernen
      if (currentUser && u.id === currentUser.id && bulkRoleMode === 'remove') {
        if (u.roles.includes('admin') && !nextRoles.includes('admin')) {
          nextRoles = [...nextRoles, 'admin'];
        }
      }
      return fetchApi(`/users/${u.id}`, {
        method: 'PATCH',
        data: { roles: nextRoles },
      });
    });

    const results = await Promise.allSettled(updates);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    queryClient.invalidateQueries({ queryKey: ['users'] });

    if (failed === 0) {
      toast.success(
        `${succeeded} Benutzer aktualisiert (${bulkRoleMode === 'add' ? 'Rollen ergänzt' : 'Rollen entfernt'}).`,
      );
    } else if (succeeded === 0) {
      toast.error(`Aktualisierung fehlgeschlagen für ${failed} Benutzer.`);
    } else {
      toast.warning(`${succeeded} aktualisiert, ${failed} fehlgeschlagen.`);
    }

    setBulkRoleSaving(false);
    setBulkRoleDialogOpen(false);
    setBulkRoleSelection([]);
    setSelectedIds(new Set());
  };

  const handleBulkDeleteRequest = () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);

    // Eigenen Account aus dem Bulk-Delete ausschließen — User soll sich
    // nicht selbst aus dem System schießen können.
    const idsToDelete = Array.from(selectedIds).filter(
      (id) => !currentUser || id !== currentUser.id,
    );
    const skippedSelf = idsToDelete.length !== selectedIds.size;

    const results = await Promise.allSettled(
      idsToDelete.map((id) =>
        fetchApi(`/users/${id}`, {
          method: 'DELETE',
        }),
      ),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    queryClient.invalidateQueries({ queryKey: ['users'] });

    if (failed === 0) {
      toast.success(
        skippedSelf
          ? `${succeeded} Benutzer gelöscht (eigener Account übersprungen).`
          : `${succeeded} Benutzer gelöscht.`,
      );
    } else if (succeeded === 0) {
      toast.error(`Löschen fehlgeschlagen für ${failed} Benutzer.`);
    } else {
      toast.warning(`${succeeded} gelöscht, ${failed} fehlgeschlagen.`);
    }

    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds(new Set());
  };

  const toggleBulkRole = (role: string) => {
    setBulkRoleSelection((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-2xl bg-spa-bg-secondary" />
          <div className="rounded-xl border border-spa-bg-secondary bg-spa-surface overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-3 border-b border-spa-bg-secondary bg-spa-bg-primary">
              {Array.from({ length: 4 }, (_, i) => <Skeleton key={`skeleton-${i}`} variant="text" className="h-4 w-20" />)}
            </div>
            {Array.from({ length: 5 }, (_, i) => <SkeletonTableRow key={`skeleton-row-${i}`} columns={4} />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <PageHeader title="Benutzerverwaltung" description="Benutzerkonten und Rollen verwalten." icon={UsersIcon} />
        <ErrorAlert error={error} onRetry={() => refetch()} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Benutzerverwaltung"
          description="Benutzerkonten, Rollen und Adminrechte zentral verwalten."
          icon={UsersIcon}
          actions={(
            <Button icon={Plus} onClick={() => setIsCreateDialogOpen(true)}>
              Benutzer anlegen
            </Button>
          )}
          badges={[
            { label: `${users.length} Benutzer`, tone: 'info' },
            { label: `${users.filter((entry) => entry.roles.includes('admin')).length} Admins`, tone: 'info' },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard title="Gesamt" value={users.length} icon={UsersIcon} color="primary" />
          <StatCard title="Administratoren" value={users.filter(u => u.roles.includes('admin')).length} icon={Shield} color="info" />
        </div>

        <SectionCard title="Benutzer" icon={UsersIcon}>
          {users.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-spa-text-secondary" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Benutzer suchen..."
                  aria-label="Benutzer durchsuchen"
                  className="w-full rounded-lg border border-spa-bg-secondary bg-spa-surface py-2 pl-9 pr-3 text-sm text-spa-text-primary placeholder:text-spa-text-secondary/60 outline-hidden focus:border-spa-primary focus:ring-2 focus:ring-spa-primary/20"
                />
              </div>
              <label className="hidden md:inline-flex items-center gap-2 text-sm text-spa-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={() => (allVisibleSelected ? clearSelection() : selectAllVisible())}
                  className="h-4 w-4 rounded border-spa-bg-secondary accent-spa-primary"
                  aria-label="Alle sichtbaren Benutzer auswählen"
                />
                Alle auswählen
              </label>
            </div>
          )}
          {users.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="Keine Benutzer"
              description="Erstelle den ersten Benutzer, um loszulegen."
              action={<Button icon={Plus} onClick={() => setIsCreateDialogOpen(true)}>Ersten Benutzer anlegen</Button>}
            />
          ) : (
            <DataTable<User>
              data={filteredUsers}
              keyFn={(u) => u.id}
              mobileTitle={(u) => (
                <div className="flex items-center gap-3">
                  <div className="shrink-0 h-10 w-10 bg-spa-primary rounded-full flex items-center justify-center text-white font-bold">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <span>{u.username}</span>
                </div>
              )}
              columns={userColumns}
            />
          )}
        </SectionCard>

        {/* Create/Edit Dialog */}
        {(isCreateDialogOpen || editingUser) && (
          <UserDialog
            user={editingUser}
            onClose={() => {
              setIsCreateDialogOpen(false);
              setEditingUser(null);
            }}
            onSave={(data) => {
              if (editingUser) {
                updateUser.mutate({ id: editingUser.id, data });
              } else {
                createUser.mutate(data as CreateUserData);
              }
            }}
            isSaving={createUser.isPending || updateUser.isPending}
          />
        )}

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={Boolean(deletingUser)}
          title="Benutzer löschen?"
          message={`Möchtest du den Benutzer "${deletingUser?.username}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
          confirmLabel={deleteUser.isPending ? 'Wird gelöscht...' : 'Löschen'}
          variant="danger"
          onConfirm={() => deletingUser && deleteUser.mutate(deletingUser.id)}
          onCancel={() => setDeletingUser(null)}
        />

        {/* Bulk-Action-Leiste — fixed unten */}
        {selectedIds.size > 0 && (
          <div
            role="toolbar"
            aria-label="Mehrfach-Aktionen"
            className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-spa-bg-secondary bg-spa-surface px-4 py-3 shadow-2xl"
          >
            <span className="text-sm font-semibold text-spa-text-primary">
              {selectedIds.size} ausgewählt
            </span>
            <div className="mx-2 h-5 w-px bg-spa-bg-secondary" />
            <Button
              variant="ghost"
              size="sm"
              icon={CheckSquare}
              onClick={selectAllVisible}
              disabled={allVisibleSelected}
            >
              Alle sichtbaren
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Shield}
              onClick={() => openBulkRoleDialog('add')}
            >
              Rolle ergänzen
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openBulkRoleDialog('remove')}
            >
              Rolle entfernen
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={handleBulkDeleteRequest}
            >
              Löschen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={clearSelection}
              aria-label="Auswahl aufheben"
            />
          </div>
        )}

        {/* Bulk Delete Confirm */}
        <ConfirmDialog
          isOpen={bulkDeleteOpen}
          title={`${selectedIds.size} Benutzer löschen?`}
          message={(() => {
            const count = selectedIds.size;
            const base = `Möchtest du wirklich ${count} Benutzer löschen? Diese Aktion kann nicht rückgängig gemacht werden.`;
            if (includesSelf) {
              return `${base}\n\n⚠️ Dein eigener Account ist Teil der Auswahl und wird übersprungen.`;
            }
            return base;
          })()}
          confirmLabel={bulkDeleting ? 'Wird gelöscht...' : 'Löschen'}
          variant="danger"
          onConfirm={handleBulkDeleteConfirm}
          onCancel={() => setBulkDeleteOpen(false)}
        />

        {/* Bulk Role Dialog */}
        <Dialog
          isOpen={bulkRoleDialogOpen}
          onClose={closeBulkRoleDialog}
          title={
            bulkRoleMode === 'add'
              ? `Rollen für ${selectedIds.size} Benutzer ergänzen`
              : `Rollen von ${selectedIds.size} Benutzern entfernen`
          }
          size="md"
          closeDisabled={bulkRoleSaving}
          footer={(
            <>
              <Button variant="ghost" onClick={closeBulkRoleDialog} disabled={bulkRoleSaving}>
                Abbrechen
              </Button>
              <Button
                icon={Save}
                onClick={handleBulkRoleSave}
                loading={bulkRoleSaving}
                loadingText="Speichert..."
                disabled={bulkRoleSelection.length === 0}
              >
                Anwenden
              </Button>
            </>
          )}
        >
          <div className="space-y-4">
            <p className="text-sm text-spa-text-secondary">
              {bulkRoleMode === 'add'
                ? 'Die ausgewählten Rollen werden zu den bestehenden Rollen jedes Benutzers hinzugefügt. Bereits vorhandene Rollen bleiben unverändert.'
                : 'Die ausgewählten Rollen werden bei den ausgewählten Benutzern entfernt. Wer dann ohne Rolle dasteht, bekommt automatisch "viewer".'}
            </p>
            {includesSelf && bulkRoleMode === 'remove' && (
              <div className="rounded-lg border border-spa-warning/40 bg-spa-warning-light px-3 py-2 text-xs text-spa-warning-dark">
                Dein eigener Account ist Teil der Auswahl. Die Rolle „admin" wird bei dir nicht entfernt, um eine Selbstaussperrung zu verhindern.
              </div>
            )}
            <fieldset>
              <legend className="block text-sm font-medium text-spa-text-primary mb-2">
                Rollen
              </legend>
              <div className="space-y-2">
                {AVAILABLE_ROLES.map((role) => (
                  <label key={role.value} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkRoleSelection.includes(role.value)}
                      onChange={() => toggleBulkRole(role.value)}
                      className="w-4 h-4 mt-0.5 text-spa-primary border-spa-bg-secondary rounded focus:ring-spa-primary"
                    />
                    <div>
                      <span className="text-sm font-medium text-spa-text-primary">{role.label}</span>
                      <p className="text-xs text-spa-text-secondary">{role.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Dialog>
      </div>
    </Layout>
  );
}

// User Dialog Component
function UserDialog({
  user,
  onClose,
  onSave,
  isSaving,
}: {
  user: User | null;
  onClose: () => void;
  onSave: (data: CreateUserData | UpdateUserData) => void;
  isSaving: boolean;
}) {
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<string[]>(user?.roles || ['viewer']);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Benutzername ist erforderlich');
      return;
    }

    if (!user && !password) {
      setError('Passwort ist erforderlich');
      return;
    }

    if (password && password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    const data: Record<string, unknown> = {
      username: username.trim(),
      email: email.trim() || undefined,
      roles,
    };

    if (password) {
      data.password = password;
    }

    onSave(data);
  };

  const toggleRole = (role: string) => {
    if (roles.includes(role)) {
      setRoles(roles.filter(r => r !== role));
    } else {
      setRoles([...roles, role]);
    }
  };

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title={user ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
      closeDisabled={isSaving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            form="user-form"
            icon={Save}
            loading={isSaving}
            loadingText="Speichern..."
          >
            Speichern
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-spa-error-light border border-spa-error/30 rounded-lg text-spa-error-dark text-sm" role="alert">
            {error}
          </div>
        )}

        <InputField
          label="Benutzername"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
        />

        <InputField
          label="E-Mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <InputField
          label={user ? 'Passwort (leer lassen für keine Änderung)' : 'Passwort'}
          type="password"
          required={!user}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
        />

        <fieldset>
          <legend className="block text-sm font-medium text-spa-text-primary mb-1">
            Rollen
          </legend>
          <div className="space-y-2">
            {AVAILABLE_ROLES.map((role) => (
              <label key={role.value} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={roles.includes(role.value)}
                  onChange={() => toggleRole(role.value)}
                  className="w-4 h-4 mt-0.5 text-spa-primary border-spa-bg-secondary rounded focus:ring-spa-primary"
                />
                <div>
                  <span className="text-sm font-medium text-spa-text-primary">{role.label}</span>
                  <p className="text-xs text-spa-text-secondary">{role.description}</p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
