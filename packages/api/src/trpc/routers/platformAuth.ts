import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { publicProcedure, router } from "..";
import { users } from "../../db/schema";
import { generateId } from "../../lib/id";
import {
  hashPassword,
  signPlatformToken,
  verifyPassword,
  verifyToken,
} from "../../lib/auth";
import { generateAvatar } from "../../lib/avatar";

export const platformAuthRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        email: z.email(),
        name: z.string().min(1),
        password: z.string().min(8).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { email, name, password } = input;

      const existing = await ctx.db.query.users.findFirst({
        where: eq(users.email, email as string),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists",
        });
      }

      const userId = generateId("user");

      const passwordHash = password ? await hashPassword(password) : null;

      const [user] = await ctx.db
        .insert(users)
        .values({
          id: userId,
          email,
          name,
          imageUrl: generateAvatar(userId),
          passwordHash,
          role: "owner",
        })
        .returning();

      const token = signPlatformToken(user.id);

      if (ctx.setCookie) {
        ctx.setCookie("auth-kit.session", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
        });
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: user.imageUrl,
          role: user.role,
        },
      };
    }),

  signin: publicProcedure
    .input(
      z.object({
        email: z.email(),
        password: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { email, password } = input;

      const user = await ctx.db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      const isValid = await verifyPassword(password, user.passwordHash);

      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      const token = signPlatformToken(user.id);

      if (ctx.setCookie) {
        ctx.setCookie("auth-kit.session", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
        });
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: user.imageUrl,
          role: user.role,
        },
      };
    }),

  me: publicProcedure.query(async ({ ctx }) => {
    const getCookie = ctx.getCookie;

    if (!getCookie) return null;

    const token = getCookie("auth-kit.session");

    if (!token) return null;

    try {
      const payload = verifyToken(token);

      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, payload.userId),
      });

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        role: user.role,
      };
    } catch (error) {
      return null;
    }
  }),
});
