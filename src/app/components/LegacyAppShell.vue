<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { NAvatar, NLayout, NLayoutContent, NLayoutFooter, NLayoutHeader } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'

import IdeaPane from '../../features/ideas/IdeaPane.vue'

const route = useRoute()
const router = useRouter()
const navigation = [
  { label: 'Home', path: '/' },
  { label: 'Database', path: '/database' },
  { label: 'Settings', path: '/settings' },
  { label: 'Help', path: '/help' }
]
const activePath = computed(() => {
  if (route.path.startsWith('/schedule/')) return '/'
  return navigation.some(({ path }) => path === route.path) ? route.path : '/'
})

function handleKeyboard(event: KeyboardEvent) {
  if (!event.ctrlKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  const current = navigation.findIndex(({ path }) => path === activePath.value)
  const direction = event.key === 'ArrowRight' ? 1 : -1
  const next = (current + direction + navigation.length) % navigation.length
  void router.push(navigation[next]?.path ?? '/')
}

onMounted(() => window.addEventListener('keydown', handleKeyboard))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeyboard))
</script>

<template>
  <NLayout
    class="legacy-shell"
    position="absolute"
  >
    <NLayoutHeader
      class="legacy-header"
      bordered
    >
      <nav aria-label="Main navigation">
        <RouterLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          :class="['legacy-nav-item', { active: activePath === item.path }]"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="guest-identity">
        <NAvatar
          round
          size="small"
        >
          G
        </NAvatar>
        <span>Guest</span>
      </div>
    </NLayoutHeader>

    <NLayoutContent
      class="legacy-content"
      :native-scrollbar="false"
    >
      <RouterView />
    </NLayoutContent>

    <NLayoutFooter
      class="legacy-footer"
      bordered
    >
      © 2023
    </NLayoutFooter>
  </NLayout>
  <IdeaPane />
</template>
