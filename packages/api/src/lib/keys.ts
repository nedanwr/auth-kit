import bcrypt from "bcryptjs";

import { nanoid } from "../utils/nanoid";

type EnvType = "development" | "production";

export const generateEnvKeys = async (
  type: EnvType
): Promise<{ publishableKey: string; secretKeyHash: string }> => {
  const prefix = type === "development" ? "test" : "live";

  let publishableCore = nanoid(24);
  let secretCore = nanoid(24);

  while (publishableCore === secretCore) {
    secretCore = nanoid(24);
  }

  const publishableKey = `pk_${prefix}_${publishableCore}`;
  const secretKey = `sk_${prefix}_${secretCore}`;

  const secretKeyHash = await bcrypt.hash(secretKey, 12);

  return {
    publishableKey,
    secretKeyHash,
  };
};

export const verifySecretKey = async (
  secretKey: string,
  hash: string
): Promise<boolean> => await bcrypt.compare(secretKey, hash);
