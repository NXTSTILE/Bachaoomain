import "dotenv/config";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// Resolve local files from the project root, matching the runtime SQLite adapter.
// This config only describes the datasource; generation/build never query or migrate it.
const configuredUrl = process.env.DATABASE_URL;
const url = configuredUrl?.startsWith("file:")
  ? `file:${resolve(configuredUrl.slice(5))}`
  : configuredUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
