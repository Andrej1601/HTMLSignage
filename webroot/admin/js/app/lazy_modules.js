export function createLazyModuleManager({
  hasPermission,
  fetchJson,
  fetchUserAccounts,
  saveUserAccount,
  deleteUserAccount,
  authRoles,
  getAvailablePermissions,
  setAvailablePermissions,
  mergeAvailablePermissions
}) {
  const lazyModuleState = {
    backup: null,
    cleanup: null,
    userAdmin: null
  };

  const ensureBackupToolsInitialized = () => {
    if (lazyModuleState.backup) {
      return lazyModuleState.backup;
    }
    lazyModuleState.backup = import(/* webpackChunkName: "vendor-backup" */ '../modules/backup.js')
      .then(({ initBackupButtons }) => {
        initBackupButtons({ fetchJson });
        return true;
      })
      .catch((error) => {
        console.error('[admin] Backup-Modul konnte nicht geladen werden', error);
        lazyModuleState.backup = null;
        throw error;
      });
    return lazyModuleState.backup;
  };

  const ensureCleanupToolsInitialized = () => {
    if (lazyModuleState.cleanup) {
      return lazyModuleState.cleanup;
    }
    lazyModuleState.cleanup = import(/* webpackChunkName: "vendor-backup" */ '../modules/system_cleanup.js')
      .then(({ initCleanupInSystem }) => {
        initCleanupInSystem({ fetchJson });
        return true;
      })
      .catch((error) => {
        console.error('[admin] Systembereinigung konnte nicht geladen werden', error);
        lazyModuleState.cleanup = null;
        throw error;
      });
    return lazyModuleState.cleanup;
  };

  const ensureUserAdminInitialized = () => {
    if (lazyModuleState.userAdmin) {
      return lazyModuleState.userAdmin;
    }
    lazyModuleState.userAdmin = import(/* webpackChunkName: "vendor-users" */ '../modules/user_admin.js')
      .then(({ initUserAdmin }) => initUserAdmin({
        hasPermission,
        fetchUserAccounts,
        saveUserAccount,
        deleteUserAccount,
        authRoles,
        getAvailablePermissions,
        setAvailablePermissions: (permissions) => {
          setAvailablePermissions(mergeAvailablePermissions(permissions));
        }
      }))
      .catch((error) => {
        console.error('[admin] Benutzerverwaltung konnte nicht geladen werden', error);
        lazyModuleState.userAdmin = null;
        throw error;
      });
    return lazyModuleState.userAdmin;
  };

  const setupLazySystemTools = () => {
    if (!hasPermission('system')) {
      return;
    }
    const systemSection = document.getElementById('btnExport')?.closest('details');
    const exportButton = document.getElementById('btnExport');
    const importField = document.getElementById('importFile');
    const cleanupButton = document.getElementById('btnCleanupSys');

    const primeSystemTools = () => {
      ensureBackupToolsInitialized().catch(() => {});
      ensureCleanupToolsInitialized().catch(() => {});
    };

    if (systemSection) {
      if (systemSection.open) {
        primeSystemTools();
      } else {
        const handleToggle = () => {
          if (systemSection.open) {
            systemSection.removeEventListener('toggle', handleToggle);
            primeSystemTools();
          }
        };
        systemSection.addEventListener('toggle', handleToggle);
      }
    }

    [exportButton, importField, cleanupButton].forEach((element) => {
      if (!element) return;
      const warmup = () => {
        primeSystemTools();
        element.removeEventListener('pointerenter', warmup);
        element.removeEventListener('focus', warmup);
      };
      element.addEventListener('pointerenter', warmup);
      element.addEventListener('focus', warmup);
    });
  };

  const setupLazyUserAdmin = () => {
    if (!hasPermission('user-admin')) {
      return;
    }
    const btnUsers = document.getElementById('btnUsers');
    if (!btnUsers) {
      return;
    }

    const warmup = () => {
      ensureUserAdminInitialized().catch(() => {});
      btnUsers.removeEventListener('pointerenter', warmup);
      btnUsers.removeEventListener('focus', warmup);
    };

    btnUsers.addEventListener('pointerenter', warmup);
    btnUsers.addEventListener('focus', warmup);

    const handleClick = async (event) => {
      event.preventDefault();
      try {
        const controller = await ensureUserAdminInitialized();
        if (controller && typeof controller.handleOpen === 'function') {
          btnUsers.removeEventListener('click', handleClick);
          await controller.handleOpen();
        }
      } catch (error) {
        console.error('[admin] Benutzerverwaltung konnte nicht initialisiert werden', error);
      }
    };

    btnUsers.addEventListener('click', handleClick);
  };

  return {
    ensureBackupToolsInitialized,
    ensureCleanupToolsInitialized,
    ensureUserAdminInitialized,
    setupLazyAdminModules: () => {
      setupLazySystemTools();
      setupLazyUserAdmin();
    }
  };
}
