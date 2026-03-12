import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';

// ─── Permission Keys ────────────────────────────────────────────────────────

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

// ─── Express Middleware ─────────────────────────────────────────────────────

export function requirePermission(permission: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'unauthorized', message: 'Nicht authentifiziert' });
      return;
    }

    if (!hasPermission(req.user.roles, permission)) {
      res.status(403).json({ error: 'forbidden', message: 'Keine Berechtigung' });
      return;
    }

    next();
  };
}

// ─── Role Metadata (for UI) ────────────────────────────────────────────────

export const AVAILABLE_ROLES = [
  { value: 'admin', label: 'Admin', description: 'Vollzugriff auf alle Funktionen' },
  { value: 'editor', label: 'Editor', description: 'Inhalte & Konfiguration bearbeiten (kein Benutzermanagement)' },
  { value: 'saunameister', label: 'Saunameister', description: 'Aufgüsse planen & Sauna-Status ändern' },
  { value: 'viewer', label: 'Betrachter', description: 'Nur Dashboard ansehen (kein Schreibzugriff)' },
] as const;
