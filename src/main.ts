import { bootstrapApplication } from './app/bootstrap'
import { createInMemoryGateway } from './platform/browser/in-memory-gateway'
import { DesktopWidgetPortSchema } from './platform/desktop-widget'
import { createHostGateway } from './platform/host/host-gateway'

const host = Reflect.get(globalThis, 'scheduleHost') as unknown
const gateway = host === undefined ? createInMemoryGateway() : createHostGateway(host)
const desktopValue = Reflect.get(globalThis, 'scheduleDesktop') as unknown
const desktop = desktopValue === undefined
  ? undefined
  : DesktopWidgetPortSchema.parse(desktopValue)

bootstrapApplication(gateway, desktop).mount('#app')
