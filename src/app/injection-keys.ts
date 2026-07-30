import type { InjectionKey } from 'vue'

import type { PlatformGateway } from '../contracts/platform.contract'
import type { DesktopWidgetPort } from '../platform/desktop-widget'

export const platformGatewayKey: InjectionKey<PlatformGateway> = Symbol('platformGateway')
export const desktopWidgetKey: InjectionKey<DesktopWidgetPort | undefined> =
  Symbol('desktopWidget')
