import { prisma } from './prisma.js';

export class UserConflictError extends Error {
  constructor(
    public readonly code: 'username-taken' | 'email-taken',
    message: string,
  ) {
    super(message);
    this.name = 'UserConflictError';
  }
}

/**
 * Asserts that the given username is not already taken.
 * Pass `excludeUserId` when updating an existing user to exclude their own record.
 */
export async function assertUsernameAvailable(username: string, excludeUserId?: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && existing.id !== excludeUserId) {
    throw new UserConflictError('username-taken', 'Username already exists');
  }
}

/**
 * Asserts that the given email is not already taken.
 * Pass `excludeUserId` when updating an existing user to exclude their own record.
 */
export async function assertEmailAvailable(email: string, excludeUserId?: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== excludeUserId) {
    throw new UserConflictError('email-taken', 'Email already exists');
  }
}
