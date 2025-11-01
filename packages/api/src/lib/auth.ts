import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

export const hashPassword = async (password: string): Promise<string> =>
  await bcrypt.hash(password, 12);

export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => await bcrypt.compare(password, hash);

type TokenPayload = {
  userId: string;
  projectId?: string;
  type: "access" | "refresh" | "platform";
};

export const signAccessToken = (userId: string, projectId?: string): string =>
  jwt.sign({ userId, projectId, type: "access" }, JWT_SECRET, {
    expiresIn: "15m",
  });

export const signRefreshToken = (userId: string, projectId?: string): string =>
  jwt.sign({ userId, projectId, type: "refresh" }, JWT_SECRET, {
    expiresIn: "7d",
  });

export const signPlatformToken = (userId: string): string =>
  jwt.sign({ userId, type: "platform" }, JWT_SECRET, {
    expiresIn: "1y",
  });

export const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, JWT_SECRET) as TokenPayload;
