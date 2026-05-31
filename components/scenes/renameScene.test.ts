// components/scenes/renameScene.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renameScene } from './renameScene';

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('renameScene', () => {
  it('wysyła PATCH z przyciętym tytułem i zwraca kanoniczny tytuł', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await renameScene('scene-1', '  Nowa nazwa  ');

    expect(result).toBe('Nowa nazwa');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/scenes/scene-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ title: 'Nowa nazwa' });
  });

  it('rzuca przy pustej nazwie i NIE woła fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(renameScene('scene-1', '   ')).rejects.toThrow('Nazwa nie może być pusta.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rzuca komunikatem błędu z API gdy odpowiedź nie jest ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'Błąd walidacji' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(renameScene('scene-1', 'X')).rejects.toThrow('Błąd walidacji');
  });
});
