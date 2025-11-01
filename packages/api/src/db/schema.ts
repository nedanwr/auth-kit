import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import { generateId } from "../lib/id";
import { generateSlug } from "../lib/slug";

// Enums
export const roleEnum = pgEnum("role", ["owner", "member"]);
export const envTypeEnum = pgEnum("env_type", ["development", "production"]);

// Tables
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  username: text("username"),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").notNull().default(false),
  role: roleEnum("role").notNull().default("member"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const projects = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("project")),
  slug: text("slug")
    .notNull()
    .unique()
    .$defaultFn(() => generateSlug()),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projectUserLinks = pgTable(
  "project_user_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("link")),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectUsername: text("project_username"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("project_user_idx").on(t.projectId, t.userId),
    uniqueIndex("project_username_idx")
      .on(t.projectId, t.projectUsername)
      .where(sql`project_username IS NOT NULL`),
  ]
);

export const projectEnvironments = pgTable(
  "project_environments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("env")),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: envTypeEnum("type").notNull(),
    publishableKey: text("publishable_key").notNull(),
    secretKeyHash: text("secret_key_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("project_type_idx").on(t.projectId, t.type)]
);

export const projectSettings = pgTable("project_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("settings")),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),

  // Feature Flags
  enableUsername: boolean("enable_username").notNull().default(false),
  enablePasswordless: boolean("enable_passwordless").notNull().default(false),
  emailVerificationRequired: boolean("email_verification_required")
    .notNull()
    .default(false),

  // Password Policy
  passwordMinLength: integer("password_min_length").notNull().default(8),
  passwordMaxLength: integer("password_max_length").notNull().default(128),
  passwordRequireUppercase: boolean("password_require_uppercase")
    .notNull()
    .default(false),
  passwordRequireLowercase: boolean("password_require_lowercase")
    .notNull()
    .default(false),
  passwordRequireNumbers: boolean("password_require_numbers")
    .notNull()
    .default(false),
  passwordRequireSpecial: boolean("password_require_special")
    .notNull()
    .default(false),

  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const magicLinks = pgTable("magic_links", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("magic")),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  environmentId: text("environment_id")
    .notNull()
    .references(() => projectEnvironments.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projectUserLinks: many(projectUserLinks),
  magicLinks: many(magicLinks),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  userLinks: many(projectUserLinks),
  environments: many(projectEnvironments),
  settings: one(projectSettings, {
    fields: [projects.id],
    references: [projectSettings.projectId],
  }),
  magicLinks: many(magicLinks),
}));

export const projectUserLinksRelations = relations(
  projectUserLinks,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectUserLinks.projectId],
      references: [projects.id],
    }),
    user: one(users, {
      fields: [projectUserLinks.userId],
      references: [users.id],
    }),
  })
);

export const projectEnvironmentsRelations = relations(
  projectEnvironments,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [projectEnvironments.projectId],
      references: [projects.id],
    }),
    magicLinks: many(magicLinks),
  })
);

export const projectSettingsRelations = relations(
  projectSettings,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectSettings.projectId],
      references: [projects.id],
    }),
  })
);

export const magicLinksRelations = relations(magicLinks, ({ one }) => ({
  project: one(projects, {
    fields: [magicLinks.projectId],
    references: [projects.id],
  }),
  environment: one(projectEnvironments, {
    fields: [magicLinks.environmentId],
    references: [projectEnvironments.id],
  }),
  user: one(users, {
    fields: [magicLinks.userId],
    references: [users.id],
  }),
}));
