// lib/scenes/schema.ts
import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from '@/lib/db/schema';

export const scenes = pgTable(
  'scenes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    config: jsonb('config').notNull(),
    modelBlobUrl: text('model_blob_url'),
    modelFileName: text('model_file_name'),
    thumbBlobUrl: text('thumb_blob_url'),
    isPreset: boolean('is_preset').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('scenes_owner_id_idx').on(t.ownerId),
    index('scenes_is_preset_idx').on(t.isPreset),
  ]
);
