// app/api/scenes/[id]/instantiate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { instantiatePreset } from '@/lib/scenes/repo';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  // 1. Autoryzacja — każdy zalogowany użytkownik może użyć presetu
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 });
  }

  const { id } = await ctx.params;

  // 2. Klonuj preset
  let newScene;
  try {
    newScene = await instantiatePreset(id, caller.id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Błąd klonowania';
    if (message === 'Preset nie istnieje') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === 'Scena nie jest presetem') {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    console.error('[instantiate] nieoczekiwany błąd:', err);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }

  return NextResponse.json(newScene, { status: 201 });
}
