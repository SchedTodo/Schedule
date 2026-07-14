import { describe, expect, it } from 'vitest'

import { FixedClock } from '../../../src/domain/shared/clock'
import { createInMemoryGateway } from '../../../src/platform/browser/in-memory-gateway'

function gateway() {
  let sequence = 0
  return createInMemoryGateway([], {
    clock: new FixedClock('2026-07-11T08:00:00Z'),
    idGenerator: { next: () => `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` }
  })
}

async function createEvent() {
  const value = gateway()
  const created = await value.schedules.create({
    title: 'Review', recurrenceCode: '2026/7/13 10:00-11:00;', exclusionCode: '', comment: ''
  })
  if (!created.ok) throw new Error(created.error.message)
  return { gateway: value, schedule: created.value }
}

describe('in-memory schedule management', () => {
  it('updates fields while preserving the schedule kind', async () => {
    const { gateway, schedule } = await createEvent()
    const updated = await gateway.schedules.update({
      id: schedule.id,
      title: 'Updated',
      recurrenceCode: '2026/7/14 10:00-11:00;',
      exclusionCode: '',
      comment: 'Changed'
    })
    expect(updated.ok && updated.value).toMatchObject({ title: 'Updated', kind: 'event' })
    await expect(gateway.schedules.update({
      id: schedule.id, title: 'Todo', recurrenceCode: '', exclusionCode: '', comment: ''
    })).resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } })
  })

  it('stars, soft deletes, restores, filters, and paginates schedules', async () => {
    const { gateway, schedule } = await createEvent()
    await gateway.schedules.setStarred({ id: schedule.id, starred: true })
    await gateway.schedules.setDeleted({ id: schedule.id, deleted: true })
    await expect(gateway.schedules.findById(schedule.id)).resolves.toEqual({
      ok: true,
      value: expect.objectContaining({ id: schedule.id, deleted: true })
    })
    const deleted = await gateway.schedules.searchPage({ deleted: true, page: 1, pageSize: 20, search: '' })
    expect(deleted.ok && deleted.value.total).toBe(1)
    await gateway.schedules.setDeleted({ id: schedule.id, deleted: false })
    const starred = await gateway.schedules.searchPage({ starred: true, deleted: false, page: 1, pageSize: 20, search: '' })
    expect(starred.ok && starred.value.items[0]).toMatchObject({ starred: true, deleted: false })
  })

  it('updates occurrence comments and excludes selected occurrences', async () => {
    const { gateway, schedule } = await createEvent()
    const listed = await gateway.occurrences.listVisibleBySchedule(schedule.id)
    if (!listed.ok) throw new Error(listed.error.message)
    const occurrence = listed.value[0]!
    const commented = await gateway.occurrences.updateComment(occurrence.id, 'Instance note')
    expect(commented.ok && commented.value.comment).toBe('Instance note')
    await expect(gateway.occurrences.excludeMany({ ids: [occurrence.id] })).resolves.toEqual({
      ok: true,
      value: undefined
    })
    await expect(gateway.occurrences.listVisibleBySchedule(schedule.id)).resolves.toEqual({ ok: true, value: [] })
    await gateway.schedules.update({
      id: schedule.id,
      title: schedule.title,
      recurrenceCode: schedule.recurrenceCode,
      exclusionCode: '',
      comment: schedule.comment
    })
    await expect(gateway.occurrences.listVisibleBySchedule(schedule.id)).resolves.toEqual({
      ok: true,
      value: [expect.objectContaining({ id: occurrence.id, comment: 'Instance note' })]
    })
  })
})
