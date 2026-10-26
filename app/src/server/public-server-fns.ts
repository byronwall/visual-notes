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

// A function that stopped being a server reference drops out silently, and
// the middleware then rejects it: login fails with a bare 401.
if (
  !import.meta.env?.VITEST &&
  publicServerFunctionIds.size !== publicServerFunctions.length
) {
  console.error(
    "[public-server-fns] missing server function ids; public calls will 401",
    {
      expected: publicServerFunctions.length,
      found: publicServerFunctionIds.size,
    },
  );
}
