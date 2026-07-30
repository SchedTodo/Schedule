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
      path: '/widget',
      name: 'widget',
      meta: { standalone: true },
      component: () => import('./pages/widget.vue')
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
    },
    {
      path: '/concentrate/:timeId',
      name: 'concentrate',
      component: () => import('./pages/concentrate/[timeId].vue')
    },
    {
      path: '/database',
      name: 'database',
      component: () => import('./pages/database.vue')
    },
    {
      path: '/help',
      name: 'help',
      component: () => import('./pages/help.vue')
    }
  ]
})

export default router
