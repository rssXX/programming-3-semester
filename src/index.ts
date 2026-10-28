import { createApp } from './app'

const app = createApp().listen(8082)

console.log(
  `running at http://${app.server?.hostname}:${app.server?.port}`
);
