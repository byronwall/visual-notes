import { createContext, useContext, type ParentComponent } from "solid-js";
import { createResource } from "solid-js";
import { apiFetch } from "~/utils/base-url";

type MagicAuthValue = {
  authed: () => boolean;
  loading: () => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const MagicAuthContext = createContext<MagicAuthValue>();

async function fetchSession(): Promise<boolean> {
  try {
    const isServer = typeof window === "undefined";
    console.log("[magic-auth] fetchSession", { isServer });
    const res = await apiFetch("/api/magic-session", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { authed?: boolean };
    return Boolean(data?.authed);
  } catch {
    return false;
  }
}

export const MagicAuthProvider: ParentComponent = (props) => {
  const [authed, { refetch }] = createResource(fetchSession);

  const refresh = async () => {
    console.log("[magic-auth] refresh");
    await refetch();
  };

  const logout = async () => {
    console.log("[magic-auth] logout");
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    await refresh();
    if (typeof window !== "undefined") window.location.href = "/login";
  };

  const value: MagicAuthValue = {
    authed: () => Boolean(authed()) === true,
    loading: () => Boolean((authed as any).loading) === true,
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
