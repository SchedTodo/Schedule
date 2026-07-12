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

export const scheduleOccurrences = sqliteTable(
  'schedule_occurrence',
  {
    id: text('id').primaryKey(),
    scheduleId: text('schedule_id').notNull().references(() => schedules.id),
    excluded: integer('excluded', { mode: 'boolean' }).notNull().default(false),
    start: integer('start', { mode: 'timestamp_ms' }),
    end: integer('end', { mode: 'timestamp_ms' }).notNull(),
    startMark: text('start_mark', { enum: ['00', '01', '10', '11'] }).notNull(),
    endMark: text('end_mark', { enum: ['00', '01', '10', '11'] }).notNull(),
    comment: text('comment').notNull().default(''),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (table) => [
    index('occurrence_start_end_idx').on(table.start, table.end),
    index('occurrence_schedule_deleted_idx').on(table.scheduleId, table.deletedAt)
  ]
)

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})

export const concentrationRecords = sqliteTable('concentration_record', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id').notNull().references(() => schedules.id),
  start: integer('start', { mode: 'timestamp_ms' }).notNull(),
  end: integer('end', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' })
}, (table) => [index('record_schedule_start_idx').on(table.scheduleId, table.start)])

export const databaseSchema = { schedules, scheduleOccurrences, appSettings, concentrationRecords }

export type ScheduleRow = typeof schedules.$inferSelect
export type NewScheduleRow = typeof schedules.$inferInsert
export type ScheduleOccurrenceRow = typeof scheduleOccurrences.$inferSelect
