import { pgTable, text, uuid, timestamp, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Tabela użytkowników (biała lista = status='allowed', czarna = status='blocked').
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').unique().notNull(),
  // 'admin' | 'user'
  role: text('role').notNull().default('user'),
  // 'allowed' | 'blocked'
  status: text('status').notNull().default('allowed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  invitedBy: uuid('invited_by').references((): any => users.id),
});

// Kody logowania jednorazowe (6 cyfr, 15 min, max 5 prób).
export const loginCodes = pgTable('login_codes', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// Sesje (token opaque w cookie, hash w DB).
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

export type UserRow = typeof users.$inferSelect;
export type LoginCodeRow = typeof loginCodes.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
