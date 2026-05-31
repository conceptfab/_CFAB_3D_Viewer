// lib/scenes/access.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SceneRecord } from '@/lib/scenes/repo';
import type { User } from '@/lib/auth/types';

// Mock DB — wstrzykiwany przez dependency injection w access.ts
import type { AccessDeps } from './access';

const mockScene = (ownerId: string): SceneRecord => ({
  id: 'scene-1',
  ownerId,
  title: 'Test',
  config: {} as any,
  modelBlobUrl: null,
  modelFileName: null,
  thumbBlobUrl: null,
  isPreset: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockUser = (id: string): User => ({
  id,
  email: `${id}@test.com`,
  role: 'user',
  status: 'allowed',
  createdAt: new Date(),
  lastLoginAt: null,
  invitedBy: null,
});

const makeDeps = (
  permExists: boolean,
  tokenActive: boolean,
): AccessDeps => ({
  findPermission: vi.fn().mockResolvedValue(permExists ? { canEdit: false } : null),
  findActiveShareLink: vi.fn().mockResolvedValue(tokenActive ? { id: 'link-1' } : null),
});

describe('canView', () => {
  it('owner może zawsze oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(false, false);
    const result = await canView(mockScene('user-a'), mockUser('user-a'), undefined, deps);
    expect(result).toBe(true);
    expect(deps.findPermission).not.toHaveBeenCalled();
  });

  it('user z uprawnieniem może oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(true, false);
    const result = await canView(mockScene('owner'), mockUser('user-b'), undefined, deps);
    expect(result).toBe(true);
    expect(deps.findPermission).toHaveBeenCalledWith('scene-1', 'user-b');
  });

  it('user bez uprawnień nie może oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(false, false);
    const result = await canView(mockScene('owner'), mockUser('user-b'), undefined, deps);
    expect(result).toBe(false);
  });

  it('null user z aktywnym tokenem może oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(false, true);
    const result = await canView(mockScene('owner'), null, 'valid-token', deps);
    expect(result).toBe(true);
    expect(deps.findActiveShareLink).toHaveBeenCalledWith('scene-1', 'valid-token');
  });

  it('null user bez tokenu nie może oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(false, false);
    const result = await canView(mockScene('owner'), null, undefined, deps);
    expect(result).toBe(false);
  });

  it('null user z nieaktywnym tokenem nie może oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(false, false); // findActiveShareLink zwraca null
    const result = await canView(mockScene('owner'), null, 'revoked-token', deps);
    expect(result).toBe(false);
  });

  it('zalogowany user z aktywnym tokenem (brak perma) może oglądać', async () => {
    const { canView } = await import('./access');
    const deps = makeDeps(false, true);
    const result = await canView(mockScene('owner'), mockUser('user-c'), 'valid-token', deps);
    expect(result).toBe(true);
  });
});

describe('assertCanEdit', () => {
  it('owner może edytować', async () => {
    const { assertCanEdit } = await import('./access');
    const deps = makeDeps(false, false);
    await expect(assertCanEdit(mockScene('user-a'), mockUser('user-a'), deps)).resolves.toBeUndefined();
  });

  it('user z can_edit=true może edytować', async () => {
    const { assertCanEdit } = await import('./access');
    const deps: AccessDeps = {
      findPermission: vi.fn().mockResolvedValue({ canEdit: true }),
      findActiveShareLink: vi.fn(),
    };
    await expect(assertCanEdit(mockScene('owner'), mockUser('editor'), deps)).resolves.toBeUndefined();
  });

  it('user z can_edit=false nie może edytować — rzuca 403', async () => {
    const { assertCanEdit } = await import('./access');
    const deps: AccessDeps = {
      findPermission: vi.fn().mockResolvedValue({ canEdit: false }),
      findActiveShareLink: vi.fn(),
    };
    await expect(assertCanEdit(mockScene('owner'), mockUser('viewer'), deps)).rejects.toThrow('403');
  });

  it('user bez uprawnień nie może edytować — rzuca 403', async () => {
    const { assertCanEdit } = await import('./access');
    const deps = makeDeps(false, false);
    await expect(assertCanEdit(mockScene('owner'), mockUser('stranger'), deps)).rejects.toThrow('403');
  });
});
