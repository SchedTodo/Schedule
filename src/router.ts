import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./pages/index.vue')
    },
    {
      path: '/schedule/:id',
      name: 'schedule-detail',
      component: () => import('./pages/schedule/[id].vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./pages/settings.vue')
    }
  ]
})

export default router
