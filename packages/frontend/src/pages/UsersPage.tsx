import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Plus, Edit2, Trash2, Users as UsersIcon, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config/env';

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
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Fetch users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  // Create user mutation
  const createUser = useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateDialogOpen(false);
    },
  });

  // Update user mutation
  const updateUser = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserData }) => {
      const response = await fetch(`${API_URL}/api/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
    },
  });

  // Delete user mutation
  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeletingUser(null);
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-spa-text-secondary">Lade Benutzer...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-spa-text-primary mb-2">Benutzerverwaltung</h2>
              <p className="text-spa-text-secondary">
                Verwalte Benutzer und deren Zugriffsrechte
              </p>
            </div>

            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="px-6 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Benutzer anlegen
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-spa-bg-primary rounded-lg">
                  <UsersIcon className="w-6 h-6 text-spa-primary" />
                </div>
                <div>
                  <p className="text-sm text-spa-text-secondary">Gesamt</p>
                  <p className="text-2xl font-bold text-spa-text-primary">{users.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-spa-text-secondary">Administratoren</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {users.filter(u => u.roles.includes('admin')).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Benutzer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  E-Mail
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rollen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Erstellt
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-spa-primary rounded-full flex items-center justify-center text-white font-bold">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email || '—'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : role === 'editor'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="text-spa-primary hover:text-spa-primary-dark mr-3"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingUser(user)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
        {deletingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-spa-text-primary mb-4">
                Benutzer löschen?
              </h3>
              <p className="text-spa-text-secondary mb-6">
                Möchtest du den Benutzer "{deletingUser.username}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDeletingUser(null)}
                  disabled={deleteUser.isPending}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => deleteUser.mutate(deletingUser.id)}
                  disabled={deleteUser.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteUser.isPending ? 'Wird gelöscht...' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        )}
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

    if (password && password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    const data: any = {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-spa-text-primary">
            {user ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
          </h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Benutzername *
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-spa-primary focus:border-transparent"
              required
              minLength={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              E-Mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-spa-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Passwort {user ? '(leer lassen für keine Änderung)' : '*'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-spa-primary focus:border-transparent"
              required={!user}
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-spa-text-primary mb-2">
              Rollen
            </label>
            <div className="space-y-2">
              {['admin', 'editor', 'viewer'].map((role) => (
                <label key={role} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="mr-2"
                  />
                  <span className="text-sm capitalize">{role}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
