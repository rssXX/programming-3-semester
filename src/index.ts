import { Elysia } from "elysia";
import { openapi } from '@elysia/openapi'
import { ROUTES_V1, ROUTES_V2 } from './routes'

const app = new Elysia()
  .use(openapi())
  .listen(8082);

app.group('/api/v1', (group) => group.use(ROUTES_V1))
app.group('/api/v2', (group) => group.use(ROUTES_V2))

console.log(
  `running at http://${app.server?.hostname}:${app.server?.port}`
);
