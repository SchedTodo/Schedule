import { createPinia } from 'pinia'
import { createApp, type App as VueApp } from 'vue'

import App from '../App.vue'
import type { PlatformGateway } from '../contracts/platform.contract'
import router from '../router'
import { platformGatewayKey } from './injection-keys'
import '../assets/styles/main.css'

/** 创建 Vue 应用并安装平台网关、Pinia 与路由。 */
export function bootstrapApplication(gateway: PlatformGateway): VueApp<Element> {
  return createApp(App).provide(platformGatewayKey, gateway).use(createPinia()).use(router)
}
