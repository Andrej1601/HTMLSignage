// /admin/js/core/permissions.js
// =============================================================================
// Gemeinsame Helfer für Rollen- und Berechtigungslogik des Admin-Frontends
// =============================================================================

'use strict';

export const ROLE_ALIASES = {
  viewer: 'saunameister'
};

export const PROTECTED_ADMIN_USERNAME = 'admin';

export const ROLE_META = {
  saunameister: {
    title: 'Saunameister',
    description: 'Darf den Aufgussplan pflegen sowie Vorschau, Saunen, Fußnoten und Badges verwalten.'
  },
  editor: {
    title: 'Editor',
    description: 'Darf Inhalte bearbeiten und Geräteaktionen ausführen.'
  },
  admin: {
    title: 'Admin',
    description: 'Voller Zugriff inklusive Benutzer- und Rollenkonfiguration.'
  }
};

export const PERMISSION_ALIASES = {
  overview: 'cockpit',
  slideshows: 'slides',
  info: 'global-info',
  users: 'user-admin'
};

export const PERMISSION_META = {
  cockpit: {
    title: 'Cockpit & Übersicht',
    description: 'Zugriff auf die Übersichtskacheln und Schnellaktionen.'
  },
  slides: {
    title: 'Slideshow & Layout',
    description: 'Allgemeine Slideshow-Einstellungen und Layout anpassen.'
  },
  'slides-flow': {
    title: 'Ablauf & Zeiten',
    description: 'Dauer, Übergänge und Wiedergabe-Verhalten konfigurieren.'
  },
  'slides-automation': {
    title: 'Automationen',
    description: 'Zeit- und Stil-Automationen verwalten.'
  },
  media: {
    title: 'Medien',
    description: 'Medien-Slides hinzufügen, sortieren und konfigurieren.'
  },
  footnotes: {
    title: 'Fußnoten',
    description: 'Fußnoten verwalten und Darstellung festlegen.'
  },
  badges: {
    title: 'Badges',
    description: 'Badge-Bibliothek mit Icons und Labels pflegen.'
  },
  'global-info': {
    title: 'Infobox',
    description: 'Globale Informationen und Hinweise pflegen.'
  },
  colors: {
    title: 'Farben & Layout',
    description: 'Farbpaletten, Schriftvarianten und Layout-Einstellungen anpassen.'
  },
  system: {
    title: 'System & Wartung',
    description: 'Daten importieren/exportieren und Aufräumaktionen ausführen.'
  },
  devices: {
    title: 'Geräteverwaltung',
    description: 'Geräte koppeln, Vorschauen öffnen und Aktionen auslösen.'
  },
  'user-admin': {
    title: 'Benutzerverwaltung',
    description: 'Konten anlegen, Rechte vergeben und Passwörter setzen.'
  }
};

export const ROLE_DEFAULT_PERMISSIONS = {
  saunameister: ['cockpit', 'footnotes', 'badges'],
  editor: ['cockpit', 'slides', 'slides-flow', 'slides-automation', 'media', 'footnotes', 'badges', 'global-info', 'colors', 'system', 'devices'],
  admin: ['cockpit', 'slides', 'slides-flow', 'slides-automation', 'media', 'footnotes', 'badges', 'global-info', 'colors', 'system', 'devices', 'user-admin']
};

export const normalizeRoleName = (role) => {
  const name = String(role || '').toLowerCase();
  return ROLE_ALIASES[name] || name;
};

export const normalizePermissionName = (permission) => {
  const key = String(permission || '').toLowerCase();
  return PERMISSION_ALIASES[key] || key;
};

export const resolvePermissionsForRoles = (roles = []) => {
  const selection = new Set();
  const normalizedRoles = Array.isArray(roles) ? roles.map((role) => normalizeRoleName(role)).filter((role) => role) : [];
  normalizedRoles.forEach((role) => {
    const defaults = ROLE_DEFAULT_PERMISSIONS[role] || [];
    defaults.forEach((permission) => {
      const permissionName = normalizePermissionName(permission);
      if (permissionName) {
        selection.add(permissionName);
      }
    });
  });
  if (selection.size === 0) {
    ROLE_DEFAULT_PERMISSIONS.saunameister.forEach((permission) => {
      const permissionName = normalizePermissionName(permission);
      if (permissionName) selection.add(permissionName);
    });
  }
  return Array.from(selection);
};

export const mergeAvailablePermissions = (source = []) => {
  const result = new Set();
  Object.keys(PERMISSION_META).forEach((permission) => {
    const name = normalizePermissionName(permission);
    if (name) result.add(name);
  });
  if (Array.isArray(source)) {
    source.forEach((permission) => {
      const name = normalizePermissionName(permission);
      if (name) result.add(name);
    });
  }
  return Array.from(result);
};

export const createPermissionSet = (permissions = []) => {
  const set = new Set();
  if (Array.isArray(permissions)) {
    permissions.forEach((permission) => {
      const name = normalizePermissionName(permission);
      if (name) set.add(name);
    });
  }
  if (set.has('slides')) {
    ['slides-flow', 'slides-automation', 'media', 'footnotes', 'badges'].forEach((permission) => {
      set.add(permission);
    });
  } else if (set.has('slides-flow') && !set.has('slides-automation')) {
    set.add('slides-automation');
  }
  return set;
};
