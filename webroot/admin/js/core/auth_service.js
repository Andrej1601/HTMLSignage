'use strict';

import { fetchJson } from './utils.js';

const API_BASE = '/admin/api/auth';
const DEFAULT_ROLES = ['saunameister', 'editor', 'admin'];
const DEFAULT_PERMISSIONS = ['cockpit', 'slides', 'global-info', 'colors', 'system', 'devices', 'user-admin'];

const normalizePermissionName = (permission) => {
  const name = String(permission || '').toLowerCase();
  if (!name) return null;
  switch (name) {
    case 'overview': return 'cockpit';
    case 'slideshows': return 'slides';
    case 'info': return 'global-info';
    case 'users': return 'user-admin';
    default: return name;
  }
};

const okPredicate = (data) => data?.ok !== false;

export async function fetchSession() {
  const data = await fetchJson(`${API_BASE}/session.php`, {
    cache: 'no-store',
    okPredicate,
    errorMessage: 'Benutzerstatus konnte nicht geladen werden.'
  });
  const user = data?.user || {};
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const permissionsRaw = Array.isArray(user?.permissions) ? user.permissions : [];
  const permissions = permissionsRaw
    .map((permission) => normalizePermissionName(permission))
    .filter((permission) => permission);
  return {
    ok: data?.ok !== false,
    user: {
      username: typeof user?.username === 'string' ? user.username : null,
      displayName: typeof user?.displayName === 'string' ? user.displayName : null,
      roles,
      permissions: permissions.length ? permissions : DEFAULT_PERMISSIONS
    }
  };
}

export async function fetchUsers() {
  const data = await fetchJson(`${API_BASE}/users_list.php`, {
    cache: 'no-store',
    okPredicate,
    errorMessage: 'Benutzerliste konnte nicht geladen werden.'
  });
  const users = Array.isArray(data?.users) ? data.users : [];
  const roles = Array.isArray(data?.roles) && data.roles.length ? data.roles : DEFAULT_ROLES;
  const permissionsCatalog = Array.isArray(data?.permissions) && data.permissions.length
    ? data.permissions.map((permission) => normalizePermissionName(permission)).filter((permission) => permission)
    : DEFAULT_PERMISSIONS;
  const normalizedUsers = users.map((user) => {
    const permissionsRaw = Array.isArray(user?.permissions) ? user.permissions : [];
    const permissions = permissionsRaw
      .map((permission) => normalizePermissionName(permission))
      .filter((permission) => permission);
    return {
      ...user,
      permissions: permissions.length ? permissions : DEFAULT_PERMISSIONS
    };
  });
  return { users: normalizedUsers, roles, permissions: permissionsCatalog };
}

export async function saveUser(payload) {
  const body = {
    username: payload?.username ?? '',
    displayName: payload?.displayName ?? '',
    roles: Array.isArray(payload?.roles) ? payload.roles : [],
    permissions: Array.isArray(payload?.permissions) ? payload.permissions : [],
  };
  if (typeof payload?.password === 'string' && payload.password !== '') {
    body.password = payload.password;
  }
  const data = await fetchJson(`${API_BASE}/users_save.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    expectOk: true,
    errorMessage: 'Benutzer konnte nicht gespeichert werden.'
  });
  return data?.user ?? null;
}

export async function deleteUser(username) {
  const data = await fetchJson(`${API_BASE}/users_delete.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
    expectOk: true,
    errorMessage: 'Benutzer konnte nicht gelöscht werden.'
  });
  return data?.ok !== false;
}

export { DEFAULT_ROLES as AVAILABLE_ROLES, DEFAULT_PERMISSIONS as AVAILABLE_PERMISSIONS };
