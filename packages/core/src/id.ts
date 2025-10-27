import { nanoid } from "nanoid";

const prefixes = {
  project: "project",
  user: "user",
  environment: "env",
  client: "client",
  secret: "secret",
  session: "session",
};

export function generateId(type: keyof typeof prefixes): string {
  return `${prefixes[type]}_${nanoid(16)}`;
}
