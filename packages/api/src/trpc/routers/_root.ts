import { router } from "..";
import { platformAuthRouter } from "./platformAuth";
import { projectsRouter } from "./projects";
import { tenantAuthRouter } from "./tenantAuth";

export const appRouter = router({
  platformAuth: platformAuthRouter,
  projects: projectsRouter,
  tenantAuth: tenantAuthRouter,
});

export type AppRouter = typeof appRouter;
