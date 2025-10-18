// /admin/js/modules/user_admin.js
// =============================================================================
// Benutzer- und Rollenverwaltung im Admin-Frontend
// =============================================================================

'use strict';

import { escapeHtml } from '../core/utils.js';
import {
  PROTECTED_ADMIN_USERNAME,
  ROLE_META,
  PERMISSION_META,
  mergeAvailablePermissions,
  resolvePermissionsForRoles,
  normalizeRoleName,
  normalizePermissionName
} from '../core/permissions.js';

const DEFAULT_ROLES = ['saunameister', 'editor', 'admin'];

function resolveInitialPermissions(authRoles, getAvailablePermissions) {
  if (typeof getAvailablePermissions === 'function') {
    const current = getAvailablePermissions();
    if (Array.isArray(current) && current.length) {
      return mergeAvailablePermissions(current);
    }
  }
  if (Array.isArray(authRoles) && authRoles.length) {
    return mergeAvailablePermissions(resolvePermissionsForRoles(authRoles));
  }
  return mergeAvailablePermissions(resolvePermissionsForRoles(DEFAULT_ROLES));
}

export function initUserAdmin({
  hasPermission,
  fetchUserAccounts,
  saveUserAccount,
  deleteUserAccount,
  authRoles = DEFAULT_ROLES,
  getAvailablePermissions,
  setAvailablePermissions
}) {
  if (typeof hasPermission !== 'function' || !hasPermission('user-admin')) {
    const limitedBtn = document.getElementById('btnUsers');
    if (limitedBtn) limitedBtn.remove();
    const limitedModal = document.getElementById('userModal');
    if (limitedModal) limitedModal.remove();
    return;
  }

  const openBtn = document.getElementById('btnUsers');
  const modal = document.getElementById('userModal');
  if (!openBtn || !modal) return;

  modal.dataset.open = modal.dataset.open || '0';

  const form = modal.querySelector('#userForm');
  const title = modal.querySelector('[data-user-form-title]');
  const status = modal.querySelector('[data-user-status]');
  const passwordHint = modal.querySelector('[data-user-password-hint]');
  const tableBody = modal.querySelector('[data-user-table]');
  const emptyHint = modal.querySelector('[data-user-empty]');
  const roleContainer = modal.querySelector('[data-role-options]');
  const permissionContainer = modal.querySelector('[data-permission-options]');
  const usernameInput = modal.querySelector('#userUsername');
  const displayInput = modal.querySelector('#userDisplay');
  const passwordInput = modal.querySelector('#userPassword');
  const submitBtn = form?.querySelector('[type=submit]');
  const createBtn = modal.querySelector('#userCreateBtn');
  const cancelBtn = modal.querySelector('[data-user-cancel]');
  const closeButtons = modal.querySelectorAll('[data-user-close]');

  let users = [];
  let roles = Array.isArray(authRoles) && authRoles.length
    ? Array.from(new Set(authRoles.map((role) => normalizeRoleName(role)).filter((role) => role)))
    : DEFAULT_ROLES;
  let availablePermissions = resolveInitialPermissions(authRoles, getAvailablePermissions);
  let permissionsCatalog = mergeAvailablePermissions(availablePermissions);
  let editing = null;
  let isBusy = false;

  const updateAvailablePermissions = (permissions) => {
    availablePermissions = mergeAvailablePermissions(permissions);
    permissionsCatalog = mergeAvailablePermissions(availablePermissions);
    if (typeof setAvailablePermissions === 'function') {
      setAvailablePermissions(availablePermissions);
    }
  };

  const roleMetaFor = (role) => {
    const key = normalizeRoleName(role);
    if (ROLE_META[key]) {
      return ROLE_META[key];
    }
    const titleCopy = typeof role === 'string' && role ? role : key;
    return { title: titleCopy, description: '' };
  };

  const permissionMetaFor = (permission) => {
    const key = normalizePermissionName(permission);
    if (PERMISSION_META[key]) {
      return PERMISSION_META[key];
    }
    const titleCopy = typeof permission === 'string' && permission ? permission : key;
    return { title: titleCopy, description: '' };
  };

  const setStatus = (message, type = 'info') => {
    if (!status) return;
    status.textContent = message || '';
    status.dataset.type = message ? type : '';
  };

  const setBusy = (value) => {
    isBusy = !!value;
    modal.classList.toggle('is-busy', isBusy);
    if (submitBtn) submitBtn.disabled = isBusy;
    if (createBtn) createBtn.disabled = isBusy;
  };

  const closeModal = () => {
    modal.dataset.open = '0';
    modal.style.display = 'none';
  };

  const focusInitial = () => {
    const target = editing ? displayInput : usernameInput;
    if (target) {
      try {
        target.focus();
        if (typeof target.select === 'function') target.select();
      } catch (error) {
        console.warn('[admin] Benutzerfokus fehlgeschlagen', error);
      }
    }
  };

  const collectSelectedRoles = () => Array.from(
    roleContainer?.querySelectorAll('input[name="roles"]:checked') || []
  ).map((input) => normalizeRoleName(input.value));

  const collectSelectedPermissions = () => Array.from(
    permissionContainer?.querySelectorAll('input[name="permissions"]:checked') || []
  ).map((input) => normalizePermissionName(input.value));

  const buildRoleOptions = (selectedRoles = []) => {
    if (!roleContainer) return;
    const selection = Array.isArray(selectedRoles)
      ? selectedRoles.map((role) => normalizeRoleName(role))
      : [];
    roleContainer.innerHTML = '';
    roles.forEach((role) => {
      const roleName = normalizeRoleName(role);
      const meta = roleMetaFor(roleName);
      const label = document.createElement('label');
      label.className = 'user-role-option user-access-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'roles';
      checkbox.value = roleName;
      checkbox.checked = selection.includes(roleName);
      if (editing && editing.username === PROTECTED_ADMIN_USERNAME && roleName === 'admin') {
        checkbox.disabled = true;
        label.title = 'Der ursprüngliche Admin behält immer die Admin-Rolle.';
      }
      const copy = document.createElement('div');
      copy.className = 'user-role-copy';
      const titleEl = document.createElement('span');
      titleEl.className = 'role-title';
      titleEl.textContent = meta.title;
      const desc = document.createElement('small');
      desc.textContent = meta.description;
      copy.appendChild(titleEl);
      copy.appendChild(desc);
      label.appendChild(checkbox);
      label.appendChild(copy);
      roleContainer.appendChild(label);
    });
  };

  const buildPermissionOptions = (selectedPermissions = []) => {
    if (!permissionContainer) return;
    const selection = Array.isArray(selectedPermissions)
      ? selectedPermissions.map((permission) => normalizePermissionName(permission))
      : [];
    permissionContainer.innerHTML = '';
    permissionsCatalog.forEach((permission) => {
      const permissionName = normalizePermissionName(permission);
      const meta = permissionMetaFor(permissionName);
      const label = document.createElement('label');
      label.className = 'user-permission-option user-access-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'permissions';
      checkbox.value = permissionName;
      checkbox.checked = selection.includes(permissionName);
      const copy = document.createElement('div');
      copy.className = 'user-role-copy';
      const titleEl = document.createElement('span');
      titleEl.className = 'role-title';
      titleEl.textContent = meta.title;
      const desc = document.createElement('small');
      desc.textContent = meta.description;
      copy.appendChild(titleEl);
      copy.appendChild(desc);
      label.appendChild(checkbox);
      label.appendChild(copy);
      permissionContainer.appendChild(label);
    });
  };

  const startCreate = ({ preserveStatus = false } = {}) => {
    editing = null;
    buildRoleOptions();
    buildPermissionOptions();
    if (title) title.textContent = 'Benutzer anlegen';
    if (!preserveStatus) setStatus('');
    if (usernameInput) usernameInput.value = '';
    if (displayInput) displayInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (passwordHint) passwordHint.hidden = false;
    if (submitBtn) submitBtn.textContent = 'Benutzer speichern';
    focusInitial();
  };

  const setEditing = (user) => {
    editing = user;
    const rolesList = Array.isArray(user?.roles) ? user.roles : [];
    const permissionsList = Array.isArray(user?.permissions) ? user.permissions : [];
    buildRoleOptions(rolesList);
    buildPermissionOptions(permissionsList);
    if (title) title.textContent = `Benutzer “${user?.username ?? ''}” bearbeiten`;
    if (usernameInput) usernameInput.value = user?.username ?? '';
    if (displayInput) displayInput.value = user?.displayName ?? '';
    if (passwordInput) passwordInput.value = '';
    if (passwordHint) passwordHint.hidden = true;
    if (submitBtn) submitBtn.textContent = 'Änderungen speichern';
    focusInitial();
  };

  const startEdit = (user) => {
    setStatus('');
    setEditing(user);
  };

  const handleDelete = async (user) => {
    if (!user?.username) return;
    if (!confirm(`Benutzer ${user.username} wirklich löschen?`)) return;
    try {
      setBusy(true);
      await deleteUserAccount(user.username);
      setStatus('Benutzer gelöscht.', 'success');
      if (editing && editing.username === user.username) {
        editing = null;
      }
      await reloadUsers({ silent: true });
      startCreate({ preserveStatus: true });
    } catch (error) {
      console.error('[admin] Benutzer löschen fehlgeschlagen', error);
      setStatus(error.message || 'Benutzer konnte nicht gelöscht werden.', 'error');
    } finally {
      setBusy(false);
    }
  };

  function renderUserTable() {
    if (!tableBody || !emptyHint) return;
    tableBody.innerHTML = '';
    const sorted = users.slice().sort((a, b) => {
      const nameA = String(a?.username ?? '').toLowerCase();
      const nameB = String(b?.username ?? '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    if (!sorted.length) {
      emptyHint.hidden = false;
      return;
    }
    emptyHint.hidden = true;
    sorted.forEach((user) => {
      const username = String(user?.username ?? '');
      const display = user?.displayName ? String(user.displayName) : '';
      const rolesList = Array.isArray(user?.roles) ? user.roles : [];
      const roleTitles = rolesList.map((role) => roleMetaFor(role).title).join(', ');
      const roleHtml = roleTitles ? escapeHtml(roleTitles) : '—';
      const permissionsList = Array.isArray(user?.permissions) ? user.permissions : [];
      const permissionTitles = permissionsList.map((permission) => permissionMetaFor(permission).title).join(', ');
      const permissionsHtml = permissionTitles ? escapeHtml(permissionTitles) : '—';
      const displayHtml = display ? `<div class="mut">${escapeHtml(display)}</div>` : '';
      const row = document.createElement('tr');
      if (editing && editing.username === username) {
        row.classList.add('is-editing');
      }
      row.innerHTML = `
        <td>
          <strong>${escapeHtml(username)}</strong>
          ${displayHtml}
        </td>
        <td>${roleHtml}</td>
        <td>${permissionsHtml}</td>
        <td class="user-actions">
          <button type="button" class="btn sm" data-user-edit>Bearbeiten</button>
          <button type="button" class="btn sm danger" data-user-delete>Löschen</button>
        </td>
      `;
      row.querySelector('[data-user-edit]')?.addEventListener('click', () => startEdit(user));
      const deleteBtn = row.querySelector('[data-user-delete]');
      if (deleteBtn) {
        if (username.toLowerCase() === PROTECTED_ADMIN_USERNAME) {
          deleteBtn.disabled = true;
          deleteBtn.title = 'Der ursprüngliche Admin kann nicht gelöscht werden.';
        } else {
          deleteBtn.addEventListener('click', () => handleDelete(user));
        }
      }
      tableBody.appendChild(row);
    });
  }

  async function reloadUsers({ preserveSelection = false, silent = false } = {}) {
    if (!silent) setBusy(true);
    try {
      const data = await fetchUserAccounts();
      users = Array.isArray(data?.users) ? data.users : [];
      roles = Array.isArray(data?.roles) && data.roles.length
        ? Array.from(new Set(data.roles.map((role) => normalizeRoleName(role)).filter((role) => role)))
        : roles;
      if (Array.isArray(data?.permissions) && data.permissions.length) {
        updateAvailablePermissions(data.permissions);
      }
      if (preserveSelection && editing) {
        const match = users.find((entry) => entry?.username === editing.username);
        renderUserTable();
        if (match) {
          startEdit(match);
          return;
        }
      }
      renderUserTable();
      startCreate({ preserveStatus: true });
    } catch (error) {
      console.error('[admin] Benutzerliste laden fehlgeschlagen', error);
      setStatus(error.message || 'Benutzerliste konnte nicht geladen werden.', 'error');
    } finally {
      if (!silent) setBusy(false);
    }
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const username = (usernameInput?.value || '').trim().toLowerCase();
      if (!username) {
        setStatus('Benutzername angeben.', 'error');
        focusInitial();
        return;
      }
      const rolesSelection = collectSelectedRoles();
      if (!rolesSelection.length) {
        setStatus('Mindestens eine Rolle auswählen.', 'error');
        return;
      }
      const permissionsSelection = collectSelectedPermissions();
      if (!permissionsSelection.length) {
        setStatus('Mindestens einen Bereich auswählen.', 'error');
        return;
      }
      const payload = {
        username,
        displayName: (displayInput?.value || '').trim(),
        roles: rolesSelection,
        permissions: permissionsSelection
      };
      const password = (passwordInput?.value || '').trim();
      if (password) {
        payload.password = password;
      }
      try {
        setBusy(true);
        await saveUserAccount(payload);
        setStatus(editing ? 'Benutzer aktualisiert.' : 'Benutzer angelegt.', 'success');
        if (passwordInput) passwordInput.value = '';
        await reloadUsers({ preserveSelection: !!editing, silent: true });
        if (!editing) {
          startCreate({ preserveStatus: true });
        }
      } catch (error) {
        console.error('[admin] Benutzer speichern fehlgeschlagen', error);
        setStatus(error.message || 'Speichern fehlgeschlagen.', 'error');
      } finally {
        setBusy(false);
      }
    });
  }

  if (createBtn) {
    createBtn.addEventListener('click', () => startCreate());
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => startCreate({ preserveStatus: true }));
  }

  closeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!isBusy) closeModal();
    });
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal && !isBusy) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.dataset.open === '1') {
      closeModal();
    }
  });

  openBtn.addEventListener('click', async () => {
    if (isBusy) return;
    modal.dataset.open = '1';
    modal.style.display = 'grid';
    setStatus('');
    await reloadUsers();
    focusInitial();
  });
}
