// ─── Permission Keys ────────────────────────────────────────────────────────
// Mirror of packages/backend/src/lib/permissions.ts — keep in sync.

export type Permission =
  | 'dashboard:read'
  | 'schedule:write'
  | 'saunas:read'
  | 'saunas:status'
  | 'saunas:manage'
  | 'slideshow:manage'
  | 'media:manage'
  | 'devices:manage'
  | 'settings:manage'
  | 'users:manage'
  | 'system:manage';

// ─── Role → Permissions Mapping ─────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'dashboard:read',
    'schedule:write',
    'saunas:read',
    'saunas:status',
    'saunas:manage',
    'slideshow:manage',
    'media:manage',
    'devices:manage',
    'settings:manage',
    'users:manage',
    'system:manage',
  ],
  editor: [
    'dashboard:read',
    'schedule:write',
    'saunas:read',
    'saunas:status',
    'saunas:manage',
    'slideshow:manage',
    'media:manage',
    'devices:manage',
    'settings:manage',
  ],
  saunameister: [
    'dashboard:read',
    'schedule:write',
    'saunas:read',
    'saunas:status',
  ],
  viewer: [
    'dashboard:read',
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getUserPermissions(roles: string[]): Set<Permission> {
  const perms = new Set<Permission>();
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role];
    if (rolePerms) {
      for (const p of rolePerms) perms.add(p);
    }
  }
  return perms;
}

export function hasPermission(roles: string[], permission: Permission): boolean {
  return getUserPermissions(roles).has(permission);
}

// ─── Role Metadata (for UI) ────────────────────────────────────────────────

export const AVAILABLE_ROLES = [
  { value: 'admin', label: 'Admin', description: 'Vollzugriff auf alle Funktionen' },
  { value: 'editor', label: 'Editor', description: 'Inhalte & Konfiguration bearbeiten (kein Benutzermanagement)' },
  { value: 'saunameister', label: 'Saunameister', description: 'Aufgüsse planen & Sauna-Status ändern' },
  { value: 'viewer', label: 'Betrachter', description: 'Nur Dashboard ansehen (kein Schreibzugriff)' },
] as const;
