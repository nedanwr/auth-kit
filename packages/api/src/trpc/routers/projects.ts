import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { platformProcedure, router } from "..";
import {
  projectEnvironments,
  projects,
  projectSettings,
  projectUserLinks,
} from "../../db/schema";
import { generateEnvKeys } from "../../lib/keys";

export const projectsRouter = router({
  create: platformProcedure
    .input(
      z.object({
        name: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { name } = input;

      const [project] = await ctx.db
        .insert(projects)
        .values({
          name,
        })
        .returning();

      const keys = await generateEnvKeys("development");

      const [environment] = await ctx.db
        .insert(projectEnvironments)
        .values({
          projectId: project.id,
          type: "development",
          publishableKey: keys.publishableKey,
          secretKeyHash: keys.secretKeyHash,
        })
        .returning();

      await ctx.db.insert(projectSettings).values({
        projectId: project.id,
      });

      await ctx.db.insert(projectUserLinks).values({
        projectId: project.id,
        userId: ctx.userId,
      });

      return {
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
        },
        environment: {
          id: environment.id,
          type: environment.type,
          publishableKey: environment.publishableKey,
          secretKeyHash: environment.secretKeyHash,
        },
      };
    }),

  list: platformProcedure.query(async ({ ctx }) => {
    const links = await ctx.db.query.projectUserLinks.findMany({
      where: eq(projectUserLinks.userId, ctx.userId),
      with: {
        project: true,
      },
    });

    return links.map((link) => ({
      id: link.project.id,
      name: link.project.name,
      slug: link.project.slug,
    }));
  }),

  get: platformProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
        with: {
          environments: true,
          settings: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      return {
        ...project,
        environments: project.environments.map((environment) => ({
          id: environment.id,
          type: environment.type,
          publishableKey: environment.publishableKey,
          secretKeyHash: environment.secretKeyHash,
        })),
        settings: project.settings,
      };
    }),

  createEnvironment: platformProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // We don't check for development environments because
      // we only allow one per project and it's created by default
      const existing = await ctx.db.query.projectEnvironments.findFirst({
        where: and(
          eq(projectEnvironments.projectId, input.projectId),
          eq(projectEnvironments.type, "production")
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Production environment already exists",
        });
      }

      const keys = await generateEnvKeys("production");

      const [environment] = await ctx.db
        .insert(projectEnvironments)
        .values({
          projectId: input.projectId,
          type: "production",
          publishableKey: keys.publishableKey,
          secretKeyHash: keys.secretKeyHash,
        })
        .returning();

      return {
        id: environment.id,
        type: environment.type,
        publishableKey: environment.publishableKey,
        secretKeyHash: environment.secretKeyHash,
      };
    }),

  rotateSecret: platformProcedure
    .input(
      z.object({
        environmentId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const environment = await ctx.db.query.projectEnvironments.findFirst({
        where: eq(projectEnvironments.id, input.environmentId),
      });

      if (!environment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      const keys = await generateEnvKeys(environment.type);

      await ctx.db
        .update(projectEnvironments)
        .set({
          secretKeyHash: keys.secretKeyHash,
        })
        .where(eq(projectEnvironments.id, input.environmentId));

      return { secretKeyHash: keys.secretKeyHash };
    }),

  updateSettings: platformProcedure
    .input(
      z.object({
        projectId: z.string(),
        settings: z.object({
          enableUsername: z.boolean().optional(),
          enablePasswordless: z.boolean().optional(),
          emailVerificationRequired: z.boolean().optional(),
          passwordMinLength: z.number().min(4).max(128).optional(),
          passwordMaxLength: z.number().min(8).max(128).optional(),
          passwordRequireUppercase: z.boolean().optional(),
          passwordRequireLowercase: z.boolean().optional(),
          passwordRequireNumbers: z.boolean().optional(),
          passwordRequireSpecial: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(projectSettings)
        .set({
          ...input.settings,
        })
        .where(eq(projectSettings.projectId, input.projectId))
        .returning();

      return updated;
    }),
});
