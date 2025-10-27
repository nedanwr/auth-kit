import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");

dotenv.config({ path: path.join(rootDir, ".env.local") });

(async () => {
  const { db, projects, projectEnvironments } = await import("./src");

  console.log("🌱 Seeding database...");

  const platformProject = await db
    .insert(projects)
    .values({
      name: "auth-kit-platform",
      userId: "system",
    })
    .returning();

  console.log("✅ Platform project created:", platformProject[0].id);

  await db.insert(projectEnvironments).values([
    {
      projectId: platformProject[0].id,
      name: "development",
    },
    {
      projectId: platformProject[0].id,
      name: "production",
    },
  ]);

  console.log("✅ Environments created");
  console.log("Done!");
})().catch(console.error);
