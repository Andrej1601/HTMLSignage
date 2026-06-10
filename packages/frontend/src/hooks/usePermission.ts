import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, type Permission } from '@/utils/permissions';

/** Check if the current user has a specific permission. */
export function usePermission(permission: Permission): boolean {
  const { user } = useAuth();
  return useMemo(
    () => hasPermission(user?.roles ?? [], permission),
    [user?.roles, permission],
  );
}
