'use client';
// components/scenes/renameScene.ts
// Klient: zmienia tytuł sceny przez PATCH /api/scenes/[id]. Backend waliduje
// długość (1–200) i uprawnienia (assertCanEdit). Zwraca przycięty (kanoniczny)
// tytuł — dokładnie ten, który zapisano.

export async function renameScene(sceneId: string, title: string): Promise<string> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Nazwa nie może być pusta.');

  const res = await fetch(`/api/scenes/${sceneId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: trimmed }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Błąd zmiany nazwy: ${res.status}`);
  }
  return trimmed;
}
