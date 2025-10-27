import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

interface TokenPayload {
  userId: string;
  projectId: string;
  environmentId: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: TokenPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyToken(
  token: string,
  secret: string
): TokenPayload | null {
  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(
  payload: TokenPayload,
  secret: string
): string {
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}
