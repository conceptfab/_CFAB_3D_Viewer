// lib/studio/schema.ts
import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from '@/lib/db/schema';

export const studioProjects = pgTable(
  'studio_projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    sourceBlobUrl: text('source_blob_url').notNull(),
    sourceFileName: text('source_file_name').notNull(),
    sourceKind: text('source_kind').notNull(), // 'glb' | 'gltf-zip'
    config: jsonb('config').notNull(),
    thumbBlobUrl: text('thumb_blob_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('studio_projects_owner_id_idx').on(t.ownerId)]
);
