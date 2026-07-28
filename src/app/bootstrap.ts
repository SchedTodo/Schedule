import { createPinia } from 'pinia'
import { createApp, type App as VueApp } from 'vue'

import App from '../App.vue'
import type { PlatformGateway } from '../contracts/platform.contract'
import router from '../router'
import { platformGatewayKey } from './injection-keys'
import { createScheduleI18n } from '../i18n'
import { usePreferencesStore } from '../stores/preferences'
import '../assets/styles/main.css'

/** 创建 Vue 应用并安装平台网关、Pinia 与路由。 */
export function bootstrapApplication(gateway: PlatformGateway): VueApp<Element> {
  const pinia = createPinia()
  const preferences = usePreferencesStore(pinia)
  preferences.hydrate()
  const i18n = createScheduleI18n(preferences.locale)
  return createApp(App)
    .provide(platformGatewayKey, gateway)
    .use(pinia)
    .use(i18n)
    .use(router)
}
