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
  slideshows: 'module-slideshow',
  slides: 'module-slideshow',
  'slides-flow': 'slideshow-display',
  'slides-automation': 'slideshow-automation',
  media: 'content-media',
  footnotes: 'content-footnotes',
  badges: 'content-badges',
  info: 'content-global',
  'global-info': 'content-global',
  colors: 'design-colors',
  system: 'module-system',
  users: 'user-admin',
  design: 'module-design',
  content: 'module-content'
};

export const PERMISSION_META = {
  cockpit: {
    title: 'Cockpit & Übersicht',
    description: 'Zugriff auf die Übersichtskacheln und Schnellaktionen.'
  },
  'module-content': {
    title: 'Modul: Inhalt',
    description: 'Saunen, Fußnoten, Zusatzinfos und Medien im Inhaltsbereich anzeigen.'
  },
  'content-saunas': {
    title: 'Saunen & Übersicht',
    description: 'Aufgusszeiten, Sauna-Liste und Inventar pflegen.'
  },
  'content-footnotes': {
    title: 'Fußnoten',
    description: 'Fußnoten verwalten und Darstellung festlegen.'
  },
  'content-badges': {
    title: 'Badges',
    description: 'Badge-Bibliothek mit Icons und Labels pflegen.'
  },
  'content-global': {
    title: 'Globale Zusatzinfos',
    description: 'Info-Module, Wellness-Tipps und Stories bearbeiten.'
  },
  'content-global-wellness': {
    title: 'Wellness-Tipps',
    description: 'Wellness-Einträge hinzufügen und sortieren.'
  },
  'content-global-events': {
    title: 'Event-Countdowns',
    description: 'Countdowns und Hero-Timeline konfigurieren.'
  },
  'content-global-modules': {
    title: 'Info-Module',
    description: 'Individuelle Informationsmodule verwalten.'
  },
  'content-global-stories': {
    title: 'Story-Slides',
    description: 'Story-Baukasten und Inhalte anpassen.'
  },
  'content-media': {
    title: 'Medien-Slides',
    description: 'Bilder- und Video-Slides verwalten.'
  },
  'module-slideshow': {
    title: 'Modul: Slideshow',
    description: 'Slideshow-Bereich mit Automation, Musik und Darstellung anzeigen.'
  },
  'slideshow-automation': {
    title: 'Automatisierung',
    description: 'Zeit- und Stil-Automationen verwalten.'
  },
  'slideshow-audio': {
    title: 'Hintergrundmusik',
    description: 'Musik-Presets und Wiedergabe konfigurieren.'
  },
  'slideshow-display': {
    title: 'Darstellung & Seiten',
    description: 'Layout, Seiten und Ablaufzeiten festlegen.'
  },
  'module-design': {
    title: 'Modul: Design-Editor',
    description: 'Design-Paletten, Typografie und Farben bearbeiten.'
  },
  'design-palettes': {
    title: 'Style-Paletten',
    description: 'Paletten anlegen, speichern und aktivieren.'
  },
  'design-typography': {
    title: 'Typografie & Layout',
    description: 'Schriftarten, Layout- und Komponenten-Einstellungen anpassen.'
  },
  'design-colors': {
    title: 'Farben & Zeitspalte',
    description: 'Farbpaletten und Zeitspaltenfarben konfigurieren.'
  },
  'module-system': {
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
  saunameister: ['cockpit', 'module-content', 'content-footnotes', 'content-badges'],
  editor: [
    'cockpit',
    'module-content',
    'content-saunas',
    'content-footnotes',
    'content-badges',
    'content-global',
    'content-global-wellness',
    'content-global-events',
    'content-global-modules',
    'content-global-stories',
    'content-media',
    'module-slideshow',
    'slideshow-automation',
    'slideshow-audio',
    'slideshow-display',
    'module-design',
    'design-palettes',
    'design-typography',
    'design-colors',
    'module-system',
    'devices'
  ],
  admin: Object.keys(PERMISSION_META)
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
  return set;
};
