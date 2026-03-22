import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Skeleton, SkeletonTableRow } from '@/components/Skeleton';
import { PageHeader } from '@/components/PageHeader';
import { Plus, Edit2, Trash2, Users as UsersIcon, Shield, Save, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { InputField } from '@/components/FormField';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorAlert } from '@/components/ErrorAlert';
import { StatCard } from '@/components/Dashboard/StatCard';
import { SectionCard } from '@/components/SectionCard';
import { AVAILABLE_ROLES } from '@/utils/permissions';
import { fetchApi } from '@/services/api';

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
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch users
  const { data: users = [], isLoading, error, refetch } = useQuery<User[]>({
    queryKey: ['users', token],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      if (!token) throw new Error('unauthorized');
      try {
        return await fetchApi<User[]>('/users', { token });
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
      if (!token) throw new Error('unauthorized');
      return fetchApi('/users', {
        method: 'POST',
        token,
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
      if (!token) throw new Error('unauthorized');
      return fetchApi(`/users/${id}`, {
        method: 'PATCH',
        token,
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
      if (!token) throw new Error('unauthorized');
      return fetchApi(`/users/${id}`, {
        method: 'DELETE',
        token,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeletingUser(null);
    },
  });

  const userColumns: Column<User>[] = [
    {
      key: 'username',
      header: 'Benutzer',
      sortFn: (a, b) => a.username.localeCompare(b.username),
      render: (u) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10 bg-spa-primary rounded-full flex items-center justify-center text-white font-bold">
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
                    ? 'bg-spa-warning-light text-spa-warning-dark'
                    : role === 'editor'
                    ? 'bg-spa-info-light text-spa-info-dark'
                    : role === 'saunameister'
                    ? 'bg-emerald-100 text-emerald-700'
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

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-2xl bg-spa-bg-secondary" />
          <div className="rounded-xl border border-spa-bg-secondary bg-white overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-3 border-b border-spa-bg-secondary bg-spa-bg-primary">
              {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="text" className="h-4 w-20" />)}
            </div>
            {Array.from({ length: 5 }, (_, i) => <SkeletonTableRow key={i} columns={4} />)}
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
            { label: `${users.filter((entry) => entry.roles.includes('admin')).length} Admins`, tone: 'warning' },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard title="Gesamt" value={users.length} icon={UsersIcon} color="primary" />
          <StatCard title="Administratoren" value={users.filter(u => u.roles.includes('admin')).length} icon={Shield} color="info" />
        </div>

        <SectionCard title="Benutzer" icon={UsersIcon}>
          {users.length > 0 && (
            <div className="relative max-w-xs mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-spa-text-secondary" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Benutzer suchen..."
                aria-label="Benutzer durchsuchen"
                className="w-full rounded-lg border border-spa-bg-secondary bg-white py-2 pl-9 pr-3 text-sm text-spa-text-primary placeholder:text-spa-text-secondary/60 outline-none focus:border-spa-primary focus:ring-2 focus:ring-spa-primary/20"
              />
            </div>
          )}
          {users.length === 0 ? (
            <div className="py-8 text-center">
              <UsersIcon className="w-16 h-16 text-spa-text-secondary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-spa-text-primary mb-2">
                Keine Benutzer
              </h3>
              <p className="text-spa-text-secondary mb-4">
                Erstelle den ersten Benutzer, um loszulegen.
              </p>
              <Button icon={Plus} onClick={() => setIsCreateDialogOpen(true)}>
                Ersten Benutzer anlegen
              </Button>
            </div>
          ) : (
            <DataTable<User>
              data={filteredUsers}
              keyFn={(u) => u.id}
              mobileTitle={(u) => (
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 h-10 w-10 bg-spa-primary rounded-full flex items-center justify-center text-white font-bold">
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
