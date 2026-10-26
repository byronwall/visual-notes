import { loginWithMagicPassword } from "~/services/auth/magic-login";
import { getMagicSession } from "~/services/auth/magic-auth.queries";
import { getPublicSharedDoc } from "~/services/doc-shares.queries";

// Server functions that run without a session. SolidStart gives each one an
// opaque id; the server reference carries it in `.url` (`/_server?id=...`).
const publicServerFunctions: unknown[] = [
  loginWithMagicPassword,
  getMagicSession,
  getPublicSharedDoc,
];

export const publicServerFunctionIds = new Set(
  publicServerFunctions.flatMap((fn) => {
    const url = (fn as { url?: string }).url;
    const id = url && new URL(url, "http://local").searchParams.get("id");
    return id ? [id] : [];
  }),
);
