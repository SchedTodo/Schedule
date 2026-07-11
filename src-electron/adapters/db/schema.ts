import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const schedules = sqliteTable(
  'schedule',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['event', 'todo'] }).notNull(),
    title: text('title').notNull(),
    recurrenceCode: text('recurrence_code').notNull(),
    exclusionCode: text('exclusion_code').notNull().default(''),
    comment: text('comment').notNull().default(''),
    starred: integer('starred', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (table) => [index('schedule_kind_updated_idx').on(table.kind, table.updatedAt)]
)

export const databaseSchema = { schedules }

export type ScheduleRow = typeof schedules.$inferSelect
export type NewScheduleRow = typeof schedules.$inferInsert
