import { z } from 'zod';

/** Normalizuje e-mail: lowercase + trim. Używany wszędzie gdzie przyjmujemy e-mail. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Schemat żądania kodu logowania. */
export const requestCodeSchema = z.object({
  email: z.string().email(),
});

/** Schemat weryfikacji kodu logowania: e-mail + dokładnie 6 cyfr. */
export const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Kod musi być 6-cyfrową liczbą'),
});

/** Schemat zaproszenia użytkownika przez admina. */
export const adminPostSchema = z.object({
  email: z.string().email(),
});

/** Schemat patcha użytkownika przez admina — wymagany co najmniej jeden z pól. */
export const adminPatchSchema = z
  .object({
    role: z.enum(['admin', 'user']).optional(),
    status: z.enum(['allowed', 'blocked']).optional(),
  })
  .refine((data) => data.role !== undefined || data.status !== undefined, {
    message: 'Wymagane co najmniej role lub status',
  });
