import { mount } from '@vue/test-utils'
import { NDataTable, NSelect } from 'naive-ui'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { platformGatewayKey } from '../../../src/app/injection-keys'
import type { ScheduleDto } from '../../../src/contracts/schedule.contract'
import DatabasePage from '../../../src/pages/database.vue'
import { createInMemoryGateway } from '../../../src/platform/browser/in-memory-gateway'

const active: ScheduleDto = {
  id: '10000000-0000-4000-8000-000000000001',
  kind: 'event',
  title: 'Active',
  recurrenceCode: '2026/7/13 10:00-11:00;',
  exclusionCode: '',
  comment: '',
  starred: false,
  createdAt: '2026-07-11T08:00:00Z',
  updatedAt: '2026-07-11T08:00:00Z'
}
const deleted: ScheduleDto = {
  ...active,
  id: '10000000-0000-4000-8000-000000000002',
  title: 'Archived review'
}

async function mountDatabase() {
  const platform = createInMemoryGateway([active, deleted])
  await platform.schedules.setDeleted({ id: deleted.id, deleted: true })
  const searchPage = vi.spyOn(platform.schedules, 'searchPage')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/database', name: 'database', component: DatabasePage },
      { path: '/schedule/:id', name: 'schedule-detail', component: { template: '<div />' } }
    ]
  })
  await router.push('/database')
  const wrapper = mount(DatabasePage, {
    global: {
      plugins: [router],
      provide: { [platformGatewayKey as symbol]: platform }
    }
  })
  await vi.waitFor(() => expect(wrapper.text()).toContain('Active'))
  await vi.waitFor(() => expect(wrapper.text()).toContain('Archived review'))
  return { platform, router, searchPage, wrapper }
}

describe('Database page', () => {
  it('uses the legacy filters and toggles the starred-only query', async () => {
    const { searchPage, wrapper } = await mountDatabase()
    expect(wrapper.findAllComponents(NSelect).filter(
      (select) => select.props('placeholder') === 'Type'
    )).toHaveLength(1)
    expect(wrapper.find('[aria-label="Deleted filter"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Star filter"]').exists()).toBe(false)
    expect(searchPage.mock.calls[0]?.[0]).not.toHaveProperty('deleted')

    const pagination = wrapper.getComponent(NDataTable).props('pagination') as {
      onChange: (page: number) => void
    }
    pagination.onChange(2)
    await vi.waitFor(() => {
      expect(searchPage.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2, pageSize: 10 })
    })
    await wrapper.get('.database-star-filter').trigger('click')
    await vi.waitFor(() => {
      expect(searchPage.mock.calls.at(-1)?.[0]).toMatchObject({
        page: 1,
        pageSize: 10,
        starred: true
      })
    })
    expect(searchPage.mock.calls.at(-1)?.[0]).not.toHaveProperty('deleted')
  })

  it('restores a deleted row from the Deleted cell without navigating', async () => {
    const { platform, router, wrapper } = await mountDatabase()
    const deletedRow = wrapper.findAll('tbody tr').find((row) => row.text().includes('Archived review'))
    if (!deletedRow) throw new Error('Deleted row was not rendered')
    const cells = deletedRow.findAll('td')
    expect(cells[2]?.classes()).toContain('database-deleted-cell')
    expect(cells[2]?.find('.database-restore').exists()).toBe(true)
    expect(cells[6]?.find('.database-restore').exists()).toBe(false)

    await cells[2]!.get('.database-restore').trigger('click')
    await vi.waitFor(async () => {
      await expect(platform.schedules.findById(deleted.id)).resolves.toMatchObject({
        ok: true,
        value: { deleted: false }
      })
    })
    expect(router.currentRoute.value.name).toBe('database')
  })

  it('uses remote pagination and resets the page when page size changes', async () => {
    const { searchPage, wrapper } = await mountDatabase()
    const table = wrapper.getComponent(NDataTable)
    const pagination = table.props('pagination') as {
      page: number
      pageSize: number
      itemCount: number
      showSizePicker: boolean
      pageSizes: number[]
      onChange: (page: number) => void
      onUpdatePageSize: (pageSize: number) => void
    }

    expect(table.props('remote')).toBe(true)
    expect(pagination).toMatchObject({
      page: 1,
      pageSize: 10,
      itemCount: 2,
      showSizePicker: true,
      pageSizes: [5, 10, 15, 20]
    })
    expect(searchPage.mock.calls[0]?.[0]).toMatchObject({ page: 1, pageSize: 10 })

    pagination.onChange(2)
    await vi.waitFor(() => {
      expect(searchPage.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2, pageSize: 10 })
    })

    ;(wrapper.getComponent(NDataTable).props('pagination') as typeof pagination)
      .onUpdatePageSize(5)
    await vi.waitFor(() => {
      expect(searchPage.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1, pageSize: 5 })
    })
  })
})
