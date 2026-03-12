import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserPermissions, hasPermission, type Permission } from '@/utils/permissions';

/** Check if the current user has a specific permission. */
export function usePermission(permission: Permission): boolean {
  const { user } = useAuth();
  return useMemo(
    () => hasPermission(user?.roles ?? [], permission),
    [user?.roles, permission],
  );
}

/** Returns a helper object to check multiple permissions. */
export function usePermissions() {
  const { user } = useAuth();
  const perms = useMemo(
    () => getUserPermissions(user?.roles ?? []),
    [user?.roles],
  );

  return useMemo(
    () => ({ has: (p: Permission) => perms.has(p) }),
    [perms],
  );
}
