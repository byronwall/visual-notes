import { createContext, useContext, type ParentComponent } from "solid-js";
import { createAsync, revalidate, useAction } from "@solidjs/router";
import { fetchMagicSession } from "~/services/auth/magic-auth.queries";
import { magicLogout } from "~/services/auth/magic-auth.actions";

type MagicAuthValue = {
  authed: () => boolean;
  loading: () => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const MagicAuthContext = createContext<MagicAuthValue>();

export const MagicAuthProvider: ParentComponent = (props) => {
  const session = createAsync(() => fetchMagicSession());
  const runLogout = useAction(magicLogout);

  const refresh = async () => {
    console.log("[magic-auth] refresh");
    await revalidate(fetchMagicSession.key);
  };

  const logout = async () => {
    console.log("[magic-auth] logout");
    await runLogout();
    await refresh();
    if (typeof window !== "undefined") window.location.href = "/login";
  };

  const value: MagicAuthValue = {
    authed: () => Boolean(session()?.authed) === true,
    loading: () => session() === undefined,
    refresh,
    logout,
  };

  return (
    <MagicAuthContext.Provider value={value}>
      {props.children}
    </MagicAuthContext.Provider>
  );
};

export function useMagicAuth(): MagicAuthValue {
  const ctx = useContext(MagicAuthContext);
  if (!ctx)
    throw new Error("useMagicAuth must be used within MagicAuthProvider");
  return ctx;
}
