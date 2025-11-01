import { nanoid } from "../utils/nanoid";

type IdType = "project" | "user" | "env" | "settings" | "magic" | "id";

export const generateId = (prefix: IdType) => `${prefix}_${nanoid(12)}`;
