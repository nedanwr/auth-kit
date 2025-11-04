import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { publicEnvProcedure, router } from "..";
import {
  magicLinks,
  projectSettings,
  projectUserLinks,
  users,
} from "../../db/schema";
import {
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
} from "../../lib/auth";
import { generateId } from "../../lib/id";
import { generateAvatar } from "../../lib/avatar";
import { nanoid } from "../../utils/nanoid";

const tokenGenerator = nanoid(32);

const validatePassword = (
  password: string,
  settings: typeof projectSettings.$inferSelect
): { valid: boolean; error?: string } => {
  if (password.length < settings.passwordMinLength) {
    return {
      valid: false,
      error: `Password must be at least ${settings.passwordMinLength} characters long`,
    };
  }

  if (password.length > settings.passwordMaxLength) {
    return {
      valid: false,
      error: `Password must be no more than ${settings.passwordMaxLength} characters`,
    };
  }

  if (settings.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one uppercase letter",
    };
  }

  if (settings.passwordRequireLowercase && !/[a-z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one lowercase letter",
    };
  }

  if (settings.passwordRequireNumbers && !/[0-9]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one number",
    };
  }

  if (settings.passwordRequireSpecial && !/[!@#$%^&*]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one special character",
    };
  }

  return { valid: true };
};

export const tenantAuthRouter = router({
  signup: publicEnvProcedure
    .input(
      z.object({
        email: z.email(),
        name: z.string().min(1),
        username: z.string().optional(),
        password: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.settings.enableUsername && !input.username) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Username is required",
        });
      }

      if (!ctx.settings.enablePasswordless && !input.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password is required",
        });
      }

      let passwordHash: string | null = null;
      if (input.password) {
        const validation = validatePassword(input.password, ctx.settings);
        if (!validation.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: validation.error,
          });
        }
        passwordHash = await hashPassword(input.password);
      }

      if (input.username) {
        const existingUsername = await ctx.db.query.users.findFirst({
          where: and(
            eq(projectUserLinks.projectId, ctx.projectId),
            eq(projectUserLinks.projectUsername, input.username)
          ),
        });

        if (existingUsername) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Username already exists",
          });
        }
      }

      const userId = generateId("user");

      const [user] = await ctx.db
        .insert(users)
        .values({
          id: userId,
          email: input.email,
          name: input.name,
          imageUrl: generateAvatar(userId),
          passwordHash,
          emailVerified: ctx.settings.emailVerificationRequired,
          role: "member",
        })
        .returning();

      await ctx.db.insert(projectUserLinks).values({
        projectId: ctx.projectId,
        userId: user.id,
        projectUsername: input.username || null,
      });

      const accessToken = signAccessToken(user.id, ctx.projectId);
      const refreshToken = signRefreshToken(user.id, ctx.projectId);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: user.imageUrl,
          username: input.username || null,
          emailVerified: user.emailVerified,
        },
        accessToken,
        refreshToken,
      };
    }),

  signin: publicEnvProcedure
    .input(
      z.object({
        identifier: z.string(),
        password: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let user;

      if (input.identifier.includes("@")) {
        const link = await ctx.db.query.projectUserLinks.findFirst({
          where: and(
            eq(projectUserLinks.projectId, ctx.projectId),
            eq(users.email, input.identifier)
          ),
          with: {
            user: true,
          },
        });

        if (!link) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid credentials",
          });
        }

        user = link.user;
      } else {
        const link = await ctx.db.query.projectUserLinks.findFirst({
          where: and(
            eq(projectUserLinks.projectId, ctx.projectId),
            eq(projectUserLinks.projectUsername, input.identifier)
          ),
          with: {
            user: true,
          },
        });

        if (!link) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid credentials",
          });
        }

        user = link.user;
      }

      if (ctx.settings.enablePasswordless && !input.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please use magic link to sign in",
        });
      }

      if (!user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      if (!input.password) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      const isValid = await verifyPassword(input.password, user.passwordHash);

      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      const accessToken = signAccessToken(user.id, ctx.projectId);
      const refreshToken = signRefreshToken(user.id, ctx.projectId);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: user.imageUrl,
          username: user.username || null,
          emailVerified: user.emailVerified,
        },
        accessToken,
        refreshToken,
      };
    }),

  magicLinkStart: publicEnvProcedure
    .input(
      z.object({
        email: z.email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.settings.enablePasswordless) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Passwordless sign in is not enabled",
        });
      }

      const existingLink = await ctx.db.query.projectUserLinks.findFirst({
        where: and(
          eq(projectUserLinks.projectId, ctx.projectId),
          eq(users.email, input.email)
        ),
        with: {
          user: true,
        },
      });

      if (!existingLink) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const token = tokenGenerator();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await ctx.db.insert(magicLinks).values({
        projectId: ctx.projectId,
        environmentId: ctx.environmentId,
        userId: existingLink.userId,
        email: input.email,
        token,
        expiresAt,
      });

      const magicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${token}`;

      // TODO: Send email logic

      return { magicUrl };
    }),

  magicLinkVerify: publicEnvProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.db.query.magicLinks.findFirst({
        where: and(
          eq(magicLinks.token, input.token),
          eq(magicLinks.projectId, ctx.projectId),
          eq(magicLinks.environmentId, ctx.environmentId)
        ),
      });

      if (!link) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired magic link",
        });
      }

      if (new Date() > link.expiresAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Magic link has expired",
        });
      }

      if (link.consumedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Magic link has already been used",
        });
      }

      let user;

      if (link.userId) {
        const existing = await ctx.db.query.users.findFirst({
          where: eq(users.id, link.userId),
        });
        user = existing!;
      } else {
        const userId = generateId("user");

        const [newUser] = await ctx.db
          .insert(users)
          .values({
            id: userId,
            email: link.email,
            name: link.email.split("@")[0],
            imageUrl: generateAvatar(userId),
            emailVerified: true,
            role: "member",
          })
          .returning();

        user = newUser;

        await ctx.db.insert(projectUserLinks).values({
          projectId: ctx.projectId,
          userId: user.id,
        });
      }

      await ctx.db
        .update(users)
        .set({
          emailVerified: true,
        })
        .where(eq(users.id, user.id));

      await ctx.db
        .update(magicLinks)
        .set({ consumedAt: new Date() })
        .where(eq(magicLinks.id, link.id));

      const accessToken = signAccessToken(user.id, ctx.projectId);
      const refreshToken = signRefreshToken(user.id, ctx.projectId);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: user.imageUrl,
          emailVerified: user.emailVerified,
        },
        accessToken,
        refreshToken,
      };
    }),
});
