import { Elysia } from "elysia";
import { ROUTES_V1 } from './routes'

const app = new Elysia().listen(3000);

app.group('/api/v1', (group) => group.use(ROUTES_V1))

console.log(
  `running at http://${app.server?.hostname}:${app.server?.port}`
);
