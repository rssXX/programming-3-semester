// ЛР4: отдельная точка входа второго HTTP-сервиса в том же репозитории.
import { createService2App } from './service2-app'

const app = createService2App().listen(8084)

console.log(`Service 2 running at http://${app.server?.hostname}:${app.server?.port}`)
