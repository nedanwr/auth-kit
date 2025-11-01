import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import * as schema from "./schema";

const connectionStr = process.env.DATABASE_URL;

if (!connectionStr) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(connectionStr);

export const db = drizzle(sql, { schema });
export type Db = typeof db;
