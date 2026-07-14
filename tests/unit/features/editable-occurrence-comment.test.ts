import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import EditableOccurrenceComment from '../../../src/features/schedule/components/EditableOccurrenceComment.vue'

describe('EditableOccurrenceComment', () => {
  it('edits on double click and commits a changed value on blur', async () => {
    const wrapper = mount(EditableOccurrenceComment, { props: { value: 'Before' } })

    await wrapper.get('[data-comment-display]').trigger('dblclick')
    const input = wrapper.get('input')
    await input.setValue('After')
    await input.trigger('blur')

    expect(wrapper.emitted('commit')).toEqual([['After']])
  })

  it('does not commit an unchanged value', async () => {
    const wrapper = mount(EditableOccurrenceComment, { props: { value: 'Same' } })

    await wrapper.get('[data-comment-display]').trigger('dblclick')
    await wrapper.get('input').trigger('blur')

    expect(wrapper.emitted('commit')).toBeUndefined()
  })
})
