// password hashing helper functions
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12; // higher the value, more secure the hash, but slower the hash function

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
