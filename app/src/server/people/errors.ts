import { Prisma } from "@prisma/client";

/** Bad People input the caller can fix; MCP turns it into a refusal. */
export class PeopleInputError extends Error {
  constructor(
    message: string,
    readonly code: "invalid" | "not_found" = "invalid",
  ) {
    super(message);
    this.name = "PeopleInputError";
  }
}

export const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

/**
 * Runs `create` unless a record with this retry key exists. A concurrent
 * retry that loses the unique-key race reads the winner instead.
 */
export async function withRequestKey<T>(
  key: string | undefined,
  find: (key: string) => Promise<T | null>,
  create: () => Promise<T>,
): Promise<{ record: T; existing: boolean }> {
  if (key) {
    const found = await find(key);
    if (found) return { record: found, existing: true };
  }
  try {
    return { record: await create(), existing: false };
  } catch (error) {
    if (key && isUniqueViolation(error)) {
      const found = await find(key);
      if (found) return { record: found, existing: true };
    }
    throw error;
  }
}
