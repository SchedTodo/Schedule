import { z } from 'zod'

export const CreateConcentrationRecordInputSchema = z.object({
  scheduleId: z.uuid(),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true })
}).strict().refine((value) => Date.parse(value.start) < Date.parse(value.end), {
  message: 'Record start must precede end', path: ['end']
})

export const ConcentrationRecordDtoSchema = CreateConcentrationRecordInputSchema.safeExtend({
  id: z.uuid()
})

export type CreateConcentrationRecordInput = z.infer<typeof CreateConcentrationRecordInputSchema>
export type ConcentrationRecordDto = z.infer<typeof ConcentrationRecordDtoSchema>
