import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { type Db } from "../db";
import { projectEnvironments, projectSettings, users } from "../db/schema";
import { verifySecretKey } from "../lib/keys";
import { verifyToken } from "../lib/auth";

export type Context = {
  db: Db;
  headers: Headers;
  setCookie?: (name: string, value: string, options?: any) => void;
  getCookie?: (name: string) => string | undefined;
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const publicEnvMiddleware = t.middleware(async ({ ctx, next }) => {
  const publishableKey = ctx.headers.get("x-publishable-key");

  if (!publishableKey) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid credentials",
    });
  }

  const env = await ctx.db.query.projectEnvironments.findFirst({
    where: eq(projectEnvironments.publishableKey, publishableKey),
  });

  if (!env) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid credentials",
    });
  }

  const settings = await ctx.db.query.projectSettings.findFirst({
    where: eq(projectSettings.projectId, env.projectId),
  });

  if (!settings) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid credentials",
    });
  }

  return next({
    ctx: {
      ...ctx,
      environmentId: env.id,
      projectId: env.projectId,
      environmentType: env.type,
      settings,
    },
  });
});

export const publicEnvProcedure = publicProcedure.use(publicEnvMiddleware);

export const strictEnvMiddleware = t.middleware(async ({ ctx, next }) => {
  const publishableKey = ctx.headers.get("x-publishable-key");
  const secretKey = ctx.headers.get("x-secret-key");

  if (!publishableKey || !secretKey) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid credentials",
    });
  }

  const env = await ctx.db.query.projectEnvironments.findFirst({
    where: eq(projectEnvironments.publishableKey, publishableKey),
  });

  if (!env) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid credentials",
    });
  }

  const isValid = await verifySecretKey(secretKey, env.secretKeyHash);

  if (!isValid) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid credentials",
    });
  }

  const settings = await ctx.db.query.projectSettings.findFirst({
    where: eq(projectSettings.projectId, env.projectId),
  });

  if (!settings) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid credentials",
    });
  }

  return next({
    ctx: {
      ...ctx,
      environmentId: env.id,
      projectId: env.projectId,
      environmentType: env.type,
      settings,
    },
  });
});

export const strictEnvProcedure = publicProcedure.use(strictEnvMiddleware);

export const platformSessionMiddleware = t.middleware(async ({ ctx, next }) => {
  const getCookie = ctx.getCookie;

  if (!getCookie) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Cookie accessor not configured",
    });
  }

  const token = getCookie("auth-kit.session");

  if (!token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid session",
    });
  }

  try {
    const payload = verifyToken(token);

    if (payload.type !== "platform") {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid session",
      });
    }

    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    return next({
      ctx: {
        ...ctx,
        userId: user.id,
        user,
      },
    });
  } catch (error) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid or expired session",
    });
  }
});

export const platformProcedure = publicProcedure.use(platformSessionMiddleware);
