import { createPinia } from 'pinia'
import { createApp, type App as VueApp } from 'vue'

import App from '../App.vue'
import type { PlatformGateway } from '../contracts/platform.contract'
import type { DesktopWidgetPort } from '../platform/desktop-widget'
import router from '../router'
import { desktopWidgetKey, platformGatewayKey } from './injection-keys'
import { createScheduleI18n } from '../i18n'
import { usePreferencesStore } from '../stores/preferences'
import '../assets/styles/main.css'

/** 创建 Vue 应用并安装平台网关、Pinia 与路由。 */
export function bootstrapApplication(
  gateway: PlatformGateway,
  desktopWidget?: DesktopWidgetPort
): VueApp<Element> {
  const pinia = createPinia()
  const preferences = usePreferencesStore(pinia)
  preferences.hydrate()
  const i18n = createScheduleI18n(preferences.locale)
  desktopWidget?.onOpenSchedule((scheduleId) => {
    void router.push({ name: 'schedule-detail', params: { id: scheduleId } })
  })
  return createApp(App)
    .provide(platformGatewayKey, gateway)
    .provide(desktopWidgetKey, desktopWidget)
    .use(pinia)
    .use(i18n)
    .use(router)
}
