import type { InjectionKey } from 'vue'

import type { PlatformGateway } from '../contracts/platform.contract'

export const platformGatewayKey: InjectionKey<PlatformGateway> = Symbol('platformGateway')
