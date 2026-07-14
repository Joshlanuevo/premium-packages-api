import "dotenv/config";
import { createApp } from "./app";

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`premium-packages-api listening on http://localhost:${port}`);
});
