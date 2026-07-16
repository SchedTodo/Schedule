<script setup lang="ts">
import UserOutlined from '@vicons/antd/es/UserOutlined'
import HelpCircleOutline from '@vicons/ionicons5/es/HelpCircleOutline'
import HomeOutline from '@vicons/ionicons5/es/HomeOutline'
import SettingsOutline from '@vicons/ionicons5/es/SettingsOutline'
import Database from '@vicons/tabler/es/Database'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { NAvatar } from 'naive-ui/es/avatar'
import { NIcon } from 'naive-ui/es/icon'
import { NLayoutContent, NLayoutFooter, NLayoutHeader } from 'naive-ui/es/layout'
import { useRoute, useRouter } from 'vue-router'

import IdeaPane from '../../features/ideas/IdeaPane.vue'

const route = useRoute()
const router = useRouter()
const navigation = [
  { label: 'Home', path: '/', icon: HomeOutline },
  { label: 'Database', path: '/database', icon: Database },
  { label: 'Settings', path: '/settings', icon: SettingsOutline },
  { label: 'Help', path: '/help', icon: HelpCircleOutline }
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
  <div class="application-layout">
    <NLayoutHeader
      class="application-header"
      bordered
      :style="{
        backgroundColor: 'var(--color-navigation)',
        color: 'var(--color-navigation-text)'
      }"
    >
      <nav aria-label="Main navigation">
        <RouterLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          :class="['navigation-item', { active: activePath === item.path }]"
        >
          <NIcon
            class="navigation-icon"
            aria-hidden="true"
          >
            <component :is="item.icon" />
          </NIcon>
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="guest-identity">
        <NAvatar
          round
          size="small"
        >
          <NIcon><UserOutlined /></NIcon>
        </NAvatar>
        <span>Guest</span>
      </div>
    </NLayoutHeader>

    <NLayoutContent
      class="application-content"
      :native-scrollbar="true"
    >
      <RouterView />
    </NLayoutContent>

    <NLayoutFooter
      class="application-footer"
      bordered
      :style="{
        backgroundColor: 'var(--color-navigation)',
        color: 'var(--color-navigation-text)'
      }"
    >
      © 2023
    </NLayoutFooter>
  </div>
  <IdeaPane />
</template>
