import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Leniwa inicjalizacja klienta DB.
// neon() czyta DATABASE_URL dopiero przy PIERWSZYM zapytaniu (runtime), NIE przy
// imporcie modułu. Dzięki temu `next build` (kolekcja danych tras API) nie wywala się,
// gdy DATABASE_URL nie jest ustawione w środowisku builda.
function makeDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL nie jest ustawione (wymagane w runtime).');
  }
  return drizzle(neon(url), { schema });
}

let _db: ReturnType<typeof makeDb> | null = null;

export const db = new Proxy({} as ReturnType<typeof makeDb>, {
  get(_target, prop, receiver) {
    if (!_db) _db = makeDb();
    const value = Reflect.get(_db as object, prop, receiver);
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(_db) : value;
  },
});
