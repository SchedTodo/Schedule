import { z } from 'zod'

export const AppErrorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'CONFLICT',
  'PERSISTENCE_FAILED',
  'PLATFORM_UNAVAILABLE',
  'INTERNAL_ERROR'
])

export const AppErrorDtoSchema = z
  .object({
    code: AppErrorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional()
  })
  .strict()

export type AppErrorCode = z.infer<typeof AppErrorCodeSchema>
export type AppErrorDto = z.infer<typeof AppErrorDtoSchema>

export type AppResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AppErrorDto }
