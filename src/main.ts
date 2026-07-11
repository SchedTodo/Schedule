import { bootstrapApplication } from './app/bootstrap'
import { createInMemoryGateway } from './platform/browser/in-memory-gateway'

bootstrapApplication(createInMemoryGateway()).mount('#app')
