import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { generateId } from "@auth-kit/core";

export const projects = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("project")),
  name: text("name").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const projectEnvironments = pgTable("project_environments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("environment")),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  clientId: text("client_id")
    .notNull()
    .$defaultFn(() => generateId("client")),
  clientSecret: text("client_secret")
    .notNull()
    .$defaultFn(() => generateId("secret")),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId("user")),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    username: text("username"),
    passwordHash: text("password_hash"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("email_project_idx").on(t.email, t.projectId),
    uniqueIndex("username_project_idx").on(t.username, t.projectId),
  ]
);

export const userCredentials = pgTable("user_credentials", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId("user")),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull(),
  publicKey: text("public_key").notNull(),
  counter: text("counter").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  environments: many(projectEnvironments),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  project: one(projects, {
    fields: [users.projectId],
    references: [projects.id],
  }),
  credentials: many(userCredentials),
}));
