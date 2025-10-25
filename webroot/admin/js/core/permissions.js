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

const sanitizeCopy = (value) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s▶▸▹▾▿⮞⮟◂◃◄◅►▻•–-]+/, '')
    .replace(/[\s▶▸▹▾▿⮞⮟◂◃◄◅►▻•–-]+$/, '')
    .trim();
};

const readText = (selector) => {
  if (!selector) return '';
  const element = typeof selector === 'string' ? document.querySelector(selector) : null;
  return element ? sanitizeCopy(element.textContent || '') : '';
};

const resolveText = (definition, key) => {
  if (!definition) return '';
  const resolver = definition[`${key}Resolver`];
  if (typeof resolver === 'function') {
    const resolved = resolver();
    if (resolved) return sanitizeCopy(resolved);
  }
  const selector = definition[`${key}Selector`];
  if (selector) {
    const resolved = readText(selector);
    if (resolved) return resolved;
  }
  const fallback = definition.fallback && definition.fallback[key];
  return fallback ? sanitizeCopy(fallback) : '';
};

const PERMISSION_TREE_DEFINITION = [
  {
    key: 'cockpit',
    fallback: {
      title: 'Cockpit & Übersicht',
      description: 'Übersichtskacheln, Schnellaktionen und Status sehen.'
    }
  },
  {
    key: 'module-content',
    titleSelector: '#slidesMaster > summary .ttl',
    fallback: {
      title: 'Inhalte',
      description: 'Saunen, Hinweise, Zusatzinfos und Medien bearbeiten.'
    },
    children: [
      {
        key: 'content-saunas',
        titleSelector: '#boxSaunas .layout-display-summary-title',
        descriptionSelector: '#boxSaunas .layout-display-summary-sub',
        fallback: {
          title: 'Saunen & Übersicht',
          description: 'Aufgusszeiten, Sauna-Liste und Inventar pflegen.'
        }
      },
      {
        key: 'content-footnotes',
        titleSelector: '#footnoteToggle',
        descriptionResolver: () =>
          document
            .getElementById('footnoteSection')
            ?.closest('.layout-display-fold')
            ?.querySelector('.layout-display-summary-sub')
            ?.textContent || '',
        fallback: {
          title: 'Fußnoten',
          description: 'Fußnoten verwalten und Darstellung festlegen.'
        }
      },
      {
        key: 'content-badges',
        titleSelector: '#badgeLibraryToggle',
        descriptionResolver: () =>
          document.querySelector('#badgeLibrarySection .help')?.textContent || '',
        fallback: {
          title: 'Badge-Bibliothek',
          description: 'Icons, Labels und Farben der Badges pflegen.'
        }
      },
      {
        key: 'content-global',
        titleSelector: '#boxStories .layout-display-summary-title',
        descriptionSelector: '#boxStories .layout-display-summary-sub',
        fallback: {
          title: 'Globale Zusatzinfos',
          description: 'Wellness-Tipps, Countdown und Story-Slides verwalten.'
        },
        children: [
          {
            key: 'content-global-wellness',
            titleSelector: '#infoWellness > summary',
            fallback: {
              title: 'Wellness-Tipps',
              description: 'Tipps hinzufügen und Reihenfolge sortieren.'
            }
          },
          {
            key: 'content-global-events',
            titleSelector: '#infoEvents > summary',
            fallback: {
              title: 'Event-Countdowns',
              description: 'Countdowns und Hero-Timeline konfigurieren.'
            }
          },
          {
            key: 'content-global-modules',
            titleSelector: '#infoModules > summary',
            fallback: {
              title: 'Info-Module',
              description: 'Individuelle Informationsmodule verwalten.'
            }
          },
          {
            key: 'content-global-stories',
            titleSelector: '#infoStories > summary',
            fallback: {
              title: 'Story-Slides',
              description: 'Story-Baukasten und Inhalte anpassen.'
            }
          }
        ]
      },
      {
        key: 'content-media',
        titleSelector: '#boxImages .layout-display-summary-title',
        descriptionSelector: '#boxImages .layout-display-summary-sub',
        fallback: {
          title: 'Medien-Slides',
          description: 'Bilder- und Video-Slides verwalten.'
        }
      }
    ]
  },
  {
    key: 'module-slideshow',
    titleSelector: '#boxSlidesText > summary .ttl',
    fallback: {
      title: 'Slideshow',
      description: 'Automationen, Musik und Ablauf der Slideshow steuern.'
    },
    children: [
      {
        key: 'slideshow-automation',
        titleSelector: '#slidesAutomationCard .layout-display-summary-title',
        descriptionSelector: '#slidesAutomationCard .layout-display-summary-sub',
        fallback: {
          title: 'Automatisierung',
          description: 'Zeit- und Stil-Automationen verwalten.'
        }
      },
      {
        key: 'slideshow-audio',
        titleSelector: '#backgroundAudioCard .layout-display-summary-title',
        descriptionSelector: '#backgroundAudioCard .layout-display-summary-sub',
        fallback: {
          title: 'Hintergrundmusik',
          description: 'Musik-Presets und Wiedergabe konfigurieren.'
        }
      },
      {
        key: 'slideshow-display',
        titleSelector: '#displayLayoutFold .layout-display-summary-title',
        descriptionSelector: '#displayLayoutFold .layout-display-summary-sub',
        fallback: {
          title: 'Darstellung & Seiten',
          description: 'Layout, Seiten und Ablaufzeiten festlegen.'
        }
      }
    ]
  },
  {
    key: 'module-design',
    titleSelector: '#designEditor > summary .ttl',
    fallback: {
      title: 'Design-Editor',
      description: 'Design-Paletten, Typografie und Farben bearbeiten.'
    },
    children: [
      {
        key: 'design-palettes',
        titleSelector: '#stylePaletteFold .layout-display-summary-title',
        descriptionSelector: '#stylePaletteFold .layout-display-summary-sub',
        fallback: {
          title: 'Style-Paletten',
          description: 'Paletten anlegen, speichern und aktivieren.'
        }
      },
      {
        key: 'design-typography',
        titleSelector: '#boxTypographyLayout .layout-display-summary-title',
        descriptionSelector: '#boxTypographyLayout .layout-display-summary-sub',
        fallback: {
          title: 'Typografie & Layout',
          description: 'Schriftarten, Layout- und Komponenten-Einstellungen anpassen.'
        }
      },
      {
        key: 'design-colors',
        titleResolver: () =>
          document
            .getElementById('resetColors')
            ?.closest('details')
            ?.querySelector('.layout-display-summary-title')
            ?.textContent || '',
        descriptionResolver: () =>
          document
            .getElementById('resetColors')
            ?.closest('details')
            ?.querySelector('.layout-display-summary-sub')
            ?.textContent || '',
        fallback: {
          title: 'Farben (Übersicht & Zeitspalte)',
          description: 'Farbschemata für Übersicht und Zeitspalte verwalten.'
        }
      }
    ]
  },
  {
    key: 'module-system',
    titleResolver: () =>
      document
        .getElementById('btnExport')
        ?.closest('details')
        ?.querySelector('summary .ttl, summary')
        ?.textContent || '',
    descriptionResolver: () =>
      document
        .getElementById('btnExport')
        ?.closest('details')
        ?.querySelector('.help')
        ?.textContent || '',
    fallback: {
      title: 'System & Wartung',
      description: 'Daten importieren/exportieren und Aufräumaktionen ausführen.'
    }
  },
  {
    key: 'devices',
    titleSelector: '#btnDevices',
    fallback: {
      title: 'Geräte',
      description: 'Geräte koppeln, Vorschauen öffnen und Aktionen auslösen.'
    }
  },
  {
    key: 'user-admin',
    titleSelector: '#userModalTitle',
    fallback: {
      title: 'Benutzerverwaltung',
      description: 'Konten anlegen, Rechte vergeben und Passwörter setzen.'
    }
  }
];

const collectPermissionKeys = (definition, list = []) => {
  definition.forEach((item) => {
    if (!item?.key) return;
    list.push(item.key);
    if (Array.isArray(item.children) && item.children.length) {
      collectPermissionKeys(item.children, list);
    }
  });
  return list;
};

const PERMISSION_KEYS = collectPermissionKeys(PERMISSION_TREE_DEFINITION).filter(Boolean);

let permissionTreeCache = null;
let permissionMetaCache = null;

const buildPermissionNode = (definition) => {
  if (!definition?.key) return null;
  const title = resolveText(definition, 'title');
  const description = resolveText(definition, 'description');
  const children = Array.isArray(definition.children)
    ? definition.children
        .map((child) => buildPermissionNode(child))
        .filter((child) => child !== null)
    : [];
  return {
    key: definition.key,
    title,
    description,
    children
  };
};

const freezePermissionNode = (node) => {
  if (!node) return;
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => freezePermissionNode(child));
    Object.freeze(node.children);
  }
  Object.freeze(node);
};

const buildPermissionTree = () =>
  PERMISSION_TREE_DEFINITION.map((definition) => buildPermissionNode(definition)).filter(Boolean);

const buildPermissionMeta = (nodes) => {
  const meta = {};
  const visit = (node) => {
    meta[node.key] = {
      title: node.title,
      description: node.description
    };
    node.children.forEach((child) => visit(child));
  };
  nodes.forEach((node) => visit(node));
  return Object.freeze(meta);
};

const ensurePermissionDataLoaded = () => {
  if (permissionTreeCache) return;
  permissionTreeCache = buildPermissionTree();
  permissionTreeCache.forEach((node) => freezePermissionNode(node));
  permissionMetaCache = buildPermissionMeta(permissionTreeCache);
};

const clonePermissionTree = (nodes) =>
  nodes.map((node) => ({
    key: node.key,
    title: node.title,
    description: node.description,
    children: node.children.length ? clonePermissionTree(node.children) : []
  }));

ensurePermissionDataLoaded();

export const PERMISSION_META = permissionMetaCache;

export const getPermissionTree = () => clonePermissionTree(permissionTreeCache);

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
  admin: PERMISSION_KEYS.slice()
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
