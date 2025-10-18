import { describe, it, expect, afterEach, vi } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import {
  renderRoleOptions,
  initUserAdmin
} from '../webroot/admin/js/modules/user_admin.js';

function createUserAdminDom() {
  document.body.innerHTML = `
    <button id="btnUsers">Benutzer</button>
    <div id="userModal" data-open="0" style="display: none;">
      <form id="userForm">
        <h2 data-user-form-title></h2>
        <div data-user-status></div>
        <p data-user-password-hint></p>
        <table>
          <tbody data-user-table></tbody>
        </table>
        <p data-user-empty hidden></p>
        <div data-role-options></div>
        <div data-permission-options></div>
        <input id="userUsername" />
        <input id="userDisplay" />
        <input id="userPassword" />
        <button type="submit">Speichern</button>
      </form>
      <button id="userCreateBtn" type="button"></button>
      <button data-user-cancel type="button"></button>
      <button data-user-close type="button"></button>
    </div>
  `;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('user admin module', () => {
  it('disables admin role for the protected admin account', () => {
    const container = document.createElement('div');
    renderRoleOptions({
      container,
      roles: ['editor', 'admin'],
      selectedRoles: ['admin'],
      editingUser: { username: 'admin' }
    });
    const adminCheckbox = container.querySelector('input[name="roles"][value="admin"]');
    expect(adminCheckbox).not.toBeNull();
    expect(adminCheckbox?.disabled).toBe(true);
  });

  it('shows an error when the username is missing', async () => {
    createUserAdminDom();
    const fetchUserAccounts = vi.fn().mockResolvedValue({
      users: [],
      roles: ['admin'],
      permissions: ['user-admin']
    });
    const saveUserAccount = vi.fn();
    const deleteUserAccount = vi.fn();
    const setAvailablePermissions = vi.fn();

    const controller = initUserAdmin({
      hasPermission: () => true,
      fetchUserAccounts,
      saveUserAccount,
      deleteUserAccount,
      authRoles: ['admin'],
      getAvailablePermissions: () => ['user-admin'],
      setAvailablePermissions
    });

    expect(controller).toBeTruthy();
    controller?.startCreate();

    const form = document.getElementById('userForm');
    await fireEvent.submit(form);

    const status = document.querySelector('[data-user-status]');
    expect(status?.textContent).toBe('Benutzername angeben.');
    expect(status?.dataset.type).toBe('error');
    expect(saveUserAccount).not.toHaveBeenCalled();
  });

  it('prevents deleting the protected admin account', async () => {
    createUserAdminDom();
    const fetchUserAccounts = vi.fn().mockResolvedValue({
      users: [
        {
          username: 'admin',
          displayName: 'Admin',
          roles: ['admin'],
          permissions: ['user-admin']
        }
      ],
      roles: ['admin'],
      permissions: ['user-admin']
    });
    const saveUserAccount = vi.fn();
    const deleteUserAccount = vi.fn();
    const setAvailablePermissions = vi.fn();

    const controller = initUserAdmin({
      hasPermission: () => true,
      fetchUserAccounts,
      saveUserAccount,
      deleteUserAccount,
      authRoles: ['admin'],
      getAvailablePermissions: () => ['user-admin'],
      setAvailablePermissions
    });

    expect(controller).toBeTruthy();
    await controller?.reloadUsers();

    const deleteBtn = document.querySelector('[data-user-delete]');
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn?.disabled).toBe(true);
    expect(deleteBtn?.title).toContain('kann nicht gelöscht werden');
  });
});
