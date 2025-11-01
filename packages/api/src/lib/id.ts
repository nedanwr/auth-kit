import { nanoid } from "../utils/nanoid";

type IdType = "project" | "user" | "env" | "settings" | "magic" | "link";

export const generateId = (prefix: IdType) => `${prefix}_${nanoid(12)}`;
