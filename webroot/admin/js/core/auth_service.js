'use strict';

import { fetchJson } from './utils.js';

const API_BASE = '/admin/api/auth';
const DEFAULT_ROLES = ['viewer', 'editor', 'admin'];

const okPredicate = (data) => data?.ok !== false;

export async function fetchUsers() {
  const data = await fetchJson(`${API_BASE}/users_list.php`, {
    cache: 'no-store',
    okPredicate,
    errorMessage: 'Benutzerliste konnte nicht geladen werden.'
  });
  const users = Array.isArray(data?.users) ? data.users : [];
  const roles = Array.isArray(data?.roles) && data.roles.length ? data.roles : DEFAULT_ROLES;
  return { users, roles };
}

export async function saveUser(payload) {
  const body = {
    username: payload?.username ?? '',
    displayName: payload?.displayName ?? '',
    roles: Array.isArray(payload?.roles) ? payload.roles : [],
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

export { DEFAULT_ROLES as AVAILABLE_ROLES };
