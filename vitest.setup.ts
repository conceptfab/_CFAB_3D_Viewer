// Stub modules that require a live DB or Next.js runtime context.
// These are only needed for DB-touching functions (createSession, getCurrentUser, etc.)
// which are NOT tested in unit tests — pure functions are tested directly.
import { vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {},
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn() }),
}));
