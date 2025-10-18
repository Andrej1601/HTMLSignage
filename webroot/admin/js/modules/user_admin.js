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

function roleMetaFor(role) {
  const key = normalizeRoleName(role);
  if (ROLE_META[key]) {
    return ROLE_META[key];
  }
  const titleCopy = typeof role === 'string' && role ? role : key;
  return { title: titleCopy, description: '' };
}

function permissionMetaFor(permission) {
  const key = normalizePermissionName(permission);
  if (PERMISSION_META[key]) {
    return PERMISSION_META[key];
  }
  const titleCopy = typeof permission === 'string' && permission ? permission : key;
  return { title: titleCopy, description: '' };
}

function renderAccessOption({
  name,
  value,
  checked,
  disabled,
  title,
  description
}) {
  const label = document.createElement('label');
  label.className = `user-${name}-option user-access-option`;
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.name = name;
  checkbox.value = value;
  checkbox.checked = checked;
  checkbox.disabled = disabled;
  const copy = document.createElement('div');
  copy.className = 'user-role-copy';
  const titleEl = document.createElement('span');
  titleEl.className = 'role-title';
  titleEl.textContent = title;
  const desc = document.createElement('small');
  desc.textContent = description;
  copy.appendChild(titleEl);
  copy.appendChild(desc);
  label.appendChild(checkbox);
  label.appendChild(copy);
  return { label, checkbox };
}

export function renderRoleOptions({
  container,
  roles = [],
  selectedRoles = [],
  editingUser = null
}) {
  if (!container) return [];
  const selection = new Set(
    Array.isArray(selectedRoles)
      ? selectedRoles.map((role) => normalizeRoleName(role)).filter(Boolean)
      : []
  );
  const normalizedRoles = Array.isArray(roles)
    ? roles.map((role) => normalizeRoleName(role)).filter(Boolean)
    : [];
  const isProtectedAdmin =
    editingUser?.username?.toLowerCase() === PROTECTED_ADMIN_USERNAME;
  container.innerHTML = '';
  const checkboxes = [];
  normalizedRoles.forEach((roleName) => {
    const meta = roleMetaFor(roleName);
    const { label, checkbox } = renderAccessOption({
      name: 'roles',
      value: roleName,
      checked: selection.has(roleName),
      disabled: isProtectedAdmin && roleName === 'admin',
      title: meta.title,
      description: meta.description
    });
    if (checkbox.disabled) {
      label.title = 'Der ursprüngliche Admin behält immer die Admin-Rolle.';
    }
    container.appendChild(label);
    checkboxes.push(checkbox);
  });
  return checkboxes;
}

export function renderPermissionOptions({
  container,
  permissions = [],
  selectedPermissions = []
}) {
  if (!container) return [];
  const selection = new Set(
    Array.isArray(selectedPermissions)
      ? selectedPermissions
          .map((permission) => normalizePermissionName(permission))
          .filter(Boolean)
      : []
  );
  const normalizedPermissions = Array.isArray(permissions)
    ? permissions
        .map((permission) => normalizePermissionName(permission))
        .filter(Boolean)
    : [];
  container.innerHTML = '';
  const checkboxes = [];
  normalizedPermissions.forEach((permissionName) => {
    const meta = permissionMetaFor(permissionName);
    const { label, checkbox } = renderAccessOption({
      name: 'permissions',
      value: permissionName,
      checked: selection.has(permissionName),
      disabled: false,
      title: meta.title,
      description: meta.description
    });
    container.appendChild(label);
    checkboxes.push(checkbox);
  });
  return checkboxes;
}

export function renderUserTable({
  tableBody,
  emptyHint,
  users = [],
  editingUser = null,
  onEdit,
  onDelete
}) {
  if (!tableBody || !emptyHint) return [];
  tableBody.innerHTML = '';
  const sorted = users.slice().sort((a, b) => {
    const nameA = String(a?.username ?? '').toLowerCase();
    const nameB = String(b?.username ?? '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
  if (!sorted.length) {
    emptyHint.hidden = false;
    return [];
  }
  emptyHint.hidden = true;
  const rows = [];
  sorted.forEach((user) => {
    const username = String(user?.username ?? '');
    const display = user?.displayName ? String(user.displayName) : '';
    const rolesList = Array.isArray(user?.roles) ? user.roles : [];
    const roleTitles = rolesList.map((role) => roleMetaFor(role).title).join(', ');
    const roleHtml = roleTitles ? escapeHtml(roleTitles) : '—';
    const permissionsList = Array.isArray(user?.permissions) ? user.permissions : [];
    const permissionTitles = permissionsList
      .map((permission) => permissionMetaFor(permission).title)
      .join(', ');
    const permissionsHtml = permissionTitles ? escapeHtml(permissionTitles) : '—';
    const displayHtml = display ? `<div class="mut">${escapeHtml(display)}</div>` : '';
    const row = document.createElement('tr');
    if (editingUser && editingUser.username === username) {
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
    const editBtn = row.querySelector('[data-user-edit]');
    if (editBtn && typeof onEdit === 'function') {
      editBtn.addEventListener('click', () => onEdit(user));
    }
    const deleteBtn = row.querySelector('[data-user-delete]');
    if (deleteBtn) {
      if (username.toLowerCase() === PROTECTED_ADMIN_USERNAME) {
        deleteBtn.disabled = true;
        deleteBtn.title = 'Der ursprüngliche Admin kann nicht gelöscht werden.';
      } else if (typeof onDelete === 'function') {
        deleteBtn.addEventListener('click', () => onDelete(user));
      }
    }
    tableBody.appendChild(row);
    rows.push(row);
  });
  return rows;
}

export class UserAdminController {
  constructor({ elements, services, options = {} }) {
    const {
      modal,
      openBtn,
      form,
      title,
      status,
      passwordHint,
      tableBody,
      emptyHint,
      roleContainer,
      permissionContainer,
      usernameInput,
      displayInput,
      passwordInput,
      submitBtn,
      createBtn,
      cancelBtn,
      closeButtons
    } = elements;

    const {
      fetchUserAccounts,
      saveUserAccount,
      deleteUserAccount,
      setAvailablePermissions
    } = services;

    const { authRoles = DEFAULT_ROLES, getAvailablePermissions } = options;

    this.modal = modal;
    this.openBtn = openBtn;
    this.form = form;
    this.title = title;
    this.status = status;
    this.passwordHint = passwordHint;
    this.tableBody = tableBody;
    this.emptyHint = emptyHint;
    this.roleContainer = roleContainer;
    this.permissionContainer = permissionContainer;
    this.usernameInput = usernameInput;
    this.displayInput = displayInput;
    this.passwordInput = passwordInput;
    this.submitBtn = submitBtn;
    this.createBtn = createBtn;
    this.cancelBtn = cancelBtn;
    this.closeButtons = Array.isArray(closeButtons)
      ? closeButtons
      : Array.from(closeButtons || []);

    this.fetchUserAccounts = fetchUserAccounts;
    this.saveUserAccount = saveUserAccount;
    this.deleteUserAccount = deleteUserAccount;
    this.setAvailablePermissions = setAvailablePermissions;

    this.roles = this.normalizeRoles(authRoles);
    this.availablePermissions = resolveInitialPermissions(
      authRoles,
      getAvailablePermissions
    );
    this.permissionsCatalog = mergeAvailablePermissions(this.availablePermissions);

    this.users = [];
    this.editing = null;
    this.isBusy = false;

    this.handleFormSubmit = this.handleFormSubmit.bind(this);
    this.handleCreateClick = this.handleCreateClick.bind(this);
    this.handleCancelClick = this.handleCancelClick.bind(this);
    this.handleOpen = this.handleOpen.bind(this);
    this.handleCloseButton = this.handleCloseButton.bind(this);
    this.handleModalClick = this.handleModalClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.startEdit = this.startEdit.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
  }

  normalizeRoles(list) {
    return Array.isArray(list) && list.length
      ? Array.from(
          new Set(
            list.map((role) => normalizeRoleName(role)).filter((role) => role)
          )
        )
      : DEFAULT_ROLES;
  }

  init() {
    if (!this.modal || !this.openBtn) {
      return false;
    }
    this.modal.dataset.open = this.modal.dataset.open || '0';

    if (this.form) {
      this.form.addEventListener('submit', this.handleFormSubmit);
    }
    if (this.createBtn) {
      this.createBtn.addEventListener('click', this.handleCreateClick);
    }
    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', this.handleCancelClick);
    }
    this.closeButtons.forEach((btn) => {
      btn.addEventListener('click', this.handleCloseButton);
    });

    this.modal.addEventListener('click', this.handleModalClick);
    document.addEventListener('keydown', this.handleKeydown);
    this.openBtn.addEventListener('click', this.handleOpen);
    return true;
  }

  setStatus(message, type = 'info') {
    if (!this.status) return;
    this.status.textContent = message || '';
    this.status.dataset.type = message ? type : '';
  }

  setBusy(value) {
    this.isBusy = !!value;
    if (this.modal) {
      this.modal.classList.toggle('is-busy', this.isBusy);
    }
    if (this.submitBtn) this.submitBtn.disabled = this.isBusy;
    if (this.createBtn) this.createBtn.disabled = this.isBusy;
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.dataset.open = '0';
    this.modal.style.display = 'none';
  }

  focusInitial() {
    const target = this.editing ? this.displayInput : this.usernameInput;
    if (target) {
      try {
        target.focus();
        if (typeof target.select === 'function') target.select();
      } catch (error) {
        console.warn('[admin] Benutzerfokus fehlgeschlagen', error);
      }
    }
  }

  collectSelectedRoles() {
    return Array.from(
      this.roleContainer?.querySelectorAll('input[name="roles"]:checked') || []
    ).map((input) => normalizeRoleName(input.value));
  }

  collectSelectedPermissions() {
    return Array.from(
      this.permissionContainer?.querySelectorAll('input[name="permissions"]:checked') || []
    ).map((input) => normalizePermissionName(input.value));
  }

  updateAvailablePermissions(permissions) {
    this.availablePermissions = mergeAvailablePermissions(permissions);
    this.permissionsCatalog = mergeAvailablePermissions(this.availablePermissions);
    if (typeof this.setAvailablePermissions === 'function') {
      this.setAvailablePermissions(this.availablePermissions);
    }
  }

  startCreate({ preserveStatus = false } = {}) {
    this.editing = null;
    renderRoleOptions({
      container: this.roleContainer,
      roles: this.roles
    });
    renderPermissionOptions({
      container: this.permissionContainer,
      permissions: this.permissionsCatalog
    });
    if (this.title) this.title.textContent = 'Benutzer anlegen';
    if (!preserveStatus) this.setStatus('');
    if (this.usernameInput) this.usernameInput.value = '';
    if (this.displayInput) this.displayInput.value = '';
    if (this.passwordInput) this.passwordInput.value = '';
    if (this.passwordHint) this.passwordHint.hidden = false;
    if (this.submitBtn) this.submitBtn.textContent = 'Benutzer speichern';
    this.focusInitial();
  }

  setEditing(user) {
    this.editing = user;
    const rolesList = Array.isArray(user?.roles) ? user.roles : [];
    const permissionsList = Array.isArray(user?.permissions) ? user.permissions : [];
    renderRoleOptions({
      container: this.roleContainer,
      roles: this.roles,
      selectedRoles: rolesList,
      editingUser: user
    });
    renderPermissionOptions({
      container: this.permissionContainer,
      permissions: this.permissionsCatalog,
      selectedPermissions: permissionsList
    });
    if (this.title) this.title.textContent = `Benutzer “${user?.username ?? ''}” bearbeiten`;
    if (this.usernameInput) this.usernameInput.value = user?.username ?? '';
    if (this.displayInput) this.displayInput.value = user?.displayName ?? '';
    if (this.passwordInput) this.passwordInput.value = '';
    if (this.passwordHint) this.passwordHint.hidden = true;
    if (this.submitBtn) this.submitBtn.textContent = 'Änderungen speichern';
    this.focusInitial();
  }

  startEdit(user) {
    this.setStatus('');
    this.setEditing(user);
  }

  async handleDelete(user) {
    if (!user?.username) return;
    if (!confirm(`Benutzer ${user.username} wirklich löschen?`)) return;
    try {
      this.setBusy(true);
      await this.deleteUserAccount(user.username);
      this.setStatus('Benutzer gelöscht.', 'success');
      if (this.editing && this.editing.username === user.username) {
        this.editing = null;
      }
      await this.reloadUsers({ silent: true });
      this.startCreate({ preserveStatus: true });
    } catch (error) {
      console.error('[admin] Benutzer löschen fehlgeschlagen', error);
      this.setStatus(error.message || 'Benutzer konnte nicht gelöscht werden.', 'error');
    } finally {
      this.setBusy(false);
    }
  }

  renderUserTable() {
    return renderUserTable({
      tableBody: this.tableBody,
      emptyHint: this.emptyHint,
      users: this.users,
      editingUser: this.editing,
      onEdit: this.startEdit,
      onDelete: this.handleDelete
    });
  }

  async reloadUsers({ preserveSelection = false, silent = false } = {}) {
    if (!silent) this.setBusy(true);
    try {
      const data = await this.fetchUserAccounts();
      this.users = Array.isArray(data?.users) ? data.users : [];
      if (Array.isArray(data?.roles) && data.roles.length) {
        this.roles = this.normalizeRoles(data.roles);
      }
      if (Array.isArray(data?.permissions) && data.permissions.length) {
        this.updateAvailablePermissions(data.permissions);
      }
      if (preserveSelection && this.editing) {
        const match = this.users.find(
          (entry) => entry?.username === this.editing.username
        );
        this.renderUserTable();
        if (match) {
          this.startEdit(match);
          return;
        }
      }
      this.renderUserTable();
      this.startCreate({ preserveStatus: true });
    } catch (error) {
      console.error('[admin] Benutzerliste laden fehlgeschlagen', error);
      this.setStatus(
        error.message || 'Benutzerliste konnte nicht geladen werden.',
        'error'
      );
    } finally {
      if (!silent) this.setBusy(false);
    }
  }

  async handleFormSubmit(event) {
    event.preventDefault();
    const username = (this.usernameInput?.value || '').trim().toLowerCase();
    if (!username) {
      this.setStatus('Benutzername angeben.', 'error');
      this.focusInitial();
      return;
    }
    const rolesSelection = this.collectSelectedRoles();
    if (!rolesSelection.length) {
      this.setStatus('Mindestens eine Rolle auswählen.', 'error');
      return;
    }
    const permissionsSelection = this.collectSelectedPermissions();
    if (!permissionsSelection.length) {
      this.setStatus('Mindestens einen Bereich auswählen.', 'error');
      return;
    }
    const payload = {
      username,
      displayName: (this.displayInput?.value || '').trim(),
      roles: rolesSelection,
      permissions: permissionsSelection
    };
    const password = (this.passwordInput?.value || '').trim();
    if (password) {
      payload.password = password;
    }
    try {
      this.setBusy(true);
      await this.saveUserAccount(payload);
      this.setStatus(
        this.editing ? 'Benutzer aktualisiert.' : 'Benutzer angelegt.',
        'success'
      );
      if (this.passwordInput) this.passwordInput.value = '';
      await this.reloadUsers({
        preserveSelection: !!this.editing,
        silent: true
      });
      if (!this.editing) {
        this.startCreate({ preserveStatus: true });
      }
    } catch (error) {
      console.error('[admin] Benutzer speichern fehlgeschlagen', error);
      this.setStatus(error.message || 'Speichern fehlgeschlagen.', 'error');
    } finally {
      this.setBusy(false);
    }
  }

  handleCreateClick() {
    this.startCreate();
  }

  handleCancelClick() {
    this.startCreate({ preserveStatus: true });
  }

  async handleOpen() {
    if (this.isBusy || !this.modal) return;
    this.modal.dataset.open = '1';
    this.modal.style.display = 'grid';
    this.setStatus('');
    await this.reloadUsers();
    this.focusInitial();
  }

  handleCloseButton() {
    if (!this.isBusy) {
      this.closeModal();
    }
  }

  handleModalClick(event) {
    if (event.target === this.modal && !this.isBusy) {
      this.closeModal();
    }
  }

  handleKeydown(event) {
    if (event.key === 'Escape' && this.modal?.dataset.open === '1') {
      this.closeModal();
    }
  }
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
    return null;
  }

  const openBtn = document.getElementById('btnUsers');
  const modal = document.getElementById('userModal');
  if (!openBtn || !modal) {
    return null;
  }

  const form = modal.querySelector('#userForm');

  const controller = new UserAdminController({
    elements: {
      modal,
      openBtn,
      form,
      title: modal.querySelector('[data-user-form-title]'),
      status: modal.querySelector('[data-user-status]'),
      passwordHint: modal.querySelector('[data-user-password-hint]'),
      tableBody: modal.querySelector('[data-user-table]'),
      emptyHint: modal.querySelector('[data-user-empty]'),
      roleContainer: modal.querySelector('[data-role-options]'),
      permissionContainer: modal.querySelector('[data-permission-options]'),
      usernameInput: modal.querySelector('#userUsername'),
      displayInput: modal.querySelector('#userDisplay'),
      passwordInput: modal.querySelector('#userPassword'),
      submitBtn: form?.querySelector('[type=submit]'),
      createBtn: modal.querySelector('#userCreateBtn'),
      cancelBtn: modal.querySelector('[data-user-cancel]'),
      closeButtons: modal.querySelectorAll('[data-user-close]')
    },
    services: {
      fetchUserAccounts,
      saveUserAccount,
      deleteUserAccount,
      setAvailablePermissions
    },
    options: {
      authRoles,
      getAvailablePermissions
    }
  });

  if (!controller.init()) {
    return null;
  }

  return controller;
}
