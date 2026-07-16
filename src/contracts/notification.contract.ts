import { z } from 'zod'

export const NotificationInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(1000)
}).strict()

export type NotificationInput = z.infer<typeof NotificationInputSchema>
