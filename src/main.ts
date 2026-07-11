import { bootstrapApplication } from './app/bootstrap'
import { createInMemoryGateway } from './platform/browser/in-memory-gateway'
import { createHostGateway } from './platform/host/host-gateway'

const host = Reflect.get(globalThis, 'scheduleHost') as unknown
const gateway = host === undefined ? createInMemoryGateway() : createHostGateway(host)

bootstrapApplication(gateway).mount('#app')
