import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  // On Vercel serverless, root filesystem is read-only, so use writable /tmp directory
  if (process.env.VERCEL === "1") {
    return "file:/tmp/medtrack.db";
  }
  return "file:medtrack.db";
};

export const client = createClient({
  url: getDatabaseUrl(),
});

export const db = drizzle(client, { schema });
