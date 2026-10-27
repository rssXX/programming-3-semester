import { Elysia } from "elysia";

const app = new Elysia().listen(3000);

console.log(
  `running at http://${app.server?.hostname}:${app.server?.port}`
);
